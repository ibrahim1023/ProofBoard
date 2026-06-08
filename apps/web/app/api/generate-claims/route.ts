import { validateLlmClaimEnvelope } from "@proofboard/property-engine";
import type { ProtocolMap, SourceFile } from "@proofboard/shared-types";

export const runtime = "nodejs";

const defaultModel = "qwen2.5-coder:7b";
const maxSourceCharacters = 40_000;

const claimEnvelopeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["proposed", "insufficient_evidence"] },
    reason: { type: "string" },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          text: { type: "string" },
          source: { type: "array", items: { type: "string" } },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          relatedContracts: { type: "array", items: { type: "string" } },
          relatedFunctions: { type: "array", items: { type: "string" } }
        },
        required: ["title", "text", "source", "confidence", "severity"]
      }
    }
  },
  required: ["status"]
} as const;

interface LocalClaimRequest {
  model: string;
  protocolMap: ProtocolMap;
  sources: SourceFile[];
}

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
  model?: string;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export async function POST(request: Request) {
  const parsed = parseLocalClaimRequest(await request.json().catch(() => undefined));
  if (!parsed.request) {
    return Response.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, "");

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: parsed.request.model,
        stream: false,
        format: claimEnvelopeSchema,
        options: { temperature: 0 },
        messages: [
          {
            role: "system",
            content:
              "You propose source-backed protocol assurance claims for human review. Never claim safety. Refuse with status insufficient_evidence when the supplied sources do not support a claim."
          },
          {
            role: "user",
            content: buildLocalClaimPrompt(parsed.request)
          }
        ]
      }),
      signal: AbortSignal.timeout(60_000)
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      return Response.json(
        { ok: false, errors: [`Ollama request failed with status ${response.status}${detail ? `: ${detail}` : "."}`] },
        { status: 502 }
      );
    }

    const ollama = (await response.json()) as OllamaChatResponse;
    const content = ollama.message?.content;
    if (!content) {
      return Response.json({ ok: false, errors: ["Ollama returned no structured claim content."] }, { status: 502 });
    }

    let envelope: unknown;
    try {
      envelope = JSON.parse(content);
    } catch {
      return Response.json({ ok: false, errors: ["Ollama returned malformed JSON."] }, { status: 502 });
    }

    const validation = validateLlmClaimEnvelope(envelope, parsed.request.protocolMap);
    if (validation.issues.length > 0) {
      return Response.json({ ok: false, errors: validation.issues, payload: envelope }, { status: 422 });
    }

    return Response.json({
      ok: true,
      payload: envelope,
      model: ollama.model ?? parsed.request.model,
      refusal: validation.refusal,
      metrics: {
        totalDurationNs: ollama.total_duration,
        promptTokens: ollama.prompt_eval_count,
        outputTokens: ollama.eval_count
      }
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError" ? "Ollama request timed out." : "Could not reach Ollama.";
    return Response.json({ ok: false, errors: [message] }, { status: 502 });
  }
}

export function parseLocalClaimRequest(value: unknown): { request?: LocalClaimRequest; errors: string[] } {
  if (!isRecord(value)) {
    return { errors: ["Local claim request must be a JSON object."] };
  }

  const errors: string[] = [];
  const model = typeof value.model === "string" && value.model.trim() ? value.model.trim() : defaultModel;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(model)) {
    errors.push("model contains unsupported characters.");
  }

  const protocolMap = isProtocolMap(value.protocolMap) ? value.protocolMap : undefined;
  if (!protocolMap) {
    errors.push("protocolMap must contain the analyzed protocol arrays.");
  }

  const sources = Array.isArray(value.sources) ? value.sources.filter(isSourceFile) : [];
  if (sources.length === 0) {
    errors.push("At least one source file is required.");
  }

  const sourceCharacters = sources.reduce((total, source) => total + source.content.length, 0);
  if (sourceCharacters > maxSourceCharacters) {
    errors.push(`Source content exceeds the ${maxSourceCharacters}-character local adapter limit.`);
  }

  if (!protocolMap || errors.length > 0) {
    return { errors };
  }

  return { request: { model, protocolMap, sources }, errors: [] };
}

export function buildLocalClaimPrompt(request: LocalClaimRequest) {
  const sourceText = request.sources.map((source) => `FILE: ${source.path}\n${source.content}`).join("\n\n");
  const mapSummary = {
    contracts: request.protocolMap.contracts.map((contract) => ({
      name: contract.name,
      inherits: contract.inherits,
      functions: contract.functions.map((fn) => fn.signature)
    })),
    roles: request.protocolMap.roles,
    assetFlows: request.protocolMap.assetFlows,
    externalCalls: request.protocolMap.externalCalls,
    parserWarnings: request.protocolMap.parserWarnings
  };

  return `Return only JSON matching the supplied schema. Propose no more than six reviewable claims.
Each claim must cite concrete source labels and remain AI-inferred until human approval.
Use insufficient_evidence when source support is missing or parser warnings make the claim unreliable.

PROTOCOL MAP:
${JSON.stringify(mapSummary, null, 2)}

SOURCES:
${sourceText}`;
}

function isProtocolMap(value: unknown): value is ProtocolMap {
  if (!isRecord(value)) return false;
  return [
    "contracts",
    "roles",
    "criticalState",
    "assetFlows",
    "externalCalls",
    "privilegedFunctions",
    "userFlows",
    "tokenDependencies",
    "parserWarnings"
  ].every((key) => Array.isArray(value[key]));
}

function isSourceFile(value: unknown): value is SourceFile {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.path === "string" &&
    (value.language === "solidity" || value.language === "markdown" || value.language === "text") &&
    typeof value.content === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
