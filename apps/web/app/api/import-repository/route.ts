import type { SourceFile } from "@proofboard/shared-types";

export const runtime = "nodejs";

const supportedExtensions = [".sol", ".md", ".txt"] as const;
const maxFiles = 40;
const maxFileBytes = 250_000;
const maxTotalBytes = 2_000_000;

interface RepositoryRequest {
  owner: string;
  repo: string;
  repositoryUrl: string;
  ref?: string;
}

interface GitTreeEntry {
  path?: string;
  type?: string;
  size?: number;
}

export async function POST(request: Request) {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return Response.json({ ok: false, errors: ["Request body must be valid JSON."] }, { status: 400 });
  }

  const parsed = parseRepositoryRequest(value);
  if (!parsed.request) {
    return Response.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  try {
    const imported = await importPublicGitHubRepository(parsed.request);
    return Response.json({ ok: true, ...imported });
  } catch (error) {
    return Response.json(
      { ok: false, errors: [error instanceof Error ? error.message : "GitHub repository import failed."] },
      { status: 502 }
    );
  }
}

export function parseRepositoryRequest(value: unknown): { request?: RepositoryRequest; errors: string[] } {
  if (!isRecord(value) || typeof value.repositoryUrl !== "string") {
    return { errors: ["repositoryUrl must be a public GitHub repository URL."] };
  }

  let url: URL;
  try {
    url = new URL(value.repositoryUrl);
  } catch {
    return { errors: ["repositoryUrl must be a public GitHub repository URL."] };
  }

  const parts = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || parts.length !== 2) {
    return { errors: ["repositoryUrl must match https://github.com/{owner}/{repository}."] };
  }

  const ref = typeof value.ref === "string" && value.ref.trim() ? value.ref.trim() : undefined;
  if (ref && !/^[A-Za-z0-9._/-]+$/.test(ref)) {
    return { errors: ["ref contains unsupported characters."] };
  }

  return {
    errors: [],
    request: {
      owner: parts[0]!,
      repo: parts[1]!,
      repositoryUrl: `https://github.com/${parts[0]}/${parts[1]}`,
      ref
    }
  };
}

async function importPublicGitHubRepository(request: RepositoryRequest) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "ProofBoard"
  };
  const repositoryResponse = await fetch(`https://api.github.com/repos/${request.owner}/${request.repo}`, { headers });
  if (!repositoryResponse.ok) {
    throw new Error(`GitHub repository lookup failed with status ${repositoryResponse.status}.`);
  }

  const repository = (await repositoryResponse.json()) as { default_branch?: string };
  const ref = request.ref ?? repository.default_branch;
  if (!ref) {
    throw new Error("GitHub repository did not expose a default branch.");
  }

  const treeResponse = await fetch(
    `https://api.github.com/repos/${request.owner}/${request.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    { headers }
  );
  if (!treeResponse.ok) {
    throw new Error(`GitHub repository tree lookup failed with status ${treeResponse.status}.`);
  }

  const tree = (await treeResponse.json()) as { tree?: GitTreeEntry[]; truncated?: boolean };
  if (tree.truncated) {
    throw new Error("GitHub repository tree is too large for bounded import.");
  }

  const entries = (tree.tree ?? [])
    .filter(
      (entry): entry is Required<Pick<GitTreeEntry, "path" | "type">> & GitTreeEntry =>
        entry.type === "blob" &&
        typeof entry.path === "string" &&
        supportedExtensions.some((extension) => entry.path!.toLowerCase().endsWith(extension)) &&
        (entry.size ?? 0) <= maxFileBytes
    )
    .slice(0, maxFiles);

  let totalBytes = 0;
  const sources: SourceFile[] = [];
  for (const entry of entries) {
    const encodedRef = ref.split("/").map(encodeURIComponent).join("/");
    const rawUrl = `https://raw.githubusercontent.com/${request.owner}/${request.repo}/${encodedRef}/${entry.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const response = await fetch(rawUrl);
    if (!response.ok) {
      throw new Error(`GitHub source download failed for ${entry.path} with status ${response.status}.`);
    }
    const content = await response.text();
    totalBytes += new TextEncoder().encode(content).byteLength;
    if (totalBytes > maxTotalBytes) {
      throw new Error("GitHub repository sources exceed the bounded import size.");
    }
    sources.push(sourceFromContent(entry.path, content));
  }

  if (!sources.some((source) => source.language === "solidity")) {
    throw new Error("GitHub repository import found no supported Solidity sources.");
  }

  return {
    repository: {
      provider: "github" as const,
      repositoryUrl: request.repositoryUrl,
      ref,
      importedAt: new Date().toISOString(),
      files: sources.map((source) => source.path)
    },
    sources
  };
}

function sourceFromContent(path: string, content: string): SourceFile {
  const lowerPath = path.toLowerCase();
  return {
    id: `source_${path.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase()}`,
    path,
    language: lowerPath.endsWith(".sol") ? "solidity" : lowerPath.endsWith(".md") ? "markdown" : "text",
    content
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
