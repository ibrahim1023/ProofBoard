import type { Evidence, Property, VerificationRun, Workspace } from "@proofboard/shared-types";

export interface FoundryInvariantResult {
  testName: string;
  propertyId?: string;
  status: "passed" | "failed";
  counterexample?: string;
}

export interface ParsedFoundryOutput {
  results: FoundryInvariantResult[];
  warnings: string[];
  errors: string[];
  runStatus: VerificationRun["status"];
}

export function parseFoundryOutput(rawOutput: string, properties: Property[]): ParsedFoundryOutput {
  const lines = rawOutput.split(/\r?\n/);
  const results: FoundryInvariantResult[] = [];
  const warnings = findWeakHarnessWarnings(lines);
  let activeFailure: FoundryInvariantResult | undefined;

  for (const line of lines) {
    const match = line.match(/\[(PASS|FAIL)(?:[^\]]*)\]\s+(invariant_[A-Za-z0-9_]+)\s*\(/i);
    if (match) {
      const status = match[1]?.toLowerCase() === "pass" ? "passed" : "failed";
      const testName = match[2] ?? "invariant_unknown";
      const result: FoundryInvariantResult = {
        testName,
        propertyId: matchProperty(testName, properties)?.id,
        status
      };

      results.push(result);
      activeFailure = status === "failed" ? result : undefined;
      continue;
    }

    if (activeFailure && (/counterexample|sequence|calldata|sender|args/i.test(line) || /^\s+[\w.]+\(/.test(line))) {
      activeFailure.counterexample = [activeFailure.counterexample, line.trim()].filter(Boolean).join("\n");
    }
  }

  const errors: string[] = [];
  if (rawOutput.trim().length === 0) {
    errors.push("Paste Foundry output before parsing.");
  } else if (results.length === 0) {
    errors.push("No invariant pass or fail results were found in the Foundry output.");
  }

  return {
    results,
    warnings,
    errors,
    runStatus: errors.length > 0 ? "errored" : results.some((result) => result.status === "failed") ? "failed" : "passed"
  };
}

export function applyFoundryOutput(workspace: Workspace, rawOutput: string, now = new Date().toISOString()): Workspace {
  const parsed = parseFoundryOutput(rawOutput, workspace.properties);
  const runId = `run_foundry_${stableToken(now)}`;
  const run: VerificationRun = {
    id: runId,
    tool: "foundry",
    command: "forge test --match-contract ProofboardVaultInvariant",
    status: parsed.runStatus,
    counterexamples: parsed.results.flatMap((result) => (result.counterexample ? [`${result.testName}: ${result.counterexample}`] : [])),
    rawOutput,
    createdAt: now
  };

  if (parsed.errors.length > 0) {
    return {
      ...workspace,
      verificationRuns: [...workspace.verificationRuns, run]
    };
  }

  const evidence = [...workspace.evidence];
  const properties = workspace.properties.map((property) => {
    const result = parsed.results.find((item) => item.propertyId === property.id);
    if (!result) {
      return property;
    }

    const weakWarning = parsed.warnings.length > 0;
    const evidenceId = `evidence_${result.status}_${stableToken(`${runId}_${property.id}`)}`;
    evidence.push(foundryEvidence(evidenceId, runId, result, weakWarning));

    if (result.status === "failed") {
      return {
        ...property,
        status: "Fuzzed failed" as const,
        verificationLevel: "fuzzed_failed" as const,
        evidence: unique([...property.evidence, evidenceId]),
        nextAction: `Review ${result.testName} counterexample and strengthen the property or implementation.`
      };
    }

    if (weakWarning) {
      return {
        ...property,
        status: "Weak or vacuous" as const,
        verificationLevel: "weak_or_vacuous" as const,
        evidence: unique([...property.evidence, evidenceId]),
        nextAction: parsed.warnings[0] ?? property.nextAction
      };
    }

    return {
      ...property,
      status: "Fuzzed passed" as const,
      verificationLevel: "fuzzed_passed" as const,
      evidence: unique([...property.evidence, evidenceId]),
      nextAction: "Review assumptions and preserve the raw Foundry run as evidence."
    };
  });

  return {
    ...workspace,
    properties,
    evidence,
    verificationRuns: [...workspace.verificationRuns, run]
  };
}

function foundryEvidence(id: string, runId: string, result: FoundryInvariantResult, weakWarning: boolean): Evidence {
  if (result.status === "failed") {
    return {
      id,
      propertyId: result.propertyId ?? "unlinked_property",
      source: `Foundry ${result.testName}`,
      strength: "strong",
      verificationRunId: runId,
      summary: result.counterexample ? `Invariant failed. ${result.counterexample}` : "Invariant failed in Foundry output."
    };
  }

  return {
    id,
    propertyId: result.propertyId ?? "unlinked_property",
    source: `Foundry ${result.testName}`,
    strength: weakWarning ? "weak" : "strong",
    verificationRunId: runId,
    summary: weakWarning ? "Invariant passed, but the run reports weak or unreached handler coverage." : "Invariant passed in parsed Foundry output."
  };
}

function matchProperty(testName: string, properties: Property[]) {
  const normalizedTestName = normalize(testName.replace(/^invariant_/, ""));
  return properties.find((property) => normalizedTestName === normalize(property.id.replace(/^property_/, "")));
}

function findWeakHarnessWarnings(lines: string[]) {
  return lines
    .filter((line) => /unreached handler|no calls made to target|target contract.*not called|0 calls|selector.*unreached/i.test(line))
    .map((line) => `Weak harness signal: ${line.trim()}`);
}

function normalize(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function stableToken(value: string) {
  return normalize(value).slice(-24) || "manual";
}

function unique(values: string[]) {
  return [...new Set(values)];
}
