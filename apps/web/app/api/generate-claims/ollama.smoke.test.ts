import { describe, expect, it } from "vitest";
import { emptyWorkspace } from "@/lib/demo-workspace";
import { POST, localClaimPromptVersion } from "./route";

const smokeEnabled = process.env.OLLAMA_SMOKE === "1";
const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
const model = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
const datasetVersion = "ollama-smoke-v1";
const availability = smokeEnabled ? await findLocalModel(baseUrl, model) : { available: false, detail: "disabled" };

describe.runIf(smokeEnabled && availability.available)("live Ollama claim adapter", () => {
  it(
    "generates source-backed claims and refuses unsupported input",
    async () => {
      const startedAt = Date.now();
      const proposed = await runAdapter({
        model,
        protocolMap: {
          ...emptyWorkspace.protocolMap,
          contracts: [
            {
              id: "contract_smoke_vault",
              name: "SmokeVault",
              path: "src/SmokeVault.sol",
              inherits: ["ERC4626"],
              functions: [
                {
                  id: "function_smoke_deposit",
                  contractId: "contract_smoke_vault",
                  name: "deposit",
                  signature: "deposit(uint256 assets, address receiver)",
                  visibility: "external",
                  flow: "user",
                  modifiers: [],
                  notes: "Transfers assets and mints shares."
                }
              ],
              stateVariables: [],
              events: [],
              modifiers: [],
              externalCalls: []
            }
          ],
          userFlows: [
            {
              id: "function_smoke_deposit",
              contractId: "contract_smoke_vault",
              name: "deposit",
              signature: "deposit(uint256 assets, address receiver)",
              visibility: "external",
              flow: "user",
              modifiers: [],
              notes: "Transfers assets and mints shares."
            }
          ]
        },
        sources: [
          {
            id: "source_smoke_vault",
            path: "src/SmokeVault.sol",
            language: "solidity",
            content:
              "contract SmokeVault is ERC4626 { function deposit(uint256 assets, address receiver) external returns (uint256 shares) { shares = assets; } }"
          }
        ]
      });
      const refused = await runAdapter({
        model,
        protocolMap: emptyWorkspace.protocolMap,
        sources: [
          {
            id: "source_unsupported",
            path: "notes/unsupported.txt",
            language: "text",
            content: "No contract source, protocol behavior, or evidence is available."
          }
        ]
      });

      expect(proposed.response.status, JSON.stringify(proposed.body)).toBe(200);
      expect(proposed.body, JSON.stringify(proposed.body)).toMatchObject({ ok: true, payload: { status: "proposed" } });
      expect(proposed.body.payload.claims.length).toBeGreaterThan(0);
      expect(refused.response.status, JSON.stringify(refused.body)).toBe(200);
      expect(refused.body, JSON.stringify(refused.body)).toMatchObject({
        ok: true,
        payload: { status: "insufficient_evidence" }
      });
      expect(refused.body.payload.reason).toEqual(expect.any(String));

      console.info(
        JSON.stringify({
          kind: "ollama_smoke",
          model,
          promptVersion: localClaimPromptVersion,
          datasetVersion,
          runDate: new Date().toISOString(),
          elapsedMs: Date.now() - startedAt,
          proposalMetrics: proposed.body.metrics,
          refusalMetrics: refused.body.metrics
        })
      );
    },
    180_000
  );
});

describe.runIf(smokeEnabled && !availability.available)("live Ollama claim adapter availability", () => {
  it("reports why the opt-in smoke test could not run", () => {
    console.warn(`Ollama smoke test skipped: ${availability.detail}`);
    expect(availability.available).toBe(false);
  });
});

async function runAdapter(body: unknown) {
  const response = await POST(
    new Request("http://localhost/api/generate-claims", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
  );
  return { response, body: await response.json() };
}

async function findLocalModel(url: string, expectedModel: string): Promise<{ available: boolean; detail: string }> {
  try {
    const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) {
      return { available: false, detail: `Ollama returned status ${response.status} from /api/tags.` };
    }

    const payload = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };
    const installed = payload.models?.some((item) => item.name === expectedModel || item.model === expectedModel) ?? false;
    return installed
      ? { available: true, detail: `${expectedModel} is installed.` }
      : { available: false, detail: `Model ${expectedModel} is not installed.` };
  } catch {
    return { available: false, detail: `Ollama is not reachable at ${url}.` };
  }
}
