import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { POST, localClaimPromptVersion } from "../../apps/web/app/api/generate-claims/route";
import { ollamaClaimEvalCases, ollamaEvalDatasetVersion } from "./model-datasets";
import { evaluateOllamaCase, summarizeOllamaEval } from "./model-evaluator";

const enabled = process.env.OLLAMA_EVAL === "1";
const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
const availability = enabled ? await resolveModel(baseUrl, process.env.OLLAMA_MODEL) : { model: undefined, error: "disabled" };

describe.runIf(enabled)("model-backed local claim evaluation", () => {
  it(
    "meets the source-grounding, refusal, usefulness, and schema thresholds",
    async () => {
      expect(availability.error, availability.error).toBeUndefined();
      expect(availability.model).toBeTruthy();

      const results = [];
      for (const item of ollamaClaimEvalCases) {
        const startedAt = Date.now();
        const response = await POST(
          new Request("http://localhost/api/generate-claims", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              model: availability.model,
              protocolMap: item.protocolMap,
              sources: item.sources
            })
          })
        );
        results.push(
          evaluateOllamaCase(item, {
            status: response.status,
            body: await response.json(),
            latencyMs: Date.now() - startedAt
          })
        );
      }

      const summary = summarizeOllamaEval(results);
      const report = {
        kind: "ollama_model_eval",
        model: availability.model,
        promptVersion: localClaimPromptVersion,
        datasetVersion: ollamaEvalDatasetVersion,
        runDate: new Date().toISOString(),
        baseUrl,
        summary,
        results
      };
      const resultDirectory = resolve(process.cwd(), "results");
      await mkdir(resultDirectory, { recursive: true });
      await writeFile(resolve(resultDirectory, "latest-ollama-eval.json"), `${JSON.stringify(report, null, 2)}\n`);
      console.info(JSON.stringify(report));

      expect(summary.schemaValidity).toBe(1);
      expect(summary.refusalAccuracy).toBe(1);
      expect(summary.sourceGrounding).toBeGreaterThanOrEqual(0.75);
      expect(summary.usefulness).toBeGreaterThanOrEqual(0.75);
      expect(summary.conceptCoverage).toBeGreaterThanOrEqual(0.5);
      expect(summary.passed).toBe(true);
    },
    300_000
  );
});

async function resolveModel(url: string, requestedModel?: string): Promise<{ model?: string; error?: string }> {
  try {
    const response = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3_000) });
    if (!response.ok) {
      return { error: `Ollama returned status ${response.status} from ${url}/api/tags.` };
    }

    const payload = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };
    const installed = (payload.models ?? []).flatMap((item) => [item.model, item.name]).filter((item): item is string => Boolean(item));
    if (requestedModel) {
      return installed.includes(requestedModel)
        ? { model: requestedModel }
        : { error: `Requested model ${requestedModel} is not installed. Installed models: ${installed.join(", ") || "none"}.` };
    }

    const preferred = ["qwen2.5-coder:7b", "qwen2.5:7b", "llama3.1:8b", "deepseek-coder-v2:16b"];
    const selected = preferred.find((candidate) => installed.includes(candidate)) ?? installed[0];
    return selected ? { model: selected } : { error: "Ollama is running but has no installed models." };
  } catch {
    return { error: `Ollama is not reachable at ${url}. Keep it running before invoking npm run eval:ollama.` };
  }
}
