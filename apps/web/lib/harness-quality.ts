import type { HarnessBundle } from "@proofboard/harness-generator";
import type { Workspace } from "@proofboard/shared-types";

export type HarnessQualityStatus = "scaffolded" | "partial" | "missing" | "not-applicable";

export interface HarnessQualityCheck {
  id: string;
  label: string;
  status: HarnessQualityStatus;
  summary: string;
  nextAction: string;
}

export interface HarnessQualityReport {
  score: number;
  checks: HarnessQualityCheck[];
}

export function assessHarnessQuality(workspace: Workspace, bundle: HarnessBundle): HarnessQualityReport {
  const handler = fileContent(bundle, "test/invariants/handlers/VaultHandler.sol");
  const files = bundle.files.map((file) => `${file.path}\n${file.content}`).join("\n");
  const functionNames = new Set(workspace.protocolMap.contracts.flatMap((contract) => contract.functions.map((fn) => fn.name.toLowerCase())));
  const privilegedNames = workspace.protocolMap.privilegedFunctions.map((fn) => fn.name.toLowerCase());

  const checks: HarnessQualityCheck[] = [
    handlerCheck("deposit", "Deposit flow", functionNames.has("deposit"), handler, "Add actor-pranked deposit calls with approvals and bounded assets."),
    handlerCheck("mint", "Mint flow", functionNames.has("mint"), handler, "Add mint calls and assert deposit/mint accounting equivalence."),
    handlerCheck("withdraw", "Withdraw flow", functionNames.has("withdraw"), handler, "Wire owned-share bounds and actor-pranked withdraw calls."),
    handlerCheck("redeem", "Redeem flow", functionNames.has("redeem"), handler, "Add redeem calls and compare withdraw/redeem accounting paths."),
    {
      id: "fee",
      label: "Fee behavior",
      status: files.includes("FeeOnTransferToken") ? "partial" : "missing",
      summary: files.includes("FeeOnTransferToken")
        ? "Fee-on-transfer mock exists, but handler fee scenarios still need target-specific calls."
        : "No fee or fee-on-transfer scaffold was found.",
      nextAction: "Run properties against fee-on-transfer and fee-configuration scenarios before treating fee evidence as strong."
    },
    {
      id: "pause",
      label: "Pause behavior",
      status: functionNames.has("pause") ? handlerContains(handler, "pause") : "not-applicable",
      summary: functionNames.has("pause")
        ? handlerContains(handler, "pause") === "missing"
          ? "Protocol exposes pause-like behavior, but the handler does not exercise it."
          : "Pause-like behavior appears in the handler scaffold."
        : "No pause-like function was detected in the protocol map.",
      nextAction: functionNames.has("pause")
        ? "Add privileged pause/unpause actions and assertions for blocked user flows."
        : "No pause handler required unless emergency controls are added."
    },
    {
      id: "donation",
      label: "Donation sensitivity",
      status: handlerContains(handler, "donate"),
      summary:
        handlerContains(handler, "donate") === "missing"
          ? "No direct donation action was found in the handler."
          : "Donation action is scaffolded, but target-specific inflation assertions still need review.",
      nextAction: "Assert donation/inflation effects on exchange rate, shares, and first-depositor edge cases."
    },
    {
      id: "adversarial-token",
      label: "Adversarial token mocks",
      status: files.includes("FeeOnTransferToken") && files.includes("RebasingToken") ? "partial" : "missing",
      summary:
        files.includes("FeeOnTransferToken") && files.includes("RebasingToken")
          ? "Fee-on-transfer and rebasing mocks exist, but handlers must run properties against them."
          : "Adversarial token mocks are missing from the generated bundle.",
      nextAction: "Run core accounting properties against standard, fee-on-transfer, rebasing, and callback-capable token variants."
    },
    {
      id: "privileged",
      label: "Privileged flows",
      status: privilegedNames.length === 0 ? "not-applicable" : privilegedNames.some((name) => handler.toLowerCase().includes(name)) ? "partial" : "missing",
      summary:
        privilegedNames.length === 0
          ? "No privileged flows were detected in the protocol map."
          : `Detected privileged flows: ${privilegedNames.join(", ")}.`,
      nextAction:
        privilegedNames.length === 0
          ? "No privileged handler required unless admin paths are added."
          : "Add role-aware handlers for privileged actions and assertions that admin controls cannot invalidate approved user claims."
    }
  ];

  const scored = checks.filter((check) => check.status !== "not-applicable");
  const score =
    scored.length === 0
      ? 0
      : Math.round(scored.reduce((total, check) => total + statusScore(check.status), 0) / scored.length);

  return { score, checks };
}

function handlerCheck(id: string, label: string, applicable: boolean, handler: string, nextAction: string): HarnessQualityCheck {
  if (!applicable) {
    return {
      id,
      label,
      status: "not-applicable",
      summary: `No ${id} function was detected in the protocol map.`,
      nextAction: `No ${id} handler required unless that flow is added.`
    };
  }

  const status = handlerContains(handler, id);
  return {
    id,
    label,
    status,
    summary:
      status === "missing"
        ? `Protocol exposes ${id}, but the generated handler does not include a ${id} action.`
        : `Generated handler includes a ${id} action scaffold that still needs target-specific wiring.`,
    nextAction
  };
}

function handlerContains(handler: string, name: string): HarnessQualityStatus {
  return handler.toLowerCase().includes(`function ${name.toLowerCase()}`) ? "scaffolded" : "missing";
}

function fileContent(bundle: HarnessBundle, path: string) {
  return bundle.files.find((file) => file.path === path)?.content ?? "";
}

function statusScore(status: HarnessQualityStatus) {
  return {
    scaffolded: 75,
    partial: 50,
    missing: 0,
    "not-applicable": 0
  }[status];
}
