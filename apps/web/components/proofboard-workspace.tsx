"use client";

import { useMemo, useRef, useState } from "react";
import { analyzeSoliditySource } from "@proofboard/analyzer";
import { generateFoundryHarnessBundle } from "@proofboard/harness-generator";
import { applyFoundryOutput, parseFoundryOutput } from "@proofboard/result-parser";
import { createFoundryRunPlan, type RunnerMode } from "@proofboard/verification-runner";
import {
  claimSuggestionBoundaries,
  type ClaimSuggestionMode,
  generatePropertiesFromClaims,
  linkAssumptionsToProperties,
  suggestClaimsFromProtocolMap,
  suggestTokenAssumptions,
  validateLlmClaimEnvelope
} from "@proofboard/property-engine";
import { generateAuditExportFiles } from "@/lib/audit-packet";
import { completedDemoWorkspace, demoFoundryOutput, demoWorkspace, emptyWorkspace } from "@/lib/demo-workspace";
import { assessHarnessQuality, type HarnessQualityReport } from "@/lib/harness-quality";
import { evaluatePublicDemo, publicDemoSteps, type PublicDemoAcceptance } from "@/lib/public-demo";
import { calculateVerificationReadiness, type VerificationReadiness } from "@/lib/readiness";
import { assessInvariantVacuity, type VacuityReport } from "@/lib/vacuity";
import type {
  Assumption,
  AssumptionStatus,
  BoardId,
  Claim,
  Property,
  ProtocolType,
  ReviewAction,
  ReviewTargetType,
  Workspace
} from "@proofboard/shared-types";

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
type AssumptionReviewField = "owner" | "rationale" | "revisitBy" | "mitigation" | "acceptedRiskJustification";

const boundaryItems: Array<{ label: string; kind: BoundaryKind }> = [
  { label: "Inferred", kind: "inferred" },
  { label: "Human-approved", kind: "approved" },
  { label: "Generated", kind: "generated" },
  { label: "Executed evidence", kind: "executed" },
  { label: "Failed evidence", kind: "failed" },
  { label: "Assumption debt", kind: "assumption" },
  { label: "Accepted / out of scope", kind: "accepted" }
];

