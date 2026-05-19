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
    const inherits = inheritsRaw
      ? inheritsRaw
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
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
  const statePattern = new RegExp(`^\\s*(${solidityTypePattern})\\s+(?:(public|external|internal|private)\\s+)?([A-Za-z_][A-Za-z0-9_]*)\\s*(?:=\\s*[^;]+)?;`, "gm");
  let match: RegExpExecArray | null;

  while ((match = statePattern.exec(body)) !== null) {
    const [, type, visibilityRaw, name] = match;
    if (["return", "require", "if", "for", "while"].includes(type)) {
      continue;
    }

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
    .filter((fn) => ["deposit", "mint", "withdraw", "redeem"].includes(fn.name.toLowerCase()) || fn.flow === "privileged")
    .map((fn) => ({
      id: makeId("flow", fn.name),
      name: fn.name,
      kind: inferAssetFlowKind(fn.name, fn.flow),
      functions: [fn.id],
      assets: ["underlying ERC20"],
      notes: fn.flow === "privileged" ? "Privileged flow that may affect vault policy." : `ERC4626-style ${fn.name} flow.`
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

  if (["deposit", "mint", "withdraw", "redeem"].includes(normalizedName)) {
    return "user";
  }

  if (normalizedName.startsWith("set") || normalizedName.includes("pause") || normalizedName.includes("admin")) {
    return "privileged";
  }

  return "internal";
}

function inferAssetFlowKind(name: string, flow: FunctionFlow): AssetFlow["kind"] {
  const normalized = name.toLowerCase();
  if (normalized === "deposit" || normalized === "mint" || normalized === "withdraw" || normalized === "redeem") {
    return normalized;
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

  if (["deposit", "mint", "withdraw", "redeem"].includes(normalized)) {
    return `ERC4626-style user asset movement flow.${modifierNote}`;
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

function makeId(prefix: string, value: string) {
  return `${prefix}_${value.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase()}`;
}
