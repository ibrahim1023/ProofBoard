import { analyzeSoliditySource } from "@proofboard/analyzer";
import type { ProtocolMap, SourceFile } from "@proofboard/shared-types";

export const ollamaEvalDatasetVersion = "erc4626-claims-v1";

export interface OllamaEvalCase {
  id: string;
  expectedStatus: "proposed" | "insufficient_evidence";
  expectedConcepts: string[][];
  protocolMap: ProtocolMap;
  sources: SourceFile[];
}

const accountingSource = {
  id: "model_eval_accounting",
  path: "src/AccountingVault.sol",
  language: "solidity" as const,
  content: `contract AccountingVault is ERC4626 {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
      shares = previewDeposit(assets);
      _deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares) {
      shares = previewWithdraw(assets);
      _withdraw(msg.sender, receiver, owner, assets, shares);
    }
  }`
};

const controlSource = {
  id: "model_eval_controls",
  path: "src/ControlledVault.sol",
  language: "solidity" as const,
  content: `contract ControlledVault is ERC4626, Ownable {
    bool public paused;
    address public feeRecipient;

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
      require(!paused, "paused");
      shares = previewDeposit(assets);
    }

    function pause() external onlyOwner { paused = true; }
    function setFeeRecipient(address nextRecipient) external onlyOwner { feeRecipient = nextRecipient; }
  }`
};

const unsupportedSource = {
  id: "model_eval_unsupported",
  path: "notes/unsupported.txt",
  language: "text" as const,
  content: "No contract source, protocol behavior, oracle implementation, or verification evidence is available."
};

export const ollamaClaimEvalCases: OllamaEvalCase[] = [
  {
    id: "vault_accounting_claims",
    expectedStatus: "proposed",
    expectedConcepts: [
      ["deposit", "share"],
      ["withdraw", "share"]
    ],
    protocolMap: analyzeSoliditySource(accountingSource),
    sources: [accountingSource]
  },
  {
    id: "pause_and_admin_claims",
    expectedStatus: "proposed",
    expectedConcepts: [
      ["pause", "deposit"],
      ["owner", "fee"]
    ],
    protocolMap: analyzeSoliditySource(controlSource),
    sources: [controlSource]
  },
  {
    id: "unsupported_evidence_refusal",
    expectedStatus: "insufficient_evidence",
    expectedConcepts: [],
    protocolMap: emptyProtocolMap(),
    sources: [unsupportedSource]
  }
];

function emptyProtocolMap(): ProtocolMap {
  return {
    contracts: [],
    roles: [],
    criticalState: [],
    assetFlows: [],
    externalCalls: [],
    privilegedFunctions: [],
    userFlows: [],
    tokenDependencies: [],
    parserWarnings: []
  };
}