export function ProofboardWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>(demoWorkspace);
  const [activeBoard, setActiveBoard] = useState<BoardId>("upload");
  const [assumptionFilter, setAssumptionFilter] = useState<(typeof assumptionFilterOptions)[number]>("All");
  const [selectedHarnessPath, setSelectedHarnessPath] = useState("test/invariants/ProofboardVaultInvariant.t.sol");
  const [claimMode, setClaimMode] = useState<ClaimSuggestionMode>("template");
  const [llmClaimPayload, setLlmClaimPayload] = useState(`{
  "status": "insufficient_evidence",
  "reason": "Local or hosted adapter did not return source-backed claims."
}`);
  const [llmClaimNotice, setLlmClaimNotice] = useState<string[]>([]);
  const [localLlmModel, setLocalLlmModel] = useState("llama3.1:8b");
  const [localLlmBusy, setLocalLlmBusy] = useState(false);
  const [foundryOutput, setFoundryOutput] = useState(demoFoundryOutput);
  const [resultNotice, setResultNotice] = useState<string[]>([]);
  const [runnerMode, setRunnerMode] = useState<RunnerMode>("docker");
  const [runnerProjectPath, setRunnerProjectPath] = useState("/absolute/path/to/foundry-project");
  const [runnerDockerImage, setRunnerDockerImage] = useState("ghcr.io/foundry-rs/foundry:stable");
  const [runnerNotice, setRunnerNotice] = useState<string[]>([]);
  const [runnerBusy, setRunnerBusy] = useState(false);
  const runnerAbortController = useRef<AbortController | null>(null);
  const [reviewerIdentity, setReviewerIdentity] = useState("Security lead");
  const [claimCommentDrafts, setClaimCommentDrafts] = useState<Record<string, string>>({});
  const [claimRejectionDrafts, setClaimRejectionDrafts] = useState<Record<string, string>>({});
  const [propertyCommentDrafts, setPropertyCommentDrafts] = useState<Record<string, string>>({});
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
  const readiness = useMemo(() => calculateVerificationReadiness(workspace), [workspace]);
  const runnerPlan = useMemo(
    () =>
      createFoundryRunPlan(workspace, harnessBundle, {
        mode: runnerMode,
        projectPath: runnerProjectPath,
        dockerImage: runnerDockerImage
      }),
    [harnessBundle, runnerDockerImage, runnerMode, runnerProjectPath, workspace]
  );
  const auditFiles = useMemo(() => generateAuditExportFiles(workspace, harnessBundle), [harnessBundle, workspace]);
  const publicDemoAcceptance = useMemo(
    () => evaluatePublicDemo(workspace, auditFiles.map((file) => file.name)),
    [auditFiles, workspace]
  );
  const harnessQuality = useMemo(() => assessHarnessQuality(workspace, harnessBundle), [harnessBundle, workspace]);
  const vacuity = useMemo(() => assessInvariantVacuity(workspace), [workspace]);
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

  function loadCompletedDemoWorkspace() {
    setWorkspace(completedDemoWorkspace);
    setFoundryOutput(demoFoundryOutput);
    setActiveBoard("ledger");
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

  function importStructuredClaims(payload = llmClaimPayload) {
    try {
      const validated = validateLlmClaimEnvelope(JSON.parse(payload) as unknown, workspace.protocolMap);
      setLlmClaimNotice(validated.refusal ? [`Insufficient evidence: ${validated.refusal}`] : validated.issues);

      if (validated.issues.length === 0 && validated.claims.length > 0) {
        setWorkspace((current) => ({
          ...current,
          claims: mergeAdditionalClaims(current.claims, validated.claims)
        }));
      }
    } catch {
      setLlmClaimNotice(["Structured claim payload must be valid JSON."]);
    }
  }

  async function generateLocalClaims() {
    setLocalLlmBusy(true);
    setLlmClaimNotice([]);

    try {
      const response = await fetch("/api/generate-claims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: localLlmModel,
          protocolMap: workspace.protocolMap,
          sources: workspace.sources
        })
      });
      const result = (await response.json()) as {
        ok?: boolean;
        payload?: unknown;
        errors?: string[];
        model?: string;
      };

      if (!response.ok || !result.ok || result.payload === undefined) {
        setLlmClaimNotice(result.errors?.length ? result.errors : ["Local model did not return a claim payload."]);
        return;
      }

      const payload = JSON.stringify(result.payload, null, 2);
      setLlmClaimPayload(payload);
      importStructuredClaims(payload);
    } catch {
      setLlmClaimNotice(["Could not reach the local claim adapter."]);
    } finally {
      setLocalLlmBusy(false);
    }
  }

  function updateClaimStatus(claimId: string, status: Claim["status"]) {
    const action: ReviewAction = status === "Rejected" ? "rejected" : status === "Human-approved" ? "approved" : "edited";
    const note =
      status === "Rejected"
        ? claimRejectionDrafts[claimId]?.trim() || "Rejected without a recorded rationale."
        : `${status} by reviewer.`;

    setWorkspace((current) =>
      appendReviewRecord(
        {
          ...current,
          claims: current.claims.map((claim) => (claim.id === claimId ? { ...claim, status } : claim))
        },
        "claim",
        claimId,
        action,
        reviewerIdentity,
        note
      )
    );
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

  function recordClaimEdit(claimId: string, text: string) {
    setWorkspace((current) => appendReviewRecord(current, "claim", claimId, "edited", reviewerIdentity, `Edited claim text: ${text}`));
  }

  function addClaimComment(claimId: string) {
    const comment = claimCommentDrafts[claimId]?.trim();
    if (!comment) {
      return;
    }

    setWorkspace((current) => appendReviewRecord(current, "claim", claimId, "commented", reviewerIdentity, comment));
    setClaimCommentDrafts((current) => ({ ...current, [claimId]: "" }));
  }

  function addPropertyComment(propertyId: string) {
    const comment = propertyCommentDrafts[propertyId]?.trim();
    if (!comment) {
      return;
    }

    setWorkspace((current) => appendReviewRecord(current, "property", propertyId, "commented", reviewerIdentity, comment));
    setPropertyCommentDrafts((current) => ({ ...current, [propertyId]: "" }));
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

  function updateAssumptionReviewField(assumptionId: string, field: AssumptionReviewField, value: string) {
    setWorkspace((current) => ({
      ...current,
      assumptions: current.assumptions.map((assumption) => (assumption.id === assumptionId ? { ...assumption, [field]: value } : assumption))
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

  function downloadTextFile(name: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function parseResults() {
    const parsed = parseFoundryOutput(foundryOutput, workspace.properties);
    setResultNotice([...parsed.errors, ...parsed.warnings]);
    setWorkspace((current) => applyFoundryOutput(current, foundryOutput));
  }

  async function runPlannedFoundryCommand() {
    const abortController = new AbortController();
    runnerAbortController.current = abortController;
    setRunnerBusy(true);
    setRunnerNotice(["Running planned Foundry command. Captured output will still need parsing before it becomes ledger evidence."]);

    try {
      const response = await fetch("/api/run-foundry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: runnerMode,
          projectPath: runnerProjectPath,
          dockerImage: runnerMode === "docker" ? runnerDockerImage : undefined
        }),
        signal: abortController.signal
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json()) as { errors?: string[] };
        setRunnerNotice(payload.errors?.length ? payload.errors : ["Runner request failed before execution."]);
        return;
      }

      setFoundryOutput("");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = "";

      while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        lines.filter(Boolean).forEach((line) => handleRunnerStreamEvent(JSON.parse(line) as RunnerStreamEvent));
        if (done) break;
      }
    } catch {
      setRunnerNotice(
        abortController.signal.aborted
          ? ["Runner cancellation requested. Partial output remains available for review."]
          : ["Runner request failed. Confirm the local ProofBoard server is running and Docker or Forge is available."]
      );
    } finally {
      runnerAbortController.current = null;
      setRunnerBusy(false);
    }
  }

  function handleRunnerStreamEvent(event: RunnerStreamEvent) {
    if (event.type === "output") {
      setFoundryOutput((current) => current + event.chunk);
      return;
    }

    setRunnerNotice([
      `Runner finished with status ${event.execution.status}${event.execution.exitCode === undefined ? "" : ` and exit code ${event.execution.exitCode}`}.`,
      event.execution.status === "cancelled"
        ? "Partial output remains reviewable but should not be treated as completed verification evidence."
        : "Review the captured output, then parse it to update the ledger."
    ]);
  }

  function cancelFoundryRun() {
    runnerAbortController.current?.abort();
    setRunnerNotice(["Cancelling the active Foundry run. Partial output remains available for review."]);
  }

  async function uploadFoundryOutput(file?: File) {
    if (!file) {
      return;
    }

    setFoundryOutput(await file.text());
    setResultNotice([]);
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
            <Metric label="Readiness" value={readiness.score} suffix="%" />
          </div>
        </header>

        <EvidenceBoundaryLegend />

        {activeBoard === "upload" && (
          <>
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
                <button className="secondary-action" onClick={loadCompletedDemoWorkspace} type="button">
                  Load completed demo
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
            <PublicDemoPanel acceptance={publicDemoAcceptance} onLoadCompletedDemo={loadCompletedDemoWorkspace} />
          </>
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
              <label className="compact-label">
                Claim mode
                <select onChange={(event) => setClaimMode(event.target.value as ClaimSuggestionMode)} value={claimMode}>
                  {claimSuggestionBoundaries.map((boundary) => (
                    <option key={boundary.mode} value={boundary.mode}>
                      {boundary.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="compact-label">
                Reviewer
                <input onChange={(event) => setReviewerIdentity(event.target.value)} value={reviewerIdentity} />
              </label>
            </div>
            {claimMode !== "template" && (
              <div className="llm-boundary">
                <label>
                  Structured claim payload
                  <textarea
                    className="code-input boundary-input"
                    onChange={(event) => setLlmClaimPayload(event.target.value)}
                    spellCheck={false}
                    value={llmClaimPayload}
                  />
                </label>
                <div className="stack">
                  {claimMode === "local_llm" && (
                    <label>
                      Ollama model
                      <input
                        onChange={(event) => setLocalLlmModel(event.target.value)}
                        spellCheck={false}
                        value={localLlmModel}
                      />
                    </label>
                  )}
                  <div className="action-row">
                    {claimMode === "local_llm" && (
                      <button
                        className="primary-action"
                        disabled={localLlmBusy}
                        onClick={generateLocalClaims}
                        type="button"
                      >
                        {localLlmBusy ? "Generating..." : "Generate with local model"}
                      </button>
                    )}
                    <button className="primary-action" onClick={() => importStructuredClaims()} type="button">
                      Validate claim payload
                    </button>
                    <StatusPill label={claimMode === "hosted_llm" ? "optional hosted boundary" : "local adapter boundary"} />
                  </div>
                  <div className="compact-card">
                    <strong>Review gate</strong>
                    <span>Imported claims enter the board as AI-inferred and require human approval.</span>
                  </div>
                  {llmClaimNotice.length > 0 && (
                    <div className="compact-card result-notice" role="status">
                      <strong>Claim payload notes</strong>
                      {llmClaimNotice.map((notice) => (
                        <span key={notice}>{notice}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="card-grid">
              {workspace.claims.length === 0 ? (
                <EmptyState text="No claims yet. ProofBoard will propose claims, but humans approve intent." />
              ) : (
                workspace.claims.map((claim) => {
                  const claimReviews = reviewRecordsFor(workspace, "claim", claim.id);
                  return (
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
                      <label>
                        Rejection rationale
                        <textarea
                          onChange={(event) => setClaimRejectionDrafts((current) => ({ ...current, [claim.id]: event.target.value }))}
                          placeholder="Required before rejecting protocol intent"
                          value={claimRejectionDrafts[claim.id] ?? ""}
                        />
                      </label>
                      <label>
                        Claim comment
                        <textarea
                          onChange={(event) => setClaimCommentDrafts((current) => ({ ...current, [claim.id]: event.target.value }))}
                          placeholder="Reviewer note, question, or approval context"
                          value={claimCommentDrafts[claim.id] ?? ""}
                        />
                      </label>
                      <div className="inline-actions">
                        <button type="button" onClick={() => updateClaimStatus(claim.id, "Human-approved")}>
                          Approve
                        </button>
                        <button type="button" onClick={() => updateClaimStatus(claim.id, "Rejected")}>
                          Reject
                        </button>
                        <button type="button" onClick={() => recordClaimEdit(claim.id, claim.text)}>
                          Record edit
                        </button>
                        <button type="button" onClick={() => addClaimComment(claim.id)}>
                          Add comment
                        </button>
                      </div>
                      <ReviewHistory records={claimReviews} />
                    </article>
                  );
                })
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
                workspace.properties.map((property) => {
                  const propertyReviews = reviewRecordsFor(workspace, "property", property.id);
                  return (
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
                        <label>
                          Property comment
                          <textarea
                            onChange={(event) => setPropertyCommentDrafts((current) => ({ ...current, [property.id]: event.target.value }))}
                            placeholder="Reviewer note about property strength, coverage, or next action"
                            value={propertyCommentDrafts[property.id] ?? ""}
                          />
                        </label>
                        <button type="button" onClick={() => addPropertyComment(property.id)}>
                          Add property comment
                        </button>
                        <ReviewHistory records={propertyReviews} />
                      </div>
                      <strong>Next: {property.nextAction}</strong>
                    </article>
                  );
                })
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
                    <div className="assumption-review-grid">
                      <label>
                        Owner
                        <input
                          onChange={(event) => updateAssumptionReviewField(assumption.id, "owner", event.target.value)}
                          placeholder="Reviewer or team"
                          value={assumption.owner ?? ""}
                        />
                      </label>
                      <label>
                        Revisit date
                        <input
                          onChange={(event) => updateAssumptionReviewField(assumption.id, "revisitBy", event.target.value)}
                          placeholder="YYYY-MM-DD"
                          type="date"
                          value={assumption.revisitBy ?? ""}
                        />
                      </label>
                      <label>
                        Rationale
                        <textarea
                          onChange={(event) => updateAssumptionReviewField(assumption.id, "rationale", event.target.value)}
                          placeholder="Why this assumption exists"
                          value={assumption.rationale ?? ""}
                        />
                      </label>
                      <label>
                        Mitigation
                        <textarea
                          onChange={(event) => updateAssumptionReviewField(assumption.id, "mitigation", event.target.value)}
                          placeholder="Evidence, test, code change, or review step"
                          value={assumption.mitigation ?? ""}
                        />
                      </label>
                      <label className="wide-field">
                        Accepted-risk justification
                        <textarea
                          onChange={(event) => updateAssumptionReviewField(assumption.id, "acceptedRiskJustification", event.target.value)}
                          placeholder="Required when this becomes accepted risk"
                          value={assumption.acceptedRiskJustification ?? ""}
                        />
                      </label>
                    </div>
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
            <ReadinessPanel readiness={readiness} />
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
                      <InlinePills labels={assumptions.map((assumption) => assumption.status)} empty="None" />
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
            <HarnessQualityPanel report={harnessQuality} />
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
          <section className="section-block wide">
            <div className="section-heading">
              <p className="eyebrow">Verification runner and evidence input</p>
              <h3>Foundry Results</h3>
            </div>
            <div className="results-grid">
              <div className="stack">
                <div className="compact-card">
                  <strong>Runner plan</strong>
                  <span>{runnerPlan.evidenceBoundary}</span>
                  <label>
                    Runner mode
                    <select onChange={(event) => setRunnerMode(event.target.value as RunnerMode)} value={runnerMode}>
                      <option value="docker">Docker Foundry</option>
                      <option value="local">Local forge</option>
                    </select>
                  </label>
                  <label>
                    Foundry project path
                    <input onChange={(event) => setRunnerProjectPath(event.target.value)} value={runnerProjectPath} />
                  </label>
                  {runnerMode === "docker" && (
                    <label>
                      Docker image
                      <input onChange={(event) => setRunnerDockerImage(event.target.value)} value={runnerDockerImage} />
                    </label>
                  )}
                  <pre className="command-preview">{runnerPlan.command}</pre>
                  <span>Capture stdout/stderr into {runnerPlan.outputFile}, then paste or upload it below.</span>
                </div>
                <div className="compact-card result-notice">
                  <strong>Runner warnings</strong>
                  {runnerPlan.warnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                </div>
              </div>
              <label>
                Raw Foundry output
                <textarea
                  className="code-input results-input"
                  onChange={(event) => setFoundryOutput(event.target.value)}
                  spellCheck={false}
                  value={foundryOutput}
                />
              </label>
              <div className="stack">
                <div className="action-row">
                  <button className="secondary-action" disabled={runnerBusy} onClick={() => void runPlannedFoundryCommand()} type="button">
                    {runnerBusy ? "Running..." : "Run planned command"}
                  </button>
                  {runnerBusy && (
                    <button className="secondary-action" onClick={cancelFoundryRun} type="button">
                      Cancel run
                    </button>
                  )}
                  <button className="primary-action" onClick={parseResults} type="button">
                    Parse Foundry output
                  </button>
                  <label className="file-control">
                    <input
                      accept=".log,.txt"
                      onChange={(event) => void uploadFoundryOutput(event.target.files?.[0])}
                      type="file"
                    />
                    Upload output
                  </label>
                </div>
                {runnerNotice.length > 0 && (
                  <div className="compact-card result-notice" role="status">
                    <strong>Runner status</strong>
                    {runnerNotice.map((notice) => (
                      <span key={notice}>{notice}</span>
                    ))}
                  </div>
                )}
                <div className="compact-card">
                  <strong>Parsed runs</strong>
                  <span>{workspace.verificationRuns.length} preserved verification run records</span>
                  <span>{workspace.verificationRuns.at(-1)?.status ?? "No parsed run yet"}</span>
                  <span>{workspace.verificationRuns.at(-1)?.counterexamples[0] ?? "Counterexamples remain attached when Foundry reports them."}</span>
                </div>
                <VacuityPanel report={vacuity} />
                {resultNotice.length > 0 && (
                  <div className="compact-card result-notice" role="status">
                    <strong>Parser notes</strong>
                    {resultNotice.map((notice) => (
                      <span key={notice}>{notice}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeBoard === "export" && (
          <section className="section-block wide">
            <div className="section-heading">
              <p className="eyebrow">Audit prep packet</p>
              <h3>Export</h3>
            </div>
            <ReadinessPanel readiness={readiness} compact />
            <div className="export-grid">
              {auditFiles.map((file) => (
                <button
                  className="export-item export-download"
                  key={file.name}
                  onClick={() => downloadTextFile(file.name, file.content, file.mimeType)}
                  type="button"
                >
                  <strong>{file.name}</strong>
                  <span>{file.mimeType}</span>
                </button>
              ))}
            </div>
            <div className="setup-list">
              <span>Exports preserve approved claims, candidate properties, evidence, assumption debt, and suggested audit focus separately.</span>
              <span>Generated Foundry files remain scaffold artifacts until reviewed and run.</span>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

type RunnerStreamEvent =
  | { type: "output"; stream: "stdout" | "stderr"; chunk: string }
  | {
      type: "complete";
      execution: {
        status: "passed" | "failed" | "errored" | "cancelled";
        exitCode?: number;
      };
    };

function Metric({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="metric">
      <strong>{value}{suffix}</strong>
      <span>{label}</span>
    </div>
  );
}

function EvidenceBoundaryLegend() {
  return (
    <div className="boundary-legend" aria-label="Evidence boundary">
      <strong>Evidence boundary</strong>
      <div>
        {boundaryItems.map((item) => (
          <StatusPill key={item.kind} label={item.label} kind={item.kind} />
        ))}
      </div>
    </div>
  );
}

function ReadinessPanel({ readiness, compact = false }: { readiness: VerificationReadiness; compact?: boolean }) {
  return (
    <section className={compact ? "readiness-panel compact" : "readiness-panel"} aria-label="Verification readiness">
      <div className="readiness-score">
        <span>Verification readiness</span>
        <strong>{readiness.score}%</strong>
        <StatusPill label={readiness.label} />
      </div>
      <div className="readiness-detail">
        <p>{readiness.disclaimer}</p>
        {!compact && (
          <div className="readiness-factors">
            {readiness.factors.map((factor) => (
              <div className="readiness-factor" key={factor.id}>
                <div>
                  <strong>{factor.label}</strong>
                  <span>{factor.score}%</span>
                </div>
                <progress max="100" value={factor.score}>{factor.score}%</progress>
                <span>{factor.summary}</span>
              </div>
            ))}
          </div>
        )}
        <div className="readiness-actions">
          {(readiness.blockers.length > 0 ? readiness.blockers : readiness.nextActions.slice(0, 3)).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function HarnessQualityPanel({ report }: { report: HarnessQualityReport }) {
  return (
    <section className="harness-quality" aria-label="Harness quality checks">
      <div className="harness-quality-score">
        <span>Harness quality</span>
        <strong>{report.score}%</strong>
      </div>
      <div className="harness-quality-grid">
        {report.checks.map((check) => (
          <article className="harness-quality-check" key={check.id}>
            <div>
              <strong>{check.label}</strong>
              <StatusPill label={check.status} />
            </div>
            <p>{check.summary}</p>
            <span>{check.nextAction}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function VacuityPanel({ report }: { report: VacuityReport }) {
  return (
    <section className="vacuity-panel" aria-label="Invariant vacuity metrics">
      <div className="card-title-row">
        <strong>Vacuity review</strong>
        <StatusPill label={`${report.score}%`} />
      </div>
      <div className="vacuity-flow-row">
        <span>Touched: {report.touchedCoreFlows.join(", ") || "None visible"}</span>
        <span>Missing: {report.missingCoreFlows.join(", ") || "None detected"}</span>
      </div>
      <div className="vacuity-metrics">
        {report.invariantMetrics.length === 0 ? (
          <span>No invariant run metrics parsed yet.</span>
        ) : (
          report.invariantMetrics.map((metric) => (
            <span key={`${metric.testName}-${metric.propertyId ?? "unlinked"}`}>
              {metric.testName}: {metric.status}, runs {metric.runs ?? "?"}, calls {metric.calls ?? "?"}, reverts {metric.reverts ?? "?"}
            </span>
          ))
        )}
      </div>
      <div className="vacuity-findings">
        {report.findings.length === 0 ? (
          <span>No vacuity signals detected in preserved raw output.</span>
        ) : (
          report.findings.map((finding) => (
            <article key={finding.id}>
              <div>
                <strong>{finding.title}</strong>
                <StatusPill label={finding.severity} />
              </div>
              <p>{finding.summary}</p>
              <span>{finding.nextAction}</span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ReviewHistory({ records }: { records: NonNullable<Workspace["reviewRecords"]> }) {
  if (records.length === 0) {
    return (
      <div className="compact-card">
        <strong>Review history</strong>
        <span>No review records yet.</span>
      </div>
    );
  }

  return (
    <div className="compact-card">
      <strong>Review history</strong>
      {records.slice(-4).map((record) => (
        <span key={record.id}>
          {record.action} by {record.reviewer}: {record.comment}
        </span>
      ))}
    </div>
  );
}

function PublicDemoPanel({
  acceptance,
  onLoadCompletedDemo
}: {
  acceptance: PublicDemoAcceptance[];
  onLoadCompletedDemo: () => void;
}) {
  return (
    <section className="section-block public-demo" aria-label="Public demo guide">
      <div className="section-heading">
        <p className="eyebrow">Public demo</p>
        <h3>ERC4626 assurance walkthrough</h3>
      </div>
      <div className="public-demo-grid">
        <div className="stack">
          {publicDemoSteps.map((step, index) => (
            <article className="demo-step" key={step.id}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.board}: {step.title}</strong>
                <p>{step.outcome}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="stack">
          <button className="primary-action" onClick={onLoadCompletedDemo} type="button">
            Start completed demo
          </button>
          {acceptance.map((item) => (
            <div className="compact-card" key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <StatusPill label={item.satisfied ? "Ready" : "Needs setup"} />
              </div>
              <span>{item.evidence}</span>
            </div>
          ))}
          <p className="demo-disclaimer">
            Demo readiness means the workflow and evidence boundaries are visible. It does not mean the example vault is safe.
          </p>
        </div>
      </div>
    </section>
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

function InlinePills({ labels, empty }: { labels: string[]; empty: string }) {
  return labels.length === 0 ? (
    <span>{empty}</span>
  ) : (
    <span className="inline-pill-list">
      {labels.map((label) => (
        <StatusPill key={label} label={label} />
      ))}
    </span>
  );
}

function StatusPill({ label, kind = boundaryKind(label) }: { label: string; kind?: BoundaryKind }) {
  return (
    <span className={`status-pill status-${kind}`} data-boundary={kind}>
      {label}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="empty-state">{text}</p>;
}

function mergeClaims(existing: Claim[], suggested: Claim[]) {
  const existingById = new Map(existing.map((claim) => [claim.id, claim]));
  return suggested.map((claim) => existingById.get(claim.id) ?? claim);
}

function mergeAdditionalClaims(existing: Claim[], suggested: Claim[]) {
  const existingById = new Map(existing.map((claim) => [claim.id, claim]));
  suggested.forEach((claim) => existingById.set(claim.id, existingById.get(claim.id) ?? claim));
  return [...existingById.values()];
}

function mergeProperties(existing: Property[], generated: Property[]) {
  const generatedIds = new Set(generated.map((property) => property.id));
  return [...existing.filter((property) => !generatedIds.has(property.id)), ...generated];
}

function appendReviewRecord(
  workspace: Workspace,
  targetType: ReviewTargetType,
  targetId: string,
  action: ReviewAction,
  reviewer: string,
  comment: string
): Workspace {
  const createdAt = new Date().toISOString();
  const sequence = (workspace.reviewRecords ?? []).length + 1;
  return {
    ...workspace,
    reviewRecords: [
      ...(workspace.reviewRecords ?? []),
      {
        id: `review_${targetType}_${targetId}_${sequence}_${createdAt.replace(/[^0-9]/g, "")}`,
        targetType,
        targetId,
        action,
        reviewer: reviewer.trim() || "Unassigned reviewer",
        comment,
        createdAt
      }
    ]
  };
}

function reviewRecordsFor(workspace: Workspace, targetType: ReviewTargetType, targetId: string) {
  return (workspace.reviewRecords ?? []).filter((record) => record.targetType === targetType && record.targetId === targetId);
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

type BoundaryKind =
  | "inferred"
  | "approved"
  | "generated"
  | "executed"
  | "failed"
  | "assumption"
  | "accepted"
  | "weak"
  | "risk"
  | "neutral";

function boundaryKind(label: string): BoundaryKind {
  const normalized = label.toLowerCase().replaceAll("_", " ");

  if (["ai-inferred", "ai inferred", "claimed only", "local adapter boundary", "optional hosted boundary"].includes(normalized)) {
    return "inferred";
  }

  if (["human-approved", "human approved", "edited", "approved", "strong prep", "reviewable"].includes(normalized)) {
    return "approved";
  }

  if (["draft", "generated", "test generated", "scaffold code", "scaffolded", "needs work", "not ready"].includes(normalized)) {
    return "generated";
  }

  if (["fuzzed passed", "passed", "symbolically checked", "formally proven"].includes(normalized)) {
    return "executed";
  }

  if (["fuzzed failed", "failed", "errored", "critical", "missing"].includes(normalized)) {
    return "failed";
  }

  if (
    [
      "unresolved",
      "needs test",
      "needs invariant",
      "needs symbolic check",
      "needs formal proof",
      "needs stronger actor model",
      "needs adversarial mock",
      "needs human review"
    ].includes(normalized)
  ) {
    return "assumption";
  }

  if (["accepted risk", "out of scope", "mitigated in code", "not-applicable"].includes(normalized)) {
    return "accepted";
  }

  if (["weak", "vacuous", "weak or vacuous", "partial"].includes(normalized)) {
    return "weak";
  }

  if (["low", "medium", "high", "warning", "info"].includes(normalized) || normalized.endsWith("%")) {
    return "risk";
  }

  return "neutral";
}
