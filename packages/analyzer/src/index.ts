import type {
  AssetFlow,
  Contract,
  ContractEvent,
  ContractModifier,
  ExternalCall,
  FunctionFlow,
  FunctionVisibility,
  ProtocolFunction,
  ProtocolMap,
  Role,
  SourceFile,
  StateVariable,
  TokenDependency
} from "@proofboard/shared-types";

const visibilityPattern = "(public|external|internal|private)";
const solidityTypePattern =
  "(?:address|bool|string|bytes\\d*|uint\\d*|int\\d*|IERC20|ERC20|mapping\\s*\\([^;]+\\)|[A-Z][A-Za-z0-9_]*(?:\\[\\])?)";

export function analyzeSoliditySource(source: SourceFile): ProtocolMap {
  if (source.language !== "solidity") {
    return emptyMap([`Unsupported source language: ${source.language}.`]);
  }

  const parserWarnings: string[] = [
    "Static regex parser is approximate; confirm findings before treating them as evidence."
  ];
  detectUnsupportedSyntax(source.content, parserWarnings);
  const contracts = extractContracts(source, parserWarnings);
  const externalCalls = contracts.flatMap((contract) => contract.externalCalls);
  const allFunctions = contracts.flatMap((contract) => contract.functions);
  const privilegedFunctions = allFunctions.filter((fn) => fn.flow === "privileged");
  const userFlows = allFunctions.filter((fn) => fn.flow === "user");
  const criticalState = contracts.flatMap((contract) => contract.stateVariables);
  const roles = detectRoles(contracts, privilegedFunctions);
  const assetFlows = detectAssetFlows(allFunctions);
  const tokenDependencies = detectTokenDependencies(source.content, contracts);

  if (contracts.length === 0) {
    parserWarnings.push("No contracts were detected in the supplied Solidity source.");
  }

  return {
    contracts,
    roles,
    criticalState,
    assetFlows,
    externalCalls,
    privilegedFunctions,
    userFlows,
    tokenDependencies,
    parserWarnings
  };
}

function emptyMap(parserWarnings: string[]): ProtocolMap {
  return {
    contracts: [],
    roles: [],
    criticalState: [],
    assetFlows: [],
    externalCalls: [],
    privilegedFunctions: [],
    userFlows: [],
    tokenDependencies: [],
    parserWarnings
  };
}

function extractContracts(source: SourceFile, parserWarnings: string[]): Contract[] {
  const contracts: Contract[] = [];
  const contractPattern = /contract\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+is\s+([^{]+))?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = contractPattern.exec(source.content)) !== null) {
    const [, name, inheritsRaw] = match;
    const bodyStart = match.index + match[0].length - 1;
    const bodyEnd = findMatchingBrace(source.content, bodyStart);

    if (bodyEnd === -1) {
      parserWarnings.push(`Could not find closing brace for contract ${name}.`);
      continue;
    }

    const contractId = makeId("contract", name);
    const body = source.content.slice(bodyStart + 1, bodyEnd);
    const inherits = inheritsRaw ? splitTopLevel(inheritsRaw).map(normalizeInheritance).filter(Boolean) : [];
    const functions = extractFunctions(body, contractId);
    const stateVariables = extractStateVariables(body, contractId);
    const events = extractEvents(body, contractId);
    const modifiers = extractModifiers(body, contractId);
    const externalCalls = extractExternalCalls(body, contractId, functions);

    contracts.push({
      id: contractId,
      name,
      path: source.path,
      inherits,
      functions,
      stateVariables,
      events,
      modifiers,
      externalCalls
    });

    contractPattern.lastIndex = bodyEnd + 1;
  }

  return contracts;
}

