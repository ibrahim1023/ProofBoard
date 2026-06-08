import type { Workspace } from "@proofboard/shared-types";

export interface PublicDemoStep {
  id: string;
  board: string;
  title: string;
  outcome: string;
}

export interface PublicDemoAcceptance {
  id: string;
  label: string;
  satisfied: boolean;
  evidence: string;
}

export const publicDemoSteps: PublicDemoStep[] = [
  {
    id: "load",
    board: "Project",
    title: "Load the completed ERC4626 demo",
    outcome: "Start from one reviewable workspace rather than switching between unrelated examples."
  },
  {
    id: "intent",
    board: "Intent Board",
    title: "Separate approved intent from inferred concerns",
    outcome: "Show human-approved withdrawal and pause intent beside the unapproved donation/inflation concern."
  },
  {
    id: "assumptions",
    board: "Assumption Debt",
    title: "Open the unresolved dependency",
    outcome: "Show that rebasing and donation behavior remain explicit assumptions instead of hidden caveats."
  },
  {
    id: "results",
    board: "Results",
    title: "Inspect preserved Foundry output",
    outcome: "Show a failed pause invariant and an unreached-handler warning without presenting either as a safety verdict."
  },
  {
    id: "ledger",
    board: "Ledger",
    title: "Compare evidence strength",
    outcome: "Show failed evidence, weak or vacuous evidence, generated properties, assumptions, and next actions separately."
  },
  {
    id: "export",
    board: "Export",
    title: "Download the audit-prep packet",
    outcome: "Show executive review, approved intent, unresolved assumptions, evidence details, and auditor questions as separate artifacts."
  }
];

export function evaluatePublicDemo(workspace: Workspace, exportFileNames: string[]): PublicDemoAcceptance[] {
  const rawOutput = workspace.verificationRuns.map((run) => run.rawOutput).join("\n");
  const evidenceText = workspace.evidence.map((evidence) => evidence.summary).join("\n");

  return [
    {
      id: "weak-invariant",
      label: "Weak invariant remains visible",
      satisfied:
        workspace.properties.some(
          (property) => property.status === "Weak or vacuous" || property.verificationLevel === "weak_or_vacuous"
        ) || /unreached handler|0 calls|not called/i.test(rawOutput),
      evidence: "A weak/vacuous property or unreached-handler signal is preserved."
    },
    {
      id: "unresolved-assumption",
      label: "Unresolved assumption remains visible",
      satisfied: workspace.assumptions.some((assumption) =>
        ["Unresolved", "Needs test", "Needs invariant", "Needs symbolic check", "Needs formal proof"].includes(assumption.status)
      ),
      evidence: "At least one assumption still requires evidence or review."
    },
    {
      id: "donation-concern",
      label: "Donation or inflation concern is represented",
      satisfied: [...workspace.claims, ...workspace.properties, ...workspace.assumptions].some((item) =>
        /donation|inflation|first depositor/i.test("text" in item ? item.text : "")
      ),
      evidence: "The workspace explicitly records donation/inflation sensitivity."
    },
    {
      id: "parsed-foundry",
      label: "Parsed Foundry evidence is attached",
      satisfied:
        workspace.verificationRuns.some((run) => run.tool === "foundry" && run.status !== "not_run") &&
        /invariant (passed|failed)|Foundry/i.test(evidenceText),
      evidence: "A preserved Foundry run has produced linked evidence."
    },
    {
      id: "audit-export",
      label: "Audit-prep exports are available",
      satisfied: [
        "executive-summary.md",
        "approved-protocol-intent.md",
        "unresolved-assumptions-table.md",
        "verification-evidence-appendix.md",
        "failed-and-fuzzy-evidence.md",
        "auditor-questions.md",
        "audit-prep.md"
      ].every((name) => exportFileNames.includes(name)),
      evidence: "External-review artifacts remain separated by evidence boundary."
    }
  ];
}
