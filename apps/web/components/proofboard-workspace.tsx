"use client";

import { useMemo, useState } from "react";
import { analyzeSoliditySource } from "@proofboard/analyzer";
import { generateFoundryHarnessBundle } from "@proofboard/harness-generator";
import {
  generatePropertiesFromClaims,
  linkAssumptionsToProperties,
  suggestClaimsFromProtocolMap,
  suggestTokenAssumptions
} from "@proofboard/property-engine";
import { demoWorkspace, emptyWorkspace } from "@/lib/demo-workspace";
import type { Assumption, AssumptionStatus, BoardId, Claim, Property, ProtocolType, Workspace } from "@proofboard/shared-types";

const boardItems: Array<{ id: BoardId; label: string }> = [
  { id: "upload", label: "Project" },
  { id: "map", label: "Protocol Map" },
  { id: "intent", label: "Intent Board" },
  { id: "invariants", label: "Invariant Board" },
  { id: "assumptions", label: "Assumption Debt" },
  { id: "ledger", label: "Ledger" },
  { id: "harness", label: "Harness" },
  { id: "results", label: "Results" },
  { id: "export", label: "Export" }
];

const protocolLabels: Record<ProtocolType, string> = {
  erc4626_vault: "ERC4626 Vault",
  staking_vault: "Staking Vault",
  custom_vault: "Custom Vault"
};

const assumptionFilterOptions = ["All", "Unresolved", "Needs test", "Needs invariant", "Accepted risk", "Out of scope"] as const;
const assumptionStatusOptions: AssumptionStatus[] = [
  "Unresolved",
  "Accepted risk",
  "Needs test",
  "Needs invariant",
  "Needs symbolic check",
  "Needs formal proof",
  "Mitigated in code",
  "Out of scope"
];

