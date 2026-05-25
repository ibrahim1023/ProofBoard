import { describe, expect, it } from "vitest";
import { parseRunnerRequest } from "./route";

describe("run-foundry API request validation", () => {
  it("accepts structured Docker runner requests", () => {
    expect(
      parseRunnerRequest({
        mode: "docker",
        projectPath: "/tmp/proofboard",
        dockerImage: "ghcr.io/foundry-rs/foundry:stable",
        matchContract: "ProofboardVaultInvariant"
      })
    ).toMatchObject({
      errors: [],
      options: {
        mode: "docker",
        projectPath: "/tmp/proofboard"
      }
    });
  });

  it("rejects arbitrary modes and relative paths", () => {
    expect(parseRunnerRequest({ mode: "shell", projectPath: "relative" }).errors).toEqual([
      "mode must be docker or local.",
      "projectPath must be an absolute local path."
    ]);
  });

  it("rejects Docker image and match contract injection shapes", () => {
    expect(
      parseRunnerRequest({
        mode: "docker",
        projectPath: "/tmp/proofboard",
        dockerImage: "--privileged",
        matchContract: "ProofboardVaultInvariant;rm"
      }).errors
    ).toEqual(["dockerImage contains unsupported characters.", "matchContract must be a Solidity-style identifier."]);
  });
});
