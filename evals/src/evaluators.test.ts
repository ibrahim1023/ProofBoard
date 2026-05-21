import { describe, expect, it } from "vitest";
import { analyzeSoliditySource } from "@proofboard/analyzer";
import { generateFoundryHarnessBundle } from "@proofboard/harness-generator";
import {
  applySkepticReview,
  generatePropertiesFromClaims,
  suggestClaimsFromProtocolMap,
  suggestTokenAssumptions,
  validateLlmClaimEnvelope
} from "@proofboard/property-engine";
import { parseFoundryOutput } from "@proofboard/result-parser";
import { validateWorkspace } from "@proofboard/shared-types";
import { buildAuditPacket, generateAuditExportFiles } from "../../apps/web/lib/audit-packet";
import { demoWorkspace } from "../../apps/web/lib/demo-workspace";
import {
  approveClaims,
  assumptionGenerationCases,
  claimExtractionCases,
  foundryParserCases,
  propertyCoverageCases,
  unsupportedClaimCases,
  vaultSource,
  weakInvariantCases
} from "./datasets";

const protocolMap = analyzeSoliditySource(vaultSource);
const suggestedClaims = suggestClaimsFromProtocolMap(protocolMap);

describe("release-blocker ProofBoard evals", () => {
  it("keeps claim extraction fixtures covered", () => {
    claimExtractionCases.forEach((item) => {
      expect(item.releaseBlocker).toBe(true);
      expect(suggestedClaims.map((claim) => claim.id)).toEqual(expect.arrayContaining(item.expectedClaimIds));
    });
  });

  it("rejects unsupported or malformed claim payloads", () => {
    unsupportedClaimCases.forEach((item) => {
      const validated = validateLlmClaimEnvelope(item.payload, protocolMap);
      expect(item.releaseBlocker).toBe(true);
      expect(validated.claims).toHaveLength(0);
      expect(Boolean(validated.refusal) || validated.issues.length > 0).toBe(true);
    });
  });

  it("keeps ERC4626 property template coverage", () => {
    propertyCoverageCases.forEach((item) => {
      const properties = generatePropertiesFromClaims(approveClaims(suggestedClaims, item.approvedClaimIds), protocolMap);
      expect(properties.map((property) => property.id)).toEqual(expect.arrayContaining(item.expectedPropertyIds));
    });
  });

  it("flags weak or vacuous invariants deterministically", () => {
    weakInvariantCases.forEach((item) => {
      expect(applySkepticReview(item.property, protocolMap).skepticStatus).not.toBe("Acceptable");
    });
  });

  it("keeps assumption generation fixtures covered", () => {
    assumptionGenerationCases.forEach((item) => {
      expect(suggestTokenAssumptions(protocolMap).map((assumption) => assumption.id)).toEqual(expect.arrayContaining(item.expectedAssumptionIds));
    });
  });

  it("parses Foundry fixture outputs", () => {
    foundryParserCases.forEach((item) => {
      const parsed = parseFoundryOutput(item.rawOutput, demoWorkspace.properties);
      expect(parsed.runStatus).toBe(item.expectedStatus);
      expect(parsed.errors).toEqual([]);
    });

    expect(parseFoundryOutput(foundryParserCases[0]?.rawOutput ?? "", demoWorkspace.properties).results[1]?.counterexample).toContain("pause accepted deposit");
    expect(parseFoundryOutput(foundryParserCases[1]?.rawOutput ?? "", demoWorkspace.properties).warnings.length).toBeGreaterThan(0);
  });

  it("checks audit packets and demo schemas before expansion", () => {
    const harness = generateFoundryHarnessBundle(demoWorkspace);
    const files = generateAuditExportFiles(demoWorkspace, harness);
    const packet = buildAuditPacket(demoWorkspace, harness);

    expect(validateWorkspace(demoWorkspace)).toEqual([]);
    expect(files.map((file) => file.name)).toEqual(
      expect.arrayContaining(["proofboard-report.md", "proofboard-ledger.json", "assumption-debt.md", "audit-prep.md"])
    );
    expect(packet.suggestedAuditFocus.length).toBeGreaterThan(0);
  });
});