function extractFunctions(body: string, contractId: string): ProtocolFunction[] {
  const functions: ProtocolFunction[] = [];
  const functionPattern = /function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)([^{;]*)/g;
  let match: RegExpExecArray | null;

  while ((match = functionPattern.exec(body)) !== null) {
    const [, name, paramsRaw, tailRaw] = match;
    const tail = normalizeWhitespace(tailRaw);
    const visibility = extractVisibility(tail);
    const modifiers = extractFunctionModifiers(tail);
    const signature = `${name}(${normalizeWhitespace(paramsRaw)})`;

    functions.push({
      id: makeId("function", `${contractId}_${name}`),
      contractId,
      name,
      signature,
      visibility,
      flow: inferFunctionFlow(name, tail, modifiers),
      modifiers,
      notes: describeFunction(name, modifiers)
    });
  }

  return functions;
}

function extractStateVariables(body: string, contractId: string): StateVariable[] {
  const variables: StateVariable[] = [];
  const statePattern = new RegExp(
    `^\\s*(${solidityTypePattern})\\s+((?:(?:public|external|internal|private|constant|immutable)\\s+)*)` +
      `([A-Za-z_][A-Za-z0-9_]*)\\s*(?:=\\s*[^;]+)?;`,
    "gm"
  );
  let match: RegExpExecArray | null;

  while ((match = statePattern.exec(body)) !== null) {
    const [, type, qualifiersRaw, name] = match;
    if (["return", "require", "if", "for", "while"].includes(type)) {
      continue;
    }
    const visibilityRaw = qualifiersRaw
      .trim()
      .split(/\s+/)
      .find((qualifier) => ["public", "external", "internal", "private"].includes(qualifier));

    variables.push({
      id: makeId("state", `${contractId}_${name}`),
      contractId,
      name,
      type: normalizeWhitespace(type),
      visibility: (visibilityRaw as FunctionVisibility | undefined) ?? "default"
    });
  }

  return variables;
}

function extractEvents(body: string, contractId: string): ContractEvent[] {
  return [...body.matchAll(/event\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*;/g)].map((match) => ({
    id: makeId("event", `${contractId}_${match[1]}`),
    contractId,
    name: match[1],
    signature: `${match[1]}(${normalizeWhitespace(match[2])})`
  }));
}

function extractModifiers(body: string, contractId: string): ContractModifier[] {
  return [...body.matchAll(/modifier\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)?/g)].map((match) => ({
    id: makeId("modifier", `${contractId}_${match[1]}`),
    contractId,
    name: match[1],
    signature: `${match[1]}(${normalizeWhitespace(match[2] ?? "")})`
  }));
}

