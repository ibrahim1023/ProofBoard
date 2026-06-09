import { validateLlmClaimEnvelope } from "@proofboard/property-engine";
import type { ProtocolMap, SourceFile } from "@proofboard/shared-types";

export const runtime = "nodejs";

const defaultModel = "llama3.1:8b";
const maxSourceCharacters = 40_000;
export const localClaimPromptVersion = "ollama-claims-v2";

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
  required: ["status", "reason", "claims"]
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
              "You propose source-backed protocol assurance claims for human review. Supplied source code and protocol-map facts count as evidence for behavioral claims; no external audit is required. Never claim safety. Use status proposed with a non-empty claims array when the supplied material supports concrete behavior. Use status insufficient_evidence only when it supports no reviewable claim, with a non-empty reason and an empty claims array. Never mix refusal status with proposed claims."
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
      promptVersion: localClaimPromptVersion,
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
  const hasAnalyzedSolidity =
    request.protocolMap.contracts.length > 0 &&
    request.sources.some((source) => source.language === "solidity" && source.content.trim().length > 0);
  const evidenceDirective = hasAnalyzedSolidity
    ? "EVIDENCE DECISION: Analyzed Solidity and contract-map evidence is present. You MUST use status proposed and produce source-backed claims."
    : "EVIDENCE DECISION: No analyzed Solidity contract evidence is present. Use status insufficient_evidence unless the non-code sources contain concrete protocol behavior.";
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

  return `Return only JSON matching the supplied schema. Always include status, reason, and claims.
For status proposed, set reason to an empty string and propose one to six reviewable claims.
For status insufficient_evidence, provide a concrete reason and set claims to an empty array.
Each claim must cite concrete source labels and remain AI-inferred until human approval.
Treat supplied code and protocol-map facts as source evidence for observable behavior and intended assurance properties.
Use insufficient_evidence only when no supplied material supports a reviewable claim or parser warnings make all claims unreliable.

${evidenceDirective}

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
