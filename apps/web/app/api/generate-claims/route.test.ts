import { afterEach, describe, expect, it, vi } from "vitest";
import { demoWorkspace } from "@/lib/demo-workspace";
import { POST, buildLocalClaimPrompt, parseLocalClaimRequest } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("local claim adapter API", () => {
  it("validates bounded model, protocol map, and source requests", () => {
    expect(
      parseLocalClaimRequest({
        model: "qwen2.5-coder:7b",
        protocolMap: demoWorkspace.protocolMap,
        sources: demoWorkspace.sources
      }).errors
    ).toEqual([]);

    expect(parseLocalClaimRequest({ model: "bad model;rm", protocolMap: {}, sources: [] }).errors).toEqual([
      "model contains unsupported characters.",
      "protocolMap must contain the analyzed protocol arrays.",
      "At least one source file is required."
    ]);
  });

  it("builds a source-grounded prompt with refusal instructions", () => {
    const parsed = parseLocalClaimRequest({
      model: "qwen2.5-coder:7b",
      protocolMap: demoWorkspace.protocolMap,
      sources: demoWorkspace.sources
    });

    const prompt = buildLocalClaimPrompt(parsed.request!);
    expect(prompt).toContain("insufficient_evidence");
    expect(prompt).toContain(demoWorkspace.sources[0].path);
    expect(prompt).toContain("PROTOCOL MAP:");
  });

  it("returns validated AI claim envelopes from Ollama", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            model: "qwen2.5-coder:7b",
            message: {
              content: JSON.stringify({
                status: "proposed",
                claims: [
                  {
                    title: "Deposits preserve accounting",
                    text: "Deposits should preserve source-backed asset and share accounting before human approval.",
                    source: ["ExampleVault.sol: deposit"],
                    confidence: 0.72,
                    severity: "high",
                    relatedFunctions: ["deposit"]
                  }
                ]
              })
            },
            eval_count: 42
          })
        )
      )
    );

    const response = await POST(
      new Request("http://localhost/api/generate-claims", {
        method: "POST",
        body: JSON.stringify({
          model: "qwen2.5-coder:7b",
          protocolMap: demoWorkspace.protocolMap,
          sources: demoWorkspace.sources
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, model: "qwen2.5-coder:7b", metrics: { outputTokens: 42 } });
    expect(body.payload.claims[0].title).toBe("Deposits preserve accounting");
  });

  it("rejects malformed or schema-invalid Ollama output", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ message: { content: "not-json" } })))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: { content: JSON.stringify({ status: "proposed", claims: [{}] }) } }))
        )
    );

    const requestBody = JSON.stringify({
      protocolMap: demoWorkspace.protocolMap,
      sources: demoWorkspace.sources
    });
    const malformed = await POST(
      new Request("http://localhost/api/generate-claims", { method: "POST", body: requestBody })
    );
    const invalid = await POST(
      new Request("http://localhost/api/generate-claims", { method: "POST", body: requestBody })
    );

    expect(malformed.status).toBe(502);
    expect(await malformed.json()).toMatchObject({ errors: ["Ollama returned malformed JSON."] });
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).errors.length).toBeGreaterThan(0);
  });
});
