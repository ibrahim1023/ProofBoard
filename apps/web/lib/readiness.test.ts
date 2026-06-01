import { describe, expect, it } from "vitest";
import { completedDemoWorkspace, demoWorkspace, emptyWorkspace } from "./demo-workspace";
import { calculateVerificationReadiness } from "./readiness";

describe("verification readiness", () => {
  it("scores readiness without presenting safety", () => {
    const readiness = calculateVerificationReadiness(demoWorkspace);

    expect(readiness.disclaimer).toContain("not a safety score");
    expect(readiness.factors.map((factor) => factor.id)).toEqual(["intent", "properties", "evidence", "assumptions", "skeptic"]);
    expect(readiness.blockers).toContain("AI-inferred claims still need human approval, editing, or rejection.");
    expect(readiness.nextActions.length).toBeGreaterThan(0);
  });

  it("rewards parsed evidence but still reports failed evidence boundaries", () => {
    const readiness = calculateVerificationReadiness(completedDemoWorkspace);
    const evidenceFactor = readiness.factors.find((factor) => factor.id === "evidence");

    expect(readiness.score).toBeGreaterThan(calculateVerificationReadiness(demoWorkspace).score);
    expect(evidenceFactor?.summary).toContain("properties have evidence");
    expect(readiness.blockers).toContain("Failed fuzz evidence needs implementation review, property review, or documented remediation.");
  });

  it("does not treat an empty workspace as review-ready", () => {
    const readiness = calculateVerificationReadiness(emptyWorkspace);

    expect(readiness.score).toBeLessThan(40);
    expect(readiness.label).toBe("Not ready");
    expect(readiness.blockers).toContain("No candidate properties have been generated from approved intent.");
  });
});
