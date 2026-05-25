import { generateFoundryHarnessBundle } from "@proofboard/harness-generator";
import { createFoundryRunPlan, runFoundryPlan, type RunnerMode, type RunnerOptions } from "@proofboard/verification-runner";
import type { Workspace } from "@proofboard/shared-types";
import { isAbsolute } from "node:path";

export const runtime = "nodejs";

interface RunnerRequestResult {
  options?: RunnerOptions;
  errors: string[];
}

const runnerWorkspace = {
  id: "workspace_runner_request",
  name: "Runner request",
  protocolType: "erc4626_vault",
  description: "Server-side runner request workspace.",
  sources: [],
  protocolMap: {
    contracts: [],
    roles: [],
    criticalState: [],
    assetFlows: [],
    externalCalls: [],
    privilegedFunctions: [],
    userFlows: [],
    tokenDependencies: [],
    parserWarnings: []
  },
  claims: [],
  properties: [
    {
      id: "property_runner_request",
      claimId: "claim_runner_request",
      text: "Runner request placeholder property.",
      status: "Generated",
      skepticStatus: "Needs human review",
      skepticFindings: [],
      verificationLevel: "test_generated",
      risk: "medium",
      assumptions: [],
      evidence: [],
      nextAction: "Capture raw output and parse it."
    }
  ],
  assumptions: [],
  verificationRuns: [],
  evidence: []
} satisfies Workspace;

export async function POST(request: Request) {
  const parsed = parseRunnerRequest(await request.json().catch(() => undefined));

  if (!parsed.options) {
    return Response.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  const harness = generateFoundryHarnessBundle(runnerWorkspace);
  const plan = createFoundryRunPlan(runnerWorkspace, harness, parsed.options);
  const execution = await runFoundryPlan(plan);

  return Response.json({ ok: execution.status === "passed", execution });
}

export function parseRunnerRequest(value: unknown): RunnerRequestResult {
  if (!isRecord(value)) {
    return { errors: ["Runner request must be a JSON object."] };
  }

  const errors: string[] = [];
  const mode = value.mode === "docker" || value.mode === "local" ? value.mode : undefined;
  if (!mode) {
    errors.push("mode must be docker or local.");
  }

  const projectPath = typeof value.projectPath === "string" ? value.projectPath.trim() : "";
  if (!projectPath) {
    errors.push("projectPath is required.");
  } else if (!isAbsolute(projectPath)) {
    errors.push("projectPath must be an absolute local path.");
  } else if (projectPath.includes("\0")) {
    errors.push("projectPath cannot contain null bytes.");
  }

  const dockerImage = typeof value.dockerImage === "string" ? value.dockerImage.trim() : undefined;
  if (mode === "docker" && dockerImage && !/^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/.test(dockerImage)) {
    errors.push("dockerImage contains unsupported characters.");
  }

  const matchContract = typeof value.matchContract === "string" ? value.matchContract.trim() : undefined;
  if (matchContract && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(matchContract)) {
    errors.push("matchContract must be a Solidity-style identifier.");
  }

  if (!mode || errors.length > 0) {
    return { errors };
  }

  return {
    options: {
      mode: mode as RunnerMode,
      projectPath,
      dockerImage,
      matchContract
    },
    errors: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
