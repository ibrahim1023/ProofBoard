"use client";

import { useMemo, useState } from "react";
import { demoWorkspace, emptyWorkspace } from "@/lib/demo-workspace";
import type { BoardId, ProtocolType, Workspace } from "@proofboard/shared-types";

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

export function ProofboardWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>(demoWorkspace);
  const [activeBoard, setActiveBoard] = useState<BoardId>("upload");
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
        return { property, claim };
      }),
    [workspace.claims, workspace.properties]
  );

  function updateField(field: "name" | "description" | "solidity", value: string) {
    setWorkspace((current) => {
      if (field === "solidity") {
        const [firstSource, ...remainingSources] = current.sources;

        return {
          ...current,
          sources: [
            {
              id: firstSource?.id ?? "source_inline",
              path: firstSource?.path ?? "src/Vault.sol",
              language: "solidity",
              content: value
            },
            ...remainingSources
          ]
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
                    <p>{claim.text}</p>
                    <span>Source: {claim.source.join(", ")}</span>
                    <span>Confidence: {Math.round(claim.confidence * 100)}% / Severity: {claim.severity}</span>
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
            <div className="stack">
              {workspace.properties.length === 0 ? (
                <EmptyState text="Approved claims will become candidate invariants here." />
              ) : (
                workspace.properties.map((property) => (
                  <article className="property-row" key={property.id}>
                    <StatusPill label={property.verificationLevel} />
                    <p>{property.text}</p>
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
            <div className="card-grid">
              {workspace.assumptions.length === 0 ? (
                <EmptyState text="No assumptions recorded yet." />
              ) : (
                workspace.assumptions.map((assumption) => (
                  <article className="claim-card" key={assumption.id}>
                    <div className="card-title-row">
                      <strong>{assumption.text}</strong>
                      <StatusPill label={assumption.status} />
                    </div>
                    <p>{assumption.whyItMatters}</p>
                    <span>Severity: {assumption.severity}</span>
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
                <span>Assumptions</span>
                <span>Next action</span>
              </div>
              {ledgerRows.length === 0 ? (
                <EmptyState text="No ledger entries yet." />
              ) : (
                ledgerRows.map(({ property, claim }) => (
                  <div className="ledger-row" key={property.id}>
                    <span>{property.text}</span>
                    <span>{claim?.title ?? "Unlinked claim"}</span>
                    <StatusPill label={property.verificationLevel} />
                    <span>{property.assumptions.length} linked</span>
                    <span>{property.nextAction}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeBoard === "harness" && (
          <CodePreview
            eyebrow="Generated Foundry scaffold"
            title="Harness Preview"
            code={`contract ProofboardVaultInvariant is Test {\n    VaultHandler handler;\n\n    function invariant_redeemableAssetsRespectShares() public {\n        handler.assertRedeemableAssetsRespectShares();\n    }\n}`}
          />
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
