import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { ROOT, listVersions, projectPaths, versionPaths, type VersionPaths } from "./paths.js";
import { readMeta, updateMeta } from "./project.js";

/**
 * Publish rendered versions as GitHub Releases: tag `<slug>-v<N>`, assets =
 * final.mp4 + contact.png + qa.json + manifest.json. Renders never go into git
 * history; a release asset has a stable URL and no clone cost.
 */

export interface PublishResult {
  slug: string;
  version: number;
  tag: string;
  releaseUrl: string;
  videoUrl: string;
  uploaded: string[];
  skipped: string[];
}

interface Repo {
  owner: string;
  name: string;
}

async function repoFromGit(): Promise<Repo> {
  const { stdout } = await execa("git", ["remote", "get-url", "origin"], { cwd: ROOT });
  const m = /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/.exec(stdout.trim());
  if (!m) throw new Error(`origin is not a GitHub remote: ${stdout.trim()}`);
  return { owner: m[1]!, name: m[2]! };
}

/** GITHUB_TOKEN → `gh auth token` → the token git already stores for github.com. */
async function githubToken(): Promise<string> {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  const gh = await execa("gh", ["auth", "token"], { reject: false, shell: process.platform === "win32" });
  if (gh.exitCode === 0 && gh.stdout.trim()) return gh.stdout.trim();
  const cred = await execa("git", ["credential", "fill"], { input: "protocol=https\nhost=github.com\n\n", reject: false });
  const pw = cred.stdout.split(/\r?\n/).find((l) => l.startsWith("password="))?.slice("password=".length);
  if (pw) return pw;
  throw new Error("no GitHub token: set GITHUB_TOKEN, run `gh auth login`, or push once over HTTPS so git stores a credential");
}

async function gh<T>(token: string, url: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body: T;
  try {
    body = JSON.parse(text) as T;
  } catch {
    body = text as unknown as T;
  }
  return { status: res.status, body };
}

interface Release {
  id: number;
  html_url: string;
  upload_url: string;
  assets: { name: string; browser_download_url: string }[];
}

const MIME: Record<string, string> = { ".mp4": "video/mp4", ".png": "image/png", ".json": "application/json" };

export async function publishVersion(slug: string, n?: number, opts: { log?: (l: string) => void } = {}): Promise<PublishResult> {
  const log = opts.log ?? (() => {});
  const p = projectPaths(slug);
  const meta = readMeta(p);
  if (!meta) throw new Error(`no project "${slug}"`);
  const versions = listVersions(p);
  if (!versions.length) throw new Error(`"${slug}" has no rendered versions`);
  const v: VersionPaths = versionPaths(p, n ?? versions[versions.length - 1]!);
  if (!existsSync(v.finalMp4)) throw new Error(`no final.mp4 in ${v.dir}`);

  const repo = await repoFromGit();
  const token = await githubToken();
  const api = `https://api.github.com/repos/${repo.owner}/${repo.name}`;
  const tag = `${slug}-v${v.n}`;
  const record = meta.versions.find((x) => x.n === v.n);
  const seconds = record?.seconds ?? 0;

  // Find or create the release for this tag.
  let rel = await gh<Release>(token, `${api}/releases/tags/${tag}`);
  if (rel.status === 404) {
    const body = [
      `**${meta.topic}** — version ${v.n}`,
      "",
      record?.note ? `> ${record.note}` : "",
      `- Duration: ${seconds.toFixed(1)} s · 1080×1920 @ 30 fps`,
      `- QA: ${record?.qaOk === true ? "pass" : record?.qaOk === false ? "FAIL" : "skipped"}`,
      `- Manifest hash: \`${record?.manifestHash ?? "?"}\``,
      `- Rendered: ${record?.at ?? "?"}`,
      "",
      `Reproduce: \`npm run vb -- build ${slug}\` with the attached manifest.json.`,
    ].join("\n");
    rel = await gh<Release>(token, `${api}/releases`, {
      method: "POST",
      body: JSON.stringify({ tag_name: tag, target_commitish: "main", name: `${meta.topic} v${v.n}`, body, draft: false, prerelease: false }),
    });
    if (rel.status !== 201) throw new Error(`create release failed (${rel.status}): ${JSON.stringify(rel.body).slice(0, 300)}`);
    log(`created release ${tag}`);
  } else if (rel.status !== 200) {
    throw new Error(`lookup release failed (${rel.status}): ${JSON.stringify(rel.body).slice(0, 300)}`);
  } else {
    log(`release ${tag} exists; uploading missing assets`);
  }

  const release = rel.body;
  const uploadBase = release.upload_url.replace(/\{.*$/, "");
  const existing = new Set(release.assets.map((a) => a.name));
  const files = [v.finalMp4, v.contactSheet, v.qaReport, v.manifestSnapshot].filter(existsSync);
  const uploaded: string[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    const name = path.basename(f);
    if (existing.has(name)) {
      skipped.push(name);
      continue;
    }
    const data = readFileSync(f);
    log(`uploading ${name} (${(statSync(f).size / 1e6).toFixed(1)} MB)…`);
    const up = await gh<{ browser_download_url: string }>(token, `${uploadBase}?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": MIME[path.extname(f)] ?? "application/octet-stream", "Content-Length": String(data.byteLength) },
      body: data,
    });
    if (up.status !== 201) throw new Error(`upload ${name} failed (${up.status}): ${JSON.stringify(up.body).slice(0, 300)}`);
    uploaded.push(name);
  }

  const videoUrl = `https://github.com/${repo.owner}/${repo.name}/releases/download/${tag}/final.mp4`;
  if (record) {
    updateMeta(p, { versions: meta.versions.map((x) => (x.n === v.n ? { ...x, publishedUrl: videoUrl } : x)) });
  }
  log(`published → ${release.html_url}`);
  return { slug, version: v.n, tag, releaseUrl: release.html_url, videoUrl, uploaded, skipped };
}

/** Publish every rendered version of every project that isn't published yet. */
export async function publishAll(opts: { log?: (l: string) => void } = {}): Promise<PublishResult[]> {
  const { readdirSync } = await import("node:fs");
  const out: PublishResult[] = [];
  const projectsDir = path.join(ROOT, "projects");
  for (const slug of readdirSync(projectsDir)) {
    const p = projectPaths(slug);
    const meta = readMeta(p);
    if (!meta) continue;
    for (const n of listVersions(p)) {
      const rec = meta.versions.find((x) => x.n === n);
      if (rec?.publishedUrl) continue;
      if (!existsSync(versionPaths(p, n).finalMp4)) continue;
      out.push(await publishVersion(slug, n, opts));
    }
  }
  return out;
}
