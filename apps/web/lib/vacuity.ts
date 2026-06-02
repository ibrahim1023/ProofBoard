import type { VerificationRun, Workspace } from "@proofboard/shared-types";

export type VacuitySeverity = "info" | "warning" | "critical";

export interface VacuityFinding {
  id: string;
  severity: VacuitySeverity;
  title: string;
  summary: string;
  nextAction: string;
  verificationRunId?: string;
}

export interface InvariantRunMetric {
  testName: string;
  status: "passed" | "failed";
  runs?: number;
  calls?: number;
  reverts?: number;
  propertyId?: string;
  touchedCoreFlows: string[];
}

export interface VacuityReport {
  score: number;
  findings: VacuityFinding[];
  invariantMetrics: InvariantRunMetric[];
  touchedCoreFlows: string[];
  missingCoreFlows: string[];
}

const criticalFlowNames = ["deposit", "mint", "withdraw", "redeem", "donate", "pause", "unpause"];

export function assessInvariantVacuity(workspace: Workspace): VacuityReport {
  const coreFlows = detectedCoreFlows(workspace);
  const invariantMetrics = workspace.verificationRuns.flatMap((run) => metricsForRun(run, workspace, coreFlows));
  const rawOutput = workspace.verificationRuns.map((run) => run.rawOutput).join("\n").toLowerCase();
  const touchedCoreFlows = coreFlows.filter((flow) => rawOutput.includes(`handler.${flow}`) || rawOutput.includes(`${flow}(`));
  const missingCoreFlows = coreFlows.filter((flow) => !touchedCoreFlows.includes(flow));
  const findings: VacuityFinding[] = [];

  workspace.verificationRuns.forEach((run) => {
    const output = run.rawOutput.toLowerCase();
    if (/unreached handler|no calls made to target|target contract.*not called|0 calls|selector.*unreached/.test(output)) {
      findings.push({
        id: `unreached_${run.id}`,
        severity: "critical",
        title: "Unreached handler signal",
        summary: "Foundry output indicates a target, selector, or handler was not reached.",
        nextAction: "Fix targetContract/targetSelector wiring and rerun before treating passing invariants as useful evidence.",
        verificationRunId: run.id
      });
    }
  });

  invariantMetrics
    .filter((metric) => metric.status === "passed" && metric.calls !== undefined && metric.calls < 100)
    .forEach((metric) => {
      findings.push({
        id: `low_calls_${metric.testName}`,
        severity: "warning",
        title: "Low call volume",
        summary: `${metric.testName} passed with only ${metric.calls} calls.`,
        nextAction: "Increase runs/call depth or inspect handler bounds to make sure the property exercises meaningful state transitions.",
        verificationRunId: runIdForMetric(workspace.verificationRuns, metric.testName)
      });
    });

  const uniqueHandlerCalls = unique([...rawOutput.matchAll(/handler\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)].map((match) => match[1] ?? ""));
  if (workspace.verificationRuns.length > 0 && uniqueHandlerCalls.length > 0 && uniqueHandlerCalls.length < 2) {
    findings.push({
      id: "low_call_diversity",
      severity: "warning",
      title: "Low handler call diversity",
      summary: `Raw output shows ${uniqueHandlerCalls.length} unique handler action: ${uniqueHandlerCalls.join(", ")}.`,
      nextAction: "Exercise at least deposit/withdraw or mint/redeem pairs before relying on accounting invariants."
    });
  }

  if (workspace.verificationRuns.length > 0 && coreFlows.length > 0 && missingCoreFlows.length > 0) {
    findings.push({
      id: "missing_core_flows",
      severity: "warning",
      title: "Core flows absent from raw evidence",
      summary: `Raw output does not show these detected core flows: ${missingCoreFlows.join(", ")}.`,
      nextAction: "Add handler traces, call summaries, or target-specific assertions that show these flows were exercised."
    });
  }

  if (workspace.verificationRuns.length > 0 && !/(actor|sender=|0xa11ce|0xb0b|0xcafe)/i.test(rawOutput)) {
    findings.push({
      id: "missing_actor_evidence",
      severity: "warning",
      title: "Actor evidence absent",
      summary: "Raw output does not show actors, senders, or multi-actor traces.",
      nextAction: "Include actor summaries or failing traces that demonstrate multi-actor coverage before elevating evidence strength."
    });
  }

  invariantMetrics
    .filter((metric) => metric.status === "passed" && metric.touchedCoreFlows.length === 0 && coreFlows.length > 0)
    .forEach((metric) => {
      findings.push({
        id: `passed_without_core_flow_${metric.testName}`,
        severity: "warning",
        title: "Passed without visible core flow",
        summary: `${metric.testName} passed, but raw output does not show a detected core flow for it.`,
        nextAction: "Preserve richer runner output or strengthen the handler so the invariant can be tied to exercised protocol flows.",
        verificationRunId: runIdForMetric(workspace.verificationRuns, metric.testName)
      });
    });

  const score = scoreFindings(findings);

  return {
    score,
    findings: dedupeFindings(findings),
    invariantMetrics,
    touchedCoreFlows,
    missingCoreFlows
  };
}

function metricsForRun(run: VerificationRun, workspace: Workspace, coreFlows: string[]): InvariantRunMetric[] {
  return run.rawOutput
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.match(/\[(PASS|FAIL)(?:[^\]]*)\]\s+(invariant_[A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(?:\(([^)]*)\))?/i);
      if (!match) {
        return [];
      }

      const metadata = match[4] ?? "";
      const testName = match[2] ?? "invariant_unknown";
      return [
        {
          testName,
          status: match[1]?.toLowerCase() === "pass" ? "passed" : "failed",
          runs: numberFromMetadata(metadata, "runs"),
          calls: numberFromMetadata(metadata, "calls"),
          reverts: numberFromMetadata(metadata, "reverts"),
          propertyId: matchProperty(testName, workspace),
          touchedCoreFlows: coreFlows.filter((flow) => run.rawOutput.toLowerCase().includes(`handler.${flow}`))
        } satisfies InvariantRunMetric
      ];
    });
}

function detectedCoreFlows(workspace: Workspace) {
  const functionNames = workspace.protocolMap.contracts.flatMap((contract) => contract.functions.map((fn) => fn.name.toLowerCase()));
  return unique(functionNames.filter((name) => criticalFlowNames.includes(name)));
}

function numberFromMetadata(metadata: string, key: string) {
  const match = metadata.match(new RegExp(`${key}\\s*:\\s*([0-9_]+)`, "i"));
  return match ? Number.parseInt((match[1] ?? "0").replaceAll("_", ""), 10) : undefined;
}

function matchProperty(testName: string, workspace: Workspace) {
  const normalizedTestName = normalize(testName.replace(/^invariant_/, ""));
  return workspace.properties.find((property) => normalizedTestName === normalize(property.id.replace(/^property_/, "")))?.id;
}

function runIdForMetric(runs: VerificationRun[], testName: string) {
  return runs.find((run) => run.rawOutput.includes(testName))?.id;
}

function scoreFindings(findings: VacuityFinding[]) {
  if (findings.length === 0) {
    return 100;
  }

  const penalty = findings.reduce((total, finding) => total + (finding.severity === "critical" ? 35 : finding.severity === "warning" ? 15 : 5), 0);
  return Math.max(0, 100 - penalty);
}

function dedupeFindings(findings: VacuityFinding[]) {
  const byId = new Map(findings.map((finding) => [finding.id, finding]));
  return [...byId.values()];
}

function normalize(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}