function extractExternalCalls(body: string, contractId: string, functions: ProtocolFunction[]): ExternalCall[] {
  const calls: ExternalCall[] = [];
  const callPattern = /([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(([^;]*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = callPattern.exec(body)) !== null) {
    const [, target, method, args] = match;
    const beforeCall = body.slice(0, match.index);
    const functionName = findContainingFunctionName(beforeCall);
    const functionId = functions.find((fn) => fn.name === functionName)?.id;

    calls.push({
      id: makeId("external", `${contractId}_${target}_${method}_${calls.length}`),
      contractId,
      functionId,
      target,
      expression: `${target}.${method}(${normalizeWhitespace(args)})`
    });
  }

  return calls;
}

function detectRoles(contracts: Contract[], privilegedFunctions: ProtocolFunction[]): Role[] {
  const roles: Role[] = [];
  const ownerFunctions = privilegedFunctions.filter((fn) => fn.modifiers.some((modifier) => modifier.toLowerCase().includes("owner")));

  if (ownerFunctions.length > 0 || contracts.some((contract) => contract.inherits.includes("Ownable"))) {
    roles.push({
      id: "role_owner",
      name: "owner",
      source: "Ownable inheritance or onlyOwner-style modifiers",
      privilegedFunctions: ownerFunctions.map((fn) => fn.id)
    });
  }

  const adminFunctions = privilegedFunctions.filter((fn) =>
    fn.modifiers.some((modifier) => modifier.toLowerCase().includes("admin") || modifier.toLowerCase().includes("role"))
  );

  if (adminFunctions.length > 0) {
    roles.push({
      id: "role_admin",
      name: "admin",
      source: "Admin or role-gated modifiers",
      privilegedFunctions: adminFunctions.map((fn) => fn.id)
    });
  }

  return roles;
}

function detectAssetFlows(functions: ProtocolFunction[]): AssetFlow[] {
  return functions
    .filter((fn) => canonicalAssetFlowName(fn.name) !== undefined || fn.flow === "privileged")
    .map((fn) => ({
      id: makeId("flow", fn.name),
      name: fn.name,
      kind: inferAssetFlowKind(fn.name, fn.flow),
      functions: [fn.id],
      assets: ["underlying ERC20"],
      notes: fn.flow === "privileged" ? "Privileged flow that may affect protocol policy." : `User-facing ${fn.name} asset flow.`
    }));
}

function detectTokenDependencies(source: string, contracts: Contract[]): TokenDependency[] {
  const dependencies: TokenDependency[] = [];
  const inheritsErc4626 = contracts.some((contract) => contract.inherits.some((item) => item.includes("ERC4626")));
  const mentionsErc20 = /\bIERC20\b|\bERC20\b|asset\(\)|underlying/i.test(source);

  if (inheritsErc4626 || mentionsErc20) {
    dependencies.push({
      id: "token_underlying",
      name: "underlyingToken",
      source: inheritsErc4626 ? "ERC4626 inheritance" : "ERC20 reference",
      assumptions: ["standard ERC20 behavior", "no fee-on-transfer behavior", "no rebasing behavior"]
    });
  }

  return dependencies;
}

function inferFunctionFlow(name: string, tail: string, modifiers: string[]): FunctionFlow {
  const normalizedName = name.toLowerCase();
  const normalizedTail = tail.toLowerCase();
  const modifierText = modifiers.join(" ").toLowerCase();

  if (normalizedTail.includes(" view") || normalizedTail.includes(" pure")) {
    return "view";
  }

  if (modifierText.includes("owner") || modifierText.includes("admin") || modifierText.includes("role")) {
    return "privileged";
  }

  if (canonicalAssetFlowName(normalizedName)) {
    return "user";
  }

  if (normalizedName.startsWith("set") || normalizedName.includes("pause") || normalizedName.includes("admin")) {
    return "privileged";
  }

  return "internal";
}

function inferAssetFlowKind(name: string, flow: FunctionFlow): AssetFlow["kind"] {
  const canonicalName = canonicalAssetFlowName(name);
  if (canonicalName) {
    return canonicalName;
  }
  if (flow === "privileged") {
    return "privileged";
  }
  return "unknown";
}

function extractVisibility(tail: string): FunctionVisibility {
  const match = new RegExp(`\\b${visibilityPattern}\\b`).exec(tail);
  return (match?.[1] as FunctionVisibility | undefined) ?? "public";
}

function extractFunctionModifiers(tail: string): string[] {
  const ignored = new Set(["public", "external", "internal", "private", "view", "pure", "virtual", "override", "returns", "payable"]);
  return tail
    .split(/\s+/)
    .map((token) => token.replace(/\(.*/, "").trim())
    .filter((token) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(token))
    .filter((token) => !ignored.has(token));
}

function findContainingFunctionName(beforeCall: string): string | undefined {
  const matches = [...beforeCall.matchAll(/function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)];
  return matches.at(-1)?.[1];
}

function findMatchingBrace(input: string, openBraceIndex: number): number {
  let depth = 0;

  for (let index = openBraceIndex; index < input.length; index += 1) {
    const char = input[index];
    if (char === "{") {
      depth += 1;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function describeFunction(name: string, modifiers: string[]) {
  const modifierNote = modifiers.length > 0 ? ` Uses modifiers: ${modifiers.join(", ")}.` : "";
  const normalized = name.toLowerCase();

  if (canonicalAssetFlowName(normalized)) {
    return `User-facing protocol asset movement flow.${modifierNote}`;
  }

  if (normalized.includes("pause")) {
    return `Emergency or availability control flow.${modifierNote}`;
  }

  if (normalized.startsWith("set")) {
    return `Configuration update flow.${modifierNote}`;
  }

  return `Detected Solidity function.${modifierNote}`;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function detectUnsupportedSyntax(source: string, parserWarnings: string[]) {
  const warnings: Array<[RegExp, string]> = [
    [/\binterface\s+[A-Za-z_]/, "Interfaces are not analyzed as protocol contracts by the current static parser."],
    [/\blibrary\s+[A-Za-z_]/, "Libraries are not analyzed as protocol contracts by the current static parser."],
    [/\bassembly\s*\{/, "Inline assembly is not interpreted by the current static parser."],
    [
      /\.(?:call|delegatecall|staticcall)\s*(?:\{|\()/,
      "Low-level call targets and calldata are not fully resolved by the current static parser."
    ]
  ];

  warnings.forEach(([pattern, warning]) => {
    if (pattern.test(source)) {
      parserWarnings.push(warning);
    }
  });
}

function splitTopLevel(value: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "(") {
      depth += 1;
    } else if (value[index] === ")") {
      depth = Math.max(0, depth - 1);
    } else if (value[index] === "," && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function normalizeInheritance(value: string) {
  return value.replace(/\s*\(.*\)\s*$/, "").trim();
}

function canonicalVaultFlowName(name: string): AssetFlow["kind"] | undefined {
  const normalized = name.toLowerCase();
  return (["deposit", "mint", "withdraw", "redeem"] as const).find((flow) => normalized === flow || normalized.startsWith(flow));
}

function canonicalAssetFlowName(name: string): AssetFlow["kind"] | undefined {
  const vaultFlow = canonicalVaultFlowName(name);
  if (vaultFlow) {
    return vaultFlow;
  }

  const normalized = name.toLowerCase();
  if (normalized === "stake" || normalized.startsWith("stake")) {
    return "stake";
  }
  if (normalized === "unstake" || normalized.startsWith("unstake")) {
    return "unstake";
  }
  if (normalized.includes("claimreward") || normalized.includes("getreward")) {
    return "claim_rewards";
  }
  if (normalized === "supply" || normalized.startsWith("supply") || normalized.includes("depositcollateral")) {
    return "supply";
  }
  if (normalized === "borrow" || normalized.startsWith("borrow")) {
    return "borrow";
  }
  if (normalized === "repay" || normalized.startsWith("repay")) {
    return "repay";
  }
  if (normalized === "liquidate" || normalized.startsWith("liquidat")) {
    return "liquidate";
  }
  if (normalized.includes("addliquidity") || normalized === "mintliquidity") {
    return "add_liquidity";
  }
  if (normalized.includes("removeliquidity") || normalized === "burnliquidity") {
    return "remove_liquidity";
  }
  if (normalized === "swap" || normalized.startsWith("swap")) {
    return "swap";
  }
  if (normalized.includes("sendmessage") || normalized.includes("dispatchmessage") || normalized.includes("bridgeout")) {
    return "send_message";
  }
  if (normalized.includes("receivemessage") || normalized.includes("relaymessage") || normalized.includes("bridgein")) {
    return "receive_message";
  }
  if (normalized.includes("finalizemessage") || normalized.includes("finalizewithdrawal")) {
    return "finalize_message";
  }
  if (normalized === "propose" || normalized.startsWith("propose")) {
    return "propose";
  }
  if (normalized === "vote" || normalized.startsWith("castvote")) {
    return "vote";
  }
  if (normalized === "queue" || normalized.startsWith("queue")) {
    return "queue";
  }
  if (normalized === "execute" || normalized.startsWith("execute")) {
    return "execute";
  }
  if (normalized.includes("upgradeto") || normalized.includes("upgradeimplementation")) {
    return "upgrade";
  }
  return undefined;
}

function makeId(prefix: string, value: string) {
  return `${prefix}_${value.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase()}`;
}
