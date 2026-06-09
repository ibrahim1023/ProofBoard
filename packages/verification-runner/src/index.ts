import type { HarnessBundle } from "@proofboard/harness-generator";
import type { Workspace } from "@proofboard/shared-types";

export type RunnerMode = "local" | "docker";

export interface RunnerOptions {
  mode: RunnerMode;
  projectPath: string;
  dockerImage?: string;
  matchContract?: string;
}

export interface FoundryRunPlan {
  mode: RunnerMode;
  command: string;
  executable: string;
  args: string[];
  cwd: string;
  outputFile: string;
  warnings: string[];
  evidenceBoundary: string;
}

export interface RunnerExecution {
  plan: FoundryRunPlan;
  status: "passed" | "failed" | "errored" | "cancelled";
  stdout: string;
  stderr: string;
  rawOutput: string;
  exitCode?: number;
}

export interface CommandExecutor {
  (file: string, args: string[], options: { cwd: string }): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

export type RunnerStreamEvent =
  | { type: "output"; stream: "stdout" | "stderr"; chunk: string }
  | { type: "complete"; execution: RunnerExecution };

export interface StreamingCommandExecutor {
  (
    file: string,
    args: string[],
    options: {
      cwd: string;
      signal?: AbortSignal;
      onStdout: (chunk: string) => void;
      onStderr: (chunk: string) => void;
    }
  ): Promise<{ exitCode: number; cancelled: boolean }>;
}

const defaultDockerImage = "ghcr.io/foundry-rs/foundry:stable";
const defaultMatchContract = "ProofboardVaultInvariant";

export function createFoundryRunPlan(workspace: Workspace, harnessBundle: HarnessBundle, options: RunnerOptions): FoundryRunPlan {
  const projectPath = options.projectPath.trim();
  const matchContract = options.matchContract?.trim() || defaultMatchContract;
  const warnings = [
    ...missingHarnessWarnings(harnessBundle),
    "Generated harnesses must be reviewed and wired before run output counts as strong evidence."
  ];

  if (!projectPath) {
    warnings.push("Project path is required before executing a local or Docker Foundry run.");
  }

  if (workspace.properties.length === 0) {
    warnings.push("No properties are selected; runner output cannot attach evidence to the ledger.");
  }

  if (options.mode === "docker") {
    const image = options.dockerImage?.trim() || defaultDockerImage;
    const args = [
      "run",
      "--rm",
      "-v",
      `${projectPath || "$PWD"}:/workspace`,
      "-w",
      "/workspace",
      image,
      "forge",
      "test",
      "--match-contract",
      matchContract
    ];

    return {
      mode: "docker",
      command: shellJoin(["docker", ...args]),
      executable: "docker",
      args,
      cwd: projectPath || ".",
      outputFile: "proofboard-foundry-output.log",
      warnings,
      evidenceBoundary: "Captured Docker output must be parsed before it updates ProofBoard evidence."
    };
  }

  const args = ["test", "--match-contract", matchContract];
  return {
    mode: "local",
    command: shellJoin(["forge", ...args]),
    executable: "forge",
    args,
    cwd: projectPath || ".",
    outputFile: "proofboard-foundry-output.log",
    warnings,
    evidenceBoundary: "Captured local Forge output must be parsed before it updates ProofBoard evidence."
  };
}

export async function runFoundryPlan(plan: FoundryRunPlan, executor: CommandExecutor = execFileExecutor): Promise<RunnerExecution> {
  if (plan.cwd === "." || plan.cwd.trim().length === 0) {
    return {
      plan,
      status: "errored",
      stdout: "",
      stderr: "Project path is required before running Foundry.",
      rawOutput: "Project path is required before running Foundry.",
      exitCode: 1
    };
  }

  const result = await executor(plan.executable, plan.args, { cwd: plan.cwd });
  const rawOutput = [result.stdout, result.stderr].filter(Boolean).join("\n");
  return {
    plan,
    status: result.exitCode === 0 ? "passed" : "failed",
    stdout: result.stdout,
    stderr: result.stderr,
    rawOutput,
    exitCode: result.exitCode
  };
}

export async function streamFoundryPlan(
  plan: FoundryRunPlan,
  onEvent: (event: RunnerStreamEvent) => void,
  signal?: AbortSignal,
  executor: StreamingCommandExecutor = spawnExecutor
): Promise<RunnerExecution> {
  if (plan.cwd === "." || plan.cwd.trim().length === 0) {
    const execution: RunnerExecution = {
      plan,
      status: "errored",
      stdout: "",
      stderr: "Project path is required before running Foundry.",
      rawOutput: "Project path is required before running Foundry.",
      exitCode: 1
    };
    onEvent({ type: "complete", execution });
    return execution;
  }

  let stdout = "";
  let stderr = "";
  const result = await executor(plan.executable, plan.args, {
    cwd: plan.cwd,
    signal,
    onStdout(chunk) {
      stdout += chunk;
      onEvent({ type: "output", stream: "stdout", chunk });
    },
    onStderr(chunk) {
      stderr += chunk;
      onEvent({ type: "output", stream: "stderr", chunk });
    }
  });
  const rawOutput = [stdout, stderr].filter(Boolean).join("\n");
  const execution: RunnerExecution = {
    plan,
    status: result.cancelled ? "cancelled" : result.exitCode === 0 ? "passed" : "failed",
    stdout,
    stderr,
    rawOutput,
    exitCode: result.exitCode
  };
  onEvent({ type: "complete", execution });
  return execution;
}

function missingHarnessWarnings(harnessBundle: HarnessBundle) {
  const paths = new Set(harnessBundle.files.map((file) => file.path));
  const required = ["test/invariants/ProofboardVaultInvariant.t.sol", "test/invariants/handlers/VaultHandler.sol"];
  return required
    .filter((path) => !paths.has(path))
    .map((path) => `Generated harness bundle is missing ${path}.`);
}

function execFileExecutor(file: string, args: string[], options: { cwd: string }) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    void import("node:child_process").then(({ execFile }) => {
      execFile(file, args, { cwd: options.cwd }, (error, stdout, stderr) => {
        const exitCode = typeof error === "object" && error && "code" in error && typeof error.code === "number" ? error.code : 0;
        resolve({ stdout, stderr, exitCode });
      });
    });
  });
}

function spawnExecutor(
  file: string,
  args: string[],
  options: {
    cwd: string;
    signal?: AbortSignal;
    onStdout: (chunk: string) => void;
    onStderr: (chunk: string) => void;
  }
) {
  return new Promise<{ exitCode: number; cancelled: boolean }>((resolve) => {
    void import("node:child_process").then(({ spawn }) => {
      const child = spawn(file, args, { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"] });
      let cancelled = options.signal?.aborted ?? false;
      const abort = () => {
        cancelled = true;
        child.kill("SIGTERM");
      };

      if (cancelled) {
        child.kill("SIGTERM");
      } else {
        options.signal?.addEventListener("abort", abort, { once: true });
      }

      child.stdout.on("data", (chunk: Buffer) => options.onStdout(chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => options.onStderr(chunk.toString()));
      child.on("error", (error) => {
        options.onStderr(error.message);
        options.signal?.removeEventListener("abort", abort);
        resolve({ exitCode: 1, cancelled });
      });
      child.on("close", (code) => {
        options.signal?.removeEventListener("abort", abort);
        resolve({ exitCode: code ?? (cancelled ? 130 : 1), cancelled });
      });
    });
  });
}

function shellJoin(parts: string[]) {
  return parts.map((part) => (/^[A-Za-z0-9_./:=@-]+$/.test(part) ? part : JSON.stringify(part))).join(" ");
}
