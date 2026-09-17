import { existsSync, writeFileSync } from "node:fs";
import { loadBrand, type Brand } from "./brand.js";
import { latestVersion, projectPaths, versionPaths } from "./paths.js";
import { loadManifest, readMeta } from "./project.js";
import type { Manifest } from "./schema/manifest.js";

/** Per-platform limits we format against. */
const YT_TITLE_MAX = 100;
const YT_TAGS_MAX = 500;
const IG_CAPTION_MAX = 2200;
const TT_CAPTION_MAX = 2200;

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

/**
 * Render the manifest's `social` block into ready-to-paste text for each platform.
 * The manifest author (the LLM) writes one title/description/tag set; this only
 * formats and enforces limits so nothing has to be retyped at upload time.
 */
export function socialMarkdown(m: Manifest, brand: Brand | null, ctx: { version: number; seconds: number; publishedUrl?: string }): string {
  const s = m.social;
  if (!s) return `# ${m.title} — v${ctx.version}\n\n_No \`social\` block in manifest.json; add one (title, description, tags, hashtags) and rerun \`vb social ${m.slug}\`._\n`;
  const hashtags = uniq([...s.hashtags, ...(brand?.defaultHashtags ?? [])]);
  const handleLine = brand ? `${brand.name} ${brand.handle}` : "";
  const ytTitle = s.title.length > YT_TITLE_MAX ? s.title.slice(0, YT_TITLE_MAX - 1) + "…" : s.title;
  const ytDescription = [s.description.trim(), "", handleLine, hashtags.join(" ")].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim();
  const ytTags = trimTags(uniq(s.tags), YT_TAGS_MAX);
  const shortCaption = [s.hook ?? firstLine(s.description), hashtags.slice(0, 8).join(" ")].join("\n\n");
  const igCaption = clamp([s.hook ?? firstLine(s.description), "", s.description.trim(), "", hashtags.join(" ")].join("\n"), IG_CAPTION_MAX);
  // TikTok has no #shorts convention; #fyp is the equivalent feed tag.
  const ttTags = uniq(["#fyp", ...hashtags.filter((h) => h.toLowerCase() !== "#shorts")]).slice(0, 6);
  const ttCaption = clamp([s.hook ?? firstLine(s.description), ttTags.join(" ")].join(" "), TT_CAPTION_MAX);
  const pinned = s.pinnedComment ? `\n## Pinned comment (all platforms)\n\n${s.pinnedComment}\n` : "";
  const link = ctx.publishedUrl ? `\nMaster: ${ctx.publishedUrl}\n` : "";
  return `# ${m.title} — v${ctx.version} (${ctx.seconds.toFixed(1)} s)
${link}
## YouTube Shorts

**Title** (${ytTitle.length}/${YT_TITLE_MAX})

${ytTitle}

**Description**

${ytDescription}

**Tags** (${ytTags.length}/${YT_TAGS_MAX} chars, comma-separated)

${ytTags}

## TikTok

${ttCaption}

## Instagram Reels

${igCaption}

## Facebook Reels

${shortCaption}
${pinned}
## Thumbnail / cover text

${s.coverText ?? s.hook ?? ""}
`;
}

/**
 * (Re)write output/v<N>/social.md for an existing version from the CURRENT
 * manifest.json and return its text. Only the copy file is touched — the
 * render itself is never modified.
 */
export function writeSocial(slug: string, version?: number): { version: number; file: string; text: string } {
  const p = projectPaths(slug);
  const v = version ? versionPaths(p, version) : latestVersion(p);
  if (!v || !existsSync(v.finalMp4)) throw new Error(`no rendered version of "${slug}"`);
  const { manifest } = loadManifest(slug);
  const meta = readMeta(p);
  const rec = meta?.versions.find((x) => x.n === v.n);
  const seconds = rec?.seconds ?? 0;
  const text = socialMarkdown(manifest, loadBrand(), { version: v.n, seconds, publishedUrl: rec?.publishedUrl });
  writeFileSync(v.social, text);
  return { version: v.n, file: v.social, text };
}

function firstLine(s: string): string {
  return s.trim().split(/\r?\n/)[0] ?? "";
}
function clamp(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
/** Keep whole tags while the comma-joined string fits YouTube's limit. */
function trimTags(tags: string[], max: number): string {
  const out: string[] = [];
  for (const t of tags) {
    const next = [...out, t].join(", ");
    if (next.length > max) break;
    out.push(t);
  }
  return out.join(", ");
}
