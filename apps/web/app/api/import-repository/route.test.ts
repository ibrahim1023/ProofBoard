import { afterEach, describe, expect, it, vi } from "vitest";
import { POST, parseRepositoryRequest } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("repository import API", () => {
  it("accepts bounded public GitHub repository URLs", () => {
    expect(parseRepositoryRequest({ repositoryUrl: "https://github.com/example/protocol.git", ref: "release/v1" })).toMatchObject({
      errors: [],
      request: {
        owner: "example",
        repo: "protocol",
        repositoryUrl: "https://github.com/example/protocol",
        ref: "release/v1"
      }
    });
  });

  it("rejects non-GitHub URLs and unsafe refs", () => {
    expect(parseRepositoryRequest({ repositoryUrl: "https://example.com/org/repo" }).errors).toHaveLength(1);
    expect(parseRepositoryRequest({ repositoryUrl: "https://github.com/org/repo", ref: "main;rm" }).errors).toEqual([
      "ref contains unsupported characters."
    ]);
  });

  it("imports supported repository sources through bounded GitHub requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ default_branch: "main" })))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              truncated: false,
              tree: [
                { path: "src/Vault.sol", type: "blob", size: 100 },
                { path: "README.md", type: "blob", size: 50 },
                { path: "artifacts/build.json", type: "blob", size: 50 }
              ]
            })
          )
        )
        .mockResolvedValueOnce(new Response("contract Vault {}"))
        .mockResolvedValueOnce(new Response("# Protocol"))
    );

    const response = await POST(
      new Request("http://localhost/api/import-repository", {
        method: "POST",
        body: JSON.stringify({ repositoryUrl: "https://github.com/example/protocol" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.repository).toMatchObject({ provider: "github", ref: "main", files: ["src/Vault.sol", "README.md"] });
    expect(body.sources.map((source: { language: string }) => source.language)).toEqual(["solidity", "markdown"]);
  });
});
