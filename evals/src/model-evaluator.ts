import type { OllamaEvalCase } from "./model-datasets";

interface EvaluatedClaim {
  title: string;
  text: string;
  source: string[];
  relatedFunctions: string[];
}

export interface OllamaCaseResult {
  id: string;
  expectedStatus: OllamaEvalCase["expectedStatus"];
  actualStatus: string;
  schemaValid: boolean;
  sourceGrounding: number;
  usefulness: number;
  conceptCoverage: number;
  latencyMs: number;
  promptTokens?: number;
  outputTokens?: number;
  errors: string[];
}

export interface OllamaEvalSummary {
  caseCount: number;
  schemaValidity: number;
  refusalAccuracy: number;
  sourceGrounding: number;
  usefulness: number;
  conceptCoverage: number;
  averageLatencyMs: number;
  totalPromptTokens: number;
  totalOutputTokens: number;
  passed: boolean;
}

export function evaluateOllamaCase(
  item: OllamaEvalCase,
  response: {
    status: number;
    body: {
      ok?: boolean;
      payload?: unknown;
      errors?: string[];
      metrics?: { promptTokens?: number; outputTokens?: number };
    };
    latencyMs: number;
  }
): OllamaCaseResult {
  const payload = isRecord(response.body.payload) ? response.body.payload : undefined;
  const actualStatus = typeof payload?.status === "string" ? payload.status : "invalid";
  const claims = Array.isArray(payload?.claims) ? payload.claims.filter(isClaimShape) : [];
  const schemaValid = response.status === 200 && response.body.ok === true && payload !== undefined;
  const errors = response.body.errors ? [...response.body.errors] : [];

  if (actualStatus !== item.expectedStatus) {
    errors.push(`Expected status ${item.expectedStatus}, received ${actualStatus}.`);
  }

  return {
    id: item.id,
    expectedStatus: item.expectedStatus,
    actualStatus,
    schemaValid,
    sourceGrounding: item.expectedStatus === "proposed" ? groundedClaimRatio(claims, item) : actualStatus === "insufficient_evidence" ? 1 : 0,
    usefulness: item.expectedStatus === "proposed" ? usefulClaimRatio(claims) : actualStatus === "insufficient_evidence" ? 1 : 0,
    conceptCoverage: item.expectedStatus === "proposed" ? expectedConceptCoverage(claims, item.expectedConcepts) : 1,
    latencyMs: response.latencyMs,
    promptTokens: response.body.metrics?.promptTokens,
    outputTokens: response.body.metrics?.outputTokens,
    errors
  };
}

export function summarizeOllamaEval(results: OllamaCaseResult[]): OllamaEvalSummary {
  const proposed = results.filter((item) => item.expectedStatus === "proposed");
  const refusals = results.filter((item) => item.expectedStatus === "insufficient_evidence");
  const summary = {
    caseCount: results.length,
    schemaValidity: average(results.map((item) => Number(item.schemaValid))),
    refusalAccuracy: average(refusals.map((item) => Number(item.actualStatus === "insufficient_evidence"))),
    sourceGrounding: average(proposed.map((item) => item.sourceGrounding)),
    usefulness: average(proposed.map((item) => item.usefulness)),
    conceptCoverage: average(proposed.map((item) => item.conceptCoverage)),
    averageLatencyMs: average(results.map((item) => item.latencyMs)),
    totalPromptTokens: sum(results.map((item) => item.promptTokens ?? 0)),
    totalOutputTokens: sum(results.map((item) => item.outputTokens ?? 0)),
    passed: false
  };

  summary.passed =
    summary.schemaValidity === 1 &&
    summary.refusalAccuracy === 1 &&
    summary.sourceGrounding >= 0.75 &&
    summary.usefulness >= 0.75 &&
    summary.conceptCoverage >= 0.5;

  return summary;
}

function groundedClaimRatio(claims: EvaluatedClaim[], item: OllamaEvalCase) {
  const groundingTerms = new Set(
    [
      ...item.sources.flatMap((source) => [source.path, ...words(source.path), ...words(source.content)]),
      ...item.protocolMap.contracts.flatMap((contract) => [contract.name, ...contract.functions.map((fn) => fn.name)]),
      ...item.protocolMap.userFlows.map((flow) => flow.name),
      ...item.protocolMap.privilegedFunctions.map((fn) => fn.name)
    ]
      .flatMap(words)
      .filter((word) => word.length >= 4)
  );

  return average(
    claims.map((claim) =>
      Number(claim.source.some((citation) => words(citation).some((word) => word.length >= 4 && groundingTerms.has(word))))
    )
  );
}

function usefulClaimRatio(claims: EvaluatedClaim[]) {
  const prohibited = ["protocol is safe", "guaranteed safe", "vulnerability-free", "no vulnerabilities"];
  return average(
    claims.map((claim) => {
      const text = `${claim.title} ${claim.text}`.toLowerCase();
      return Number(
        claim.title.trim().length >= 8 &&
          claim.text.trim().length >= 40 &&
          claim.source.length > 0 &&
          !prohibited.some((phrase) => text.includes(phrase))
      );
    })
  );
}

function expectedConceptCoverage(claims: EvaluatedClaim[], expectedConcepts: string[][]) {
  const combined = claims.map((claim) => `${claim.title} ${claim.text} ${claim.relatedFunctions.join(" ")}`.toLowerCase()).join(" ");
  return average(expectedConcepts.map((group) => Number(group.every((concept) => combined.includes(concept)))));
}

function isClaimShape(value: unknown): value is EvaluatedClaim {
  if (
    !isRecord(value) ||
    typeof value.title !== "string" ||
    typeof value.text !== "string" ||
    !Array.isArray(value.source) ||
    !value.source.every((item) => typeof item === "string")
  ) {
    return false;
  }

  if (value.relatedFunctions === undefined) {
    value.relatedFunctions = [];
  }

  return Array.isArray(value.relatedFunctions) && value.relatedFunctions.every((item) => typeof item === "string");
}

function words(value: string) {
  return value.toLowerCase().match(/[a-z][a-z0-9_]*/g) ?? [];
}

function average(values: number[]) {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