export function ProofboardWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>(demoWorkspace);
  const [activeBoard, setActiveBoard] = useState<BoardId>("upload");
  const [assumptionFilter, setAssumptionFilter] = useState<(typeof assumptionFilterOptions)[number]>("All");
  const [selectedHarnessPath, setSelectedHarnessPath] = useState("test/invariants/ProofboardVaultInvariant.t.sol");
  const primarySource = workspace.sources[0];
  const allFunctions = workspace.protocolMap.contracts.flatMap((contract) => contract.functions);

  const approvedClaims = workspace.claims.filter((claim) => claim.status === "Human-approved").length;
  const openAssumptions = workspace.assumptions.filter(
    (assumption) => assumption.status !== "Accepted risk" && assumption.status !== "Out of scope"
  ).length;

  const ledgerRows = useMemo(
    () =>
      workspace.properties.map((property) => {
        const claim = workspace.claims.find((item) => item.id === property.claimId);
        const assumptions = workspace.assumptions.filter((assumption) => property.assumptions.includes(assumption.id));
        const evidence = workspace.evidence.filter((item) => property.evidence.includes(item.id));
        return { property, claim, assumptions, evidence };
      }),
    [workspace.assumptions, workspace.claims, workspace.evidence, workspace.properties]
  );
  const visibleAssumptions = workspace.assumptions.filter((assumption) =>
    assumptionFilter === "All" ? true : assumption.status === assumptionFilter
  );
  const harnessBundle = useMemo(() => generateFoundryHarnessBundle(workspace), [workspace]);
  const selectedHarnessFile = harnessBundle.files.find((file) => file.path === selectedHarnessPath) ?? harnessBundle.files[0];

  function updateField(field: "name" | "description" | "solidity", value: string) {
    setWorkspace((current) => {
      if (field === "solidity") {
        const [firstSource, ...remainingSources] = current.sources;
        const nextSource = {
          id: firstSource?.id ?? "source_inline",
          path: firstSource?.path ?? "src/Vault.sol",
          language: "solidity" as const,
          content: value
        };

        return {
          ...current,
          sources: [nextSource, ...remainingSources],
          protocolMap: analyzeSoliditySource(nextSource),
          claims: mergeClaims(current.claims, suggestClaimsFromProtocolMap(analyzeSoliditySource(nextSource))),
          assumptions: mergeAssumptions(current.assumptions, suggestTokenAssumptions(analyzeSoliditySource(nextSource)))
        };
      }

      return {
        ...current,
        [field]: value
      };
    });
  }

  function updateProtocolType(value: ProtocolType) {
    setWorkspace((current) => ({
      ...current,
      protocolType: value
    }));
  }

  function loadBlankWorkspace() {
    setWorkspace(emptyWorkspace);
    setActiveBoard("upload");
  }

  function loadDemoWorkspace() {
    setWorkspace(demoWorkspace);
    setActiveBoard("map");
  }

  function refreshClaimSuggestions() {
    setWorkspace((current) => ({
      ...current,
      claims: mergeClaims(current.claims, suggestClaimsFromProtocolMap(current.protocolMap)),
      assumptions: linkAssumptionsToProperties(
        mergeAssumptions(current.assumptions, suggestTokenAssumptions(current.protocolMap)),
        current.properties
      )
    }));
  }

  function updateClaimStatus(claimId: string, status: Claim["status"]) {
    setWorkspace((current) => ({
      ...current,
      claims: current.claims.map((claim) => (claim.id === claimId ? { ...claim, status } : claim))
    }));
  }

  function updateClaimText(claimId: string, text: string) {
    setWorkspace((current) => ({
      ...current,
      claims: current.claims.map((claim) =>
        claim.id === claimId
          ? {
              ...claim,
              text,
              status: claim.status === "Rejected" ? "Rejected" : "Edited"
            }
          : claim
      )
    }));
  }

  function generateInvariantProperties() {
    setWorkspace((current) => {
      const generated = generatePropertiesFromClaims(current.claims, current.protocolMap);
      const properties = mergeProperties(current.properties, generated);
      return {
        ...current,
        properties,
        assumptions: linkAssumptionsToProperties(current.assumptions, properties)
      };
    });
    setActiveBoard("invariants");
  }

  function updateAssumptionStatus(assumptionId: string, status: AssumptionStatus) {
    setWorkspace((current) => ({
      ...current,
      assumptions: current.assumptions.map((assumption) => (assumption.id === assumptionId ? { ...assumption, status } : assumption))
    }));
  }

  function downloadHarnessBundle() {
    const payload = JSON.stringify(harnessBundle, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "generated-foundry-invariants.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="workspace-shell">
      <aside className="sidebar" aria-label="ProofBoard workspace navigation">
        <div className="brand-block">
          <div className="brand-mark">PB</div>
          <div>
            <p className="eyebrow">Protocol assurance</p>
            <h1>ProofBoard</h1>
          </div>
        </div>

        <nav className="board-nav">
          {boardItems.map((item) => (
            <button
              className={activeBoard === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => setActiveBoard(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-panel">
          <span className="panel-label">Workspace</span>
          <strong>{workspace.name || "Untitled vault"}</strong>
          <span>{protocolLabels[workspace.protocolType]}</span>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">ERC4626 assurance workspace</p>
            <h2>{workspace.name || "New ProofBoard workspace"}</h2>
          </div>
          <div className="summary-strip" aria-label="Workspace summary">
            <Metric label="Contracts" value={workspace.protocolMap.contracts.length} />
            <Metric label="Claims approved" value={approvedClaims} />
            <Metric label="Properties" value={workspace.properties.length} />
            <Metric label="Open assumptions" value={openAssumptions} />
          </div>
        </header>

        {activeBoard === "upload" && (
          <section className="workspace-grid">
            <div className="section-block wide">
              <div className="section-heading">
                <p className="eyebrow">Create workspace</p>
                <h3>Project intake</h3>
              </div>

              <div className="form-grid">
                <label>
                  Workspace name
                  <input
                    onChange={(event) => updateField("name", event.target.value)}
                    placeholder="ExampleVault Assurance"
                    value={workspace.name}
                  />
                </label>

                <label>
                  Protocol type
                  <select
                    onChange={(event) => updateProtocolType(event.target.value as ProtocolType)}
                    value={workspace.protocolType}
                  >
                    <option value="erc4626_vault">ERC4626 Vault</option>
                    <option value="staking_vault">Staking Vault</option>
                    <option value="custom_vault">Custom Vault</option>
                  </select>
                </label>
              </div>

              <label>
                Protocol description
                <textarea
                  className="notes-input"
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="Describe asset flows, privileged roles, emergency behavior, and known assumptions."
                  value={workspace.description}
                />
              </label>

              <label>
                Solidity source
                <textarea
                  className="code-input"
                  onChange={(event) => updateField("solidity", event.target.value)}
                  placeholder="Paste a vault contract here."
                  spellCheck={false}
                  value={primarySource?.content ?? ""}
                />
              </label>

              <div className="action-row">
                <button className="primary-action" onClick={loadDemoWorkspace} type="button">
                  Load demo vault
                </button>
                <button className="secondary-action" onClick={loadBlankWorkspace} type="button">
                  New blank workspace
                </button>
                <label className="file-control">
                  <input type="file" accept=".sol,.zip" disabled />
                  Repo zip upload placeholder
                </label>
              </div>
            </div>

            <PrinciplePanel />
          </section>
        )}

        {activeBoard === "map" && (
          <section className="workspace-grid">
            <div className="section-block">
              <div className="section-heading">
                <p className="eyebrow">Secure core map</p>
                <h3>Contracts and flows</h3>
              </div>
              <div className="map-tree">
                <TreeGroup
                  title="Contracts"
                  items={workspace.protocolMap.contracts.map((contract) =>
                    contract.inherits.length > 0 ? `${contract.name} inherits ${contract.inherits.join(", ")}` : contract.name
                  )}
                  empty="Paste Solidity or load the demo."
                />
                <TreeGroup
                  title="User flows"
                  items={workspace.protocolMap.userFlows.map((fn) => fn.name)}
                  empty="No user flows detected yet."
                />
                <TreeGroup
                  title="Privileged flows"
                  items={workspace.protocolMap.privilegedFunctions.map((fn) => fn.name)}
                  empty="No privileged flows detected yet."
                />
                <TreeGroup
                  title="Token dependencies"
                  items={workspace.protocolMap.tokenDependencies.map((item) => item.name)}
                  empty="No token dependencies detected yet."
                />
                <TreeGroup title="External assumptions" items={workspace.assumptions.map((item) => item.text)} empty="No assumptions recorded yet." />
              </div>
            </div>
            <div className="section-block">
              <div className="section-heading">
                <p className="eyebrow">Function inventory</p>
                <h3>Detected entrypoints</h3>
              </div>
              <div className="stack">
                {allFunctions.length === 0 ? (
                  <EmptyState text="No functions detected. Add Solidity or load the demo workspace." />
                ) : (
                  allFunctions.map((fn) => (
                    <article className="compact-card" key={fn.id}>
                      <div>
                        <strong>{fn.name}</strong>
                        <span>{fn.visibility} / {fn.flow}</span>
                      </div>
                      <span>{fn.signature}</span>
                      <p>{fn.notes}</p>
                    </article>
                  ))
                )}
              </div>
            </div>
            <div className="section-block wide">
              <div className="section-heading">
                <p className="eyebrow">Analysis notes</p>
                <h3>State, calls, and parser warnings</h3>
              </div>
              <div className="analysis-grid">
                <TreeGroup
                  title="Critical state"
                  items={workspace.protocolMap.criticalState.map((state) => `${state.type} ${state.name}`)}
                  empty="No critical state detected yet."
                />
                <TreeGroup
                  title="External calls"
                  items={workspace.protocolMap.externalCalls.map((call) => call.expression)}
                  empty="No external calls detected yet."
                />
                <TreeGroup
                  title="Roles"
                  items={workspace.protocolMap.roles.map((role) => `${role.name}: ${role.source}`)}
                  empty="No roles detected yet."
                />
                <TreeGroup
                  title="Parser warnings"
                  items={workspace.protocolMap.parserWarnings}
                  empty="No parser warnings."
                />
              </div>
            </div>
          </section>
        )}

        {activeBoard === "intent" && (
          <section className="section-block wide">
            <div className="section-heading">
              <p className="eyebrow">Human approval required</p>
              <h3>Intent Board</h3>
            </div>
            <div className="action-row">
              <button className="primary-action" onClick={refreshClaimSuggestions} type="button">
                Generate suggestions
              </button>
              <button className="secondary-action" onClick={generateInvariantProperties} type="button">
                Generate invariants
              </button>
            </div>
            <div className="card-grid">
              {workspace.claims.length === 0 ? (
                <EmptyState text="No claims yet. ProofBoard will propose claims, but humans approve intent." />
              ) : (
                workspace.claims.map((claim) => (
                  <article className="claim-card" key={claim.id}>
                    <div className="card-title-row">
                      <strong>{claim.title}</strong>
                      <StatusPill label={claim.status} />
                    </div>
                    <textarea
                      className="claim-editor"
                      onChange={(event) => updateClaimText(claim.id, event.target.value)}
                      value={claim.text}
                    />
                    <span>Source: {claim.source.join(", ")}</span>
                    <span>Confidence: {Math.round(claim.confidence * 100)}% / Severity: {claim.severity}</span>
                    <div className="inline-actions">
                      <button type="button" onClick={() => updateClaimStatus(claim.id, "Human-approved")}>
                        Approve
                      </button>
                      <button type="button" onClick={() => updateClaimStatus(claim.id, "Rejected")}>
                        Reject
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {activeBoard === "invariants" && (
          <section className="section-block wide">
            <div className="section-heading">
              <p className="eyebrow">Candidate properties</p>
              <h3>Invariant Board</h3>
            </div>
            <div className="action-row">
              <button className="primary-action" onClick={generateInvariantProperties} type="button">
                Generate from approved claims
              </button>
            </div>
            <div className="stack">
              {workspace.properties.length === 0 ? (
                <EmptyState text="Approved claims will become candidate invariants here." />
              ) : (
                workspace.properties.map((property) => (
                  <article className="property-row" key={property.id}>
                    <div className="status-stack">
                      <StatusPill label={property.status} />
                      <StatusPill label={property.verificationLevel} />
                      <StatusPill label={property.skepticStatus} />
                    </div>
                    <div className="property-copy">
                      <p>{property.text}</p>
                      <ul className="finding-list">
                        {property.skepticFindings.map((finding) => (
                          <li key={finding}>{finding}</li>
                        ))}
                      </ul>
                    </div>
                    <strong>Next: {property.nextAction}</strong>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {activeBoard === "assumptions" && (
          <section className="section-block wide">
            <div className="section-heading">
              <p className="eyebrow">First-class risk</p>
              <h3>Assumption Debt Board</h3>
            </div>
            <div className="action-row">
              <button className="primary-action" onClick={refreshClaimSuggestions} type="button">
                Refresh assumptions
              </button>
              <label className="compact-label">
                Filter
                <select
                  onChange={(event) => setAssumptionFilter(event.target.value as typeof assumptionFilter)}
                  value={assumptionFilter}
                >
                  {assumptionFilterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="card-grid">
              {visibleAssumptions.length === 0 ? (
                <EmptyState text="No assumptions recorded yet." />
              ) : (
                visibleAssumptions.map((assumption) => (
                  <article className="claim-card" key={assumption.id}>
                    <div className="card-title-row">
                      <strong>{assumption.text}</strong>
                      <StatusPill label={assumption.status} />
                    </div>
                    <p>{assumption.whyItMatters}</p>
                    <span>Severity: {assumption.severity}</span>
                    <span>Functions: {assumption.relatedFunctions.length > 0 ? assumption.relatedFunctions.join(", ") : "Unlinked"}</span>
                    <span>Properties: {assumption.relatedProperties.length > 0 ? assumption.relatedProperties.join(", ") : "Unlinked"}</span>
                    <label className="compact-label">
                      Status
                      <select
                        onChange={(event) => updateAssumptionStatus(assumption.id, event.target.value as AssumptionStatus)}
                        value={assumption.status}
                      >
                        {assumptionStatusOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))
              )}
            </div>
          </section>
        )}

        {activeBoard === "ledger" && (
          <section className="section-block wide">
            <div className="section-heading">
              <p className="eyebrow">Evidence over confidence</p>
              <h3>Verification Ledger</h3>
            </div>
            <div className="ledger-table">
              <div className="ledger-head">
                <span>Property</span>
                <span>Source</span>
                <span>Status</span>
                <span>Evidence</span>
                <span>Assumptions</span>
                <span>Risk</span>
                <span>Next action</span>
              </div>
              {ledgerRows.length === 0 ? (
                <EmptyState text="No ledger entries yet." />
              ) : (
                ledgerRows.map(({ property, claim, assumptions, evidence }) => (
                  <div className="ledger-row" key={property.id}>
                    <div className="ledger-cell">
                      <strong>{property.text}</strong>
                      <span>{property.skepticStatus}</span>
                    </div>
                    <div className="ledger-cell">
                      <span>{claim?.title ?? "Unlinked claim"}</span>
                      <span>{claim?.status ?? "No claim"}</span>
                    </div>
                    <div className="status-stack">
                      <StatusPill label={property.verificationLevel} />
                      <StatusPill label={property.status} />
                    </div>
                    <div className="ledger-cell">
                      <span>{summarizeEvidence(evidence)}</span>
                      <span>{evidence.length > 0 ? evidence.map((item) => item.source).join(", ") : "No evidence attached"}</span>
                    </div>
                    <div className="ledger-cell">
                      <span>{assumptions.length} linked</span>
                      <span>{assumptions.map((assumption) => assumption.status).join(", ") || "None"}</span>
                    </div>
                    <StatusPill label={property.risk} />
                    <span>{property.nextAction}</span>
                  </div>
                ))
              )}
            </div>
            <div className="status-timeline">
              {["claimed_only", "human_approved", "test_generated", "fuzzed_passed", "fuzzed_failed", "weak_or_vacuous", "out_of_scope"].map((level) => (
                <span key={level}>{level}</span>
              ))}
            </div>
          </section>
        )}

        {activeBoard === "harness" && (
          <section className="section-block wide">
            <div className="section-heading">
              <p className="eyebrow">Generated Foundry scaffold</p>
              <h3>Harness Preview</h3>
            </div>
            <div className="action-row">
              <button className="primary-action" onClick={downloadHarnessBundle} type="button">
                Download bundle
              </button>
              <code>{harnessBundle.suggestedCommand}</code>
            </div>
            <div className="harness-layout">
              <div className="harness-file-list" aria-label="Generated harness files">
                {harnessBundle.files.map((file) => (
                  <button
                    className={selectedHarnessFile?.path === file.path ? "harness-file active" : "harness-file"}
                    key={file.path}
                    onClick={() => setSelectedHarnessPath(file.path)}
                    type="button"
                  >
                    <span>{file.path}</span>
                    <small>{file.propertyIds.length > 0 ? file.propertyIds.join(", ") : "support artifact"}</small>
                  </button>
                ))}
              </div>
              <div className="harness-viewer">
                <div className="card-title-row">
                  <strong>{selectedHarnessFile?.path}</strong>
                  <StatusPill label="scaffold code" />
                </div>
                <pre className="code-preview">{selectedHarnessFile?.content ?? "No generated file selected."}</pre>
              </div>
            </div>
            <div className="setup-list">
              {harnessBundle.setupInstructions.map((instruction) => (
                <span key={instruction}>{instruction}</span>
              ))}
            </div>
          </section>
        )}

        {activeBoard === "results" && (
          <CodePreview
            eyebrow="Manual verification input"
            title="Foundry Results"
            code={`[PASS] invariant_redeemableAssetsRespectShares()\n[FAIL] invariant_donationDoesNotInflateShares()\nCounterexample: attacker donates before first depositor`}
          />
        )}

        {activeBoard === "export" && (
          <section className="section-block wide">
            <div className="section-heading">
              <p className="eyebrow">Audit prep packet</p>
              <h3>Export</h3>
            </div>
            <div className="export-grid">
              {[
                "proofboard-report.md",
                "proofboard-ledger.json",
                "assumption-debt.md",
                "protocol-map.json",
                "approved-properties.json",
                "generated-foundry-invariants.zip",
                "audit-prep.md"
              ].map((item) => (
                <div className="export-item" key={item}>{item}</div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PrinciplePanel() {
  return (
    <aside className="section-block principle-panel">
      <div className="section-heading">
        <p className="eyebrow">Operating principle</p>
        <h3>AI proposes. Humans approve. Tools produce evidence.</h3>
      </div>
      <p>
        ProofBoard keeps generated claims, approved protocol intent, unresolved assumptions, and verification evidence separate.
      </p>
      <div className="principle-list">
        <span>ERC4626 first</span>
        <span>No safety guarantees</span>
        <span>Assumptions stay visible</span>
        <span>Evidence beats confidence</span>
      </div>
    </aside>
  );
}

function TreeGroup({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="tree-group">
      <strong>{title}</strong>
      {items.length === 0 ? <span>{empty}</span> : items.map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  return <span className="status-pill">{label}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>;
}

function CodePreview({ eyebrow, title, code }: { eyebrow: string; title: string; code: string }) {
  return (
    <section className="section-block wide">
      <div className="section-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
      <pre className="code-preview">{code}</pre>
    </section>
  );
}

function mergeClaims(existing: Claim[], suggested: Claim[]) {
  const existingById = new Map(existing.map((claim) => [claim.id, claim]));
  return suggested.map((claim) => existingById.get(claim.id) ?? claim);
}

function mergeProperties(existing: Property[], generated: Property[]) {
  const generatedIds = new Set(generated.map((property) => property.id));
  return [...existing.filter((property) => !generatedIds.has(property.id)), ...generated];
}

function mergeAssumptions(existing: Assumption[], suggested: Assumption[]) {
  const existingById = new Map(existing.map((assumption) => [assumption.id, assumption]));
  const merged = [...existing];

  suggested.forEach((assumption) => {
    if (!existingById.has(assumption.id)) {
      merged.push(assumption);
    }
  });

  return merged;
}

function summarizeEvidence(evidence: Workspace["evidence"]) {
  if (evidence.length === 0) {
    return "None";
  }

  const strongest = evidence.reduce((current, next) => (evidenceRank(next.strength) > evidenceRank(current.strength) ? next : current));
  return `${strongest.strength} evidence`;
}

function evidenceRank(strength: Workspace["evidence"][number]["strength"]) {
  return {
    none: 0,
    weak: 1,
    medium: 2,
    strong: 3
  }[strength];
}
