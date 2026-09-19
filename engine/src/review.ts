import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { latestVersion, projectPaths, versionPaths, type VersionPaths } from "./paths.js";
import { loadBrand } from "./brand.js";
import { VIDEO, type Manifest, type ResolvedManifest, type ResolvedScene } from "./schema/index.js";

/**
 * Review pack: everything a (small) reviewer model needs to judge a rendered
 * version part by part — a frame strip per scene, the facts of each scene as
 * JSON, and a checklist of unit-style checks with the automatic ones already
 * decided. Written to output/v<N>/review/. Never touches the render.
 */

export interface ReviewCheck {
  id: string;
  scope: "unit" | "integration";
  area: "hook" | "structure" | "captions" | "characters" | "action" | "audio" | "packaging" | "technical";
  title: string;
  /** auto: decided here. visual: look at the named frames. ear: needs a human listening. */
  mode: "auto" | "visual" | "ear";
  result: "pass" | "fail" | "warn" | "check";
  detail: string;
  /** Scene ids / files the reviewer should look at. */
  refs: string[];
}

interface SceneFacts {
  id: string;
  index: number;
  startSec: number;
  seconds: number;
  kind: "speech" | "clip" | "silence";
  text: string;
  words: { text: string; at: number }[];
  voice: string;
  voiceFx: string;
  speed: number | null;
  speaker: string | null;
  captions: boolean;
  bare: boolean;
  layout: string;
  hero: null | { style: string; pose: string; position: string; scale: number; changes: string[]; strikes: number; shots: number; throws: number; entrance: boolean; exit: boolean; travel: boolean; jump: boolean };
  extras: { id: string; style: string; label: string | null; x: number; scale: number; pose: string; changes: string[]; ko: number | null; travel: boolean; held: string | null }[];
  props: { name: string; at: number; until: number; position: string; anim: string; exit: string }[];
  sfx: { name: string; at: number; volume: number }[];
  bubbles: { text: string; at: number; on: string | null }[];
  camera: { move: string; at: number }[];
  overlays: { kind: string; at: number; text?: string }[];
  projectiles: { from: string; to: string; at: number; hit: number; outcome: string }[];
  /** Absolute frames captured in the strip, left to right. */
  stripFrames: number[];
  strip: string;
  visualEvents: number;
  /** Dense strips around contact events (hit/strike/shot/throw): 7 frames at 2-frame spacing, centred on the event. */
  events: { label: string; frame: number; strip: string }[];
}

export interface ReviewPack {
  slug: string;
  version: number;
  title: string;
  seconds: number;
  voice: string;
  voiceFx: string;
  theme: string;
  brand: { handle: string; name: string } | null;
  social: Manifest["social"] | null;
  notes: string | null;
  scenes: SceneFacts[];
  checks: ReviewCheck[];
  qa: unknown;
  files: { dir: string; summary: string; checklist: string; contact: string; report: string; frames: string };
}

const sec = (frame: number, fps: number) => Math.round((frame / fps) * 100) / 100;

export async function buildReviewPack(slug: string, version?: number, opts: { log?: (l: string) => void } = {}): Promise<ReviewPack> {
  const log = opts.log ?? (() => {});
  const p = projectPaths(slug);
  const v = version ? versionPaths(p, version) : latestVersion(p);
  if (!v || !existsSync(v.finalMp4)) throw new Error(`no rendered version of "${slug}"`);
  const resolved = JSON.parse(readFileSync(v.resolvedSnapshot, "utf8")) as ResolvedManifest;
  const manifest = JSON.parse(readFileSync(v.manifestSnapshot, "utf8")) as Manifest;
  const qa = existsSync(v.qaReport) ? JSON.parse(readFileSync(v.qaReport, "utf8")) : null;
  const dir = path.join(v.dir, "review");
  mkdirSync(path.join(dir, "scenes"), { recursive: true });
  mkdirSync(path.join(dir, "events"), { recursive: true });
  mkdirSync(path.join(dir, "frames"), { recursive: true });
  const fps = resolved.fps;

  // Every half second of the whole video as its own image (frames/t012.5.png = 12.5 s). For debugging by eye.
  log("dumping a frame every 0.5 s…");
  await execa("ffmpeg", ["-y", "-v", "error", "-i", v.finalMp4, "-vf", "fps=2,scale=360:-1", path.join(dir, "frames", "f%04d.png")]);
  for (const name of readdirSync(path.join(dir, "frames"))) {
    const mm = /^f(\d{4})\.png$/.exec(name);
    if (mm) renameSync(path.join(dir, "frames", name), path.join(dir, "frames", `t${((Number(mm[1]) - 1) / 2).toFixed(1).padStart(5, "0")}.png`));
  }

  const scenes: SceneFacts[] = [];
  for (const [i, s] of resolved.scenes.entries()) {
    const ms = manifest.scenes[i]!;
    const rel = (f: number) => sec(f - s.startFrame, fps);
    const kind: SceneFacts["kind"] = s.isClip ? "clip" : s.words.length ? "speech" : "silence";
    const events: number[] = [];
    const push = (f: number) => {
      if (f >= s.startFrame && f < s.startFrame + s.durationInFrames) events.push(f);
    };
    s.character?.poseChanges.forEach((x) => push(x.atFrame));
    s.character?.strikes.forEach((x) => push(x.atFrame));
    s.character?.shots.forEach((x) => push(x.atFrame));
    s.character?.throws.forEach((x) => x.hops.forEach((h) => push(h.hitFrame)));
    if (s.character?.entrance) push(s.character.entrance.landFrame);
    if (s.character?.exit) push(s.character.exit.atFrame + 4);
    s.extras.forEach((e) => {
      e.poseChanges.forEach((x) => push(x.atFrame));
      if (e.koFrame !== null) push(e.koFrame + 6);
    });
    s.props.forEach((x) => push(x.atFrame + 8));
    s.projectiles.forEach((x) => push(x.hitFrame));
    s.overlays.forEach((x) => push(x.atFrame + 4));
    // Strip: start+3, up to three event frames spread through the scene, end-3.
    const uniq = [...new Set(events)].sort((a, b) => a - b);
    const picks = new Set<number>([s.startFrame + Math.min(3, s.durationInFrames - 1)]);
    if (uniq.length) {
      const idx = uniq.length <= 3 ? uniq.map((_, k) => k) : [0, Math.floor(uniq.length / 2), uniq.length - 1];
      idx.forEach((k) => picks.add(uniq[k]!));
    } else {
      picks.add(s.startFrame + Math.floor(s.durationInFrames / 2));
    }
    picks.add(s.startFrame + Math.max(0, s.durationInFrames - 4));
    const stripFrames = [...picks].sort((a, b) => a - b).slice(0, 5);
    const strip = path.join(dir, "scenes", `${String(i).padStart(2, "0")}-${s.id}.png`);
    const sel = stripFrames.map((f) => `eq(n\\,${f})`).join("+");
    log(`frames for ${s.id}: ${stripFrames.join(",")}`);
    await execa("ffmpeg", ["-y", "-v", "error", "-i", v.finalMp4, "-vf", `select='${sel}',scale=324:-1,tile=${stripFrames.length}x1:padding=6:color=black`, "-frames:v", "1", strip]);

    // Contact events → dense strips (every 2nd frame from -6 to +6) so a touch or a miss can be verified, not guessed.
    const contacts: { label: string; frame: number }[] = [];
    s.character?.strikes.forEach((x, k) => contacts.push({ label: `strike${k}`, frame: x.atFrame }));
    s.character?.shots.forEach((x, k) => contacts.push({ label: `shot${k}`, frame: x.atFrame + 5 }));
    s.character?.throws.forEach((x, k) => x.hops.forEach((h, j) => contacts.push({ label: `throw${k}-hop${j}`, frame: h.hitFrame })));
    s.projectiles.forEach((x, k) => contacts.push({ label: `ball${k}-${x.outcome}${x.outcome === "miss" ? "-" + x.path : ""}`, frame: x.hitFrame }));
    const eventStrips: SceneFacts["events"] = [];
    for (const c of contacts.slice(0, 6)) {
      const fr = [-6, -4, -2, 0, 2, 4, 6].map((d) => Math.max(s.startFrame, Math.min(s.startFrame + s.durationInFrames - 1, c.frame + d)));
      const file = path.join(dir, "events", `${String(i).padStart(2, "0")}-${s.id}-${c.label}.png`);
      const selE = [...new Set(fr)].map((f) => `eq(n\\,${f})`).join("+");
      await execa("ffmpeg", ["-y", "-v", "error", "-i", v.finalMp4, "-vf", `select='${selE}',scale=300:-1,tile=${new Set(fr).size}x1:padding=4:color=black`, "-frames:v", "1", file]);
      eventStrips.push({ label: c.label, frame: c.frame, strip: path.relative(dir, file).replace(/\\/g, "/") });
    }

    scenes.push({
      id: s.id,
      index: i,
      startSec: sec(s.startFrame, fps),
      seconds: sec(s.durationInFrames, fps),
      kind,
      text: ms.speech ?? ms.clip?.caption ?? "",
      words: s.words.map((w) => ({ text: w.text, at: rel(w.startFrame) })),
      voice: ms.voice ?? manifest.voice,
      voiceFx: ms.voiceFx ?? manifest.voiceFx,
      speed: ms.speed ?? null,
      speaker: s.speaker,
      captions: s.captions,
      bare: s.bare,
      layout: s.layout,
      hero: s.character
        ? {
            style: s.character.style,
            pose: s.character.pose,
            position: s.character.position,
            scale: s.character.scale,
            changes: s.character.poseChanges.map((x) => `${x.pose}@${rel(x.atFrame)}`),
            strikes: s.character.strikes.length,
            shots: s.character.shots.length,
            throws: s.character.throws.length,
            entrance: Boolean(s.character.entrance),
            exit: Boolean(s.character.exit),
            travel: Boolean(s.character.travel),
            jump: Boolean(s.character.jump),
          }
        : null,
      extras: s.extras.map((e) => ({ id: e.id, style: e.style, label: e.label, x: Math.round((e.x / VIDEO.width) * 100) / 100, scale: e.scale, pose: e.pose, changes: e.poseChanges.map((x) => `${x.pose}@${rel(x.atFrame)}`), ko: e.koFrame === null ? null : rel(e.koFrame), travel: Boolean(e.travel), held: e.held })),
      props: s.props.map((x) => ({ name: x.name, at: rel(x.atFrame), until: rel(x.untilFrame), position: x.position, anim: x.anim, exit: x.exit })),
      sfx: s.sfx.map((x) => ({ name: x.name, at: rel(x.atFrame), volume: x.volume })),
      bubbles: s.bubbles.map((x) => ({ text: x.text, at: rel(x.atFrame), on: (x as { on?: string | null }).on ?? null })),
      camera: s.camera.map((x) => ({ move: x.move, at: rel(x.atFrame) })),
      overlays: s.overlays.map((x) => ({ kind: x.kind, at: rel(x.atFrame), text: x.text })),
      projectiles: s.projectiles.map((x) => ({ from: x.from, to: x.to, at: rel(x.atFrame), hit: rel(x.hitFrame), outcome: x.outcome })),
      stripFrames,
      strip: path.relative(dir, strip).replace(/\\/g, "/"),
      visualEvents: uniq.length,
      events: eventStrips,
    });
  }

  const checks = runChecks(manifest, resolved, scenes, qa);
  const brand = loadBrand();
  const pack: ReviewPack = {
    slug,
    version: v.n,
    title: manifest.title,
    seconds: sec(resolved.durationInFrames, fps),
    voice: manifest.voice,
    voiceFx: manifest.voiceFx,
    theme: manifest.theme,
    brand: brand ? { handle: brand.handle, name: brand.name } : null,
    social: manifest.social ?? null,
    notes: manifest.notes ?? null,
    scenes,
    checks,
    qa,
    files: { dir, summary: path.join(dir, "summary.json"), checklist: path.join(dir, "checklist.md"), contact: v.contactSheet, report: path.join(dir, "report.md"), frames: path.join(dir, "frames") },
  };
  writeFileSync(pack.files.summary, JSON.stringify(pack, null, 2));
  writeFileSync(pack.files.checklist, checklistMarkdown(pack));
  writeFileSync(path.join(dir, "README.md"), readme(pack));
  return pack;
}

/** Unit-style checks; the automatic ones are decided, the rest tell the reviewer where to look. */
function runChecks(m: Manifest, r: ResolvedManifest, scenes: SceneFacts[], qa: { ok?: boolean; checks?: { name: string; ok: boolean; detail: string }[] } | null): ReviewCheck[] {
  const out: ReviewCheck[] = [];
  const add = (c: Omit<ReviewCheck, "refs"> & { refs?: string[] }) => out.push({ refs: [], ...c });
  const first = scenes[0]!;
  const last = scenes[scenes.length - 1]!;

  // --- technical (from QA)
  for (const c of qa?.checks ?? []) add({ id: `T-${c.name}`, scope: "unit", area: "technical", title: c.name.replace(/_/g, " "), mode: "auto", result: c.ok ? "pass" : "fail", detail: c.detail });
  add({ id: "T-length", scope: "unit", area: "technical", title: "length for Shorts", mode: "auto", result: r.durationInFrames / r.fps > 45 ? "warn" : "pass", detail: `${(r.durationInFrames / r.fps).toFixed(1)} s (target ≤ 45, cap 60)` });

  // --- hook / opening
  const bareOpen = first.bare && first.overlays.some((o) => o.kind === "spotlight") && first.overlays.some((o) => o.kind === "hook_card");
  add({ id: "H-standard-opening", scope: "unit", area: "hook", title: "standard opening (bare + spotlight + title card + one line)", mode: "auto", result: bareOpen ? "pass" : "warn", detail: bareOpen ? `"${first.text}"` : `first scene is not the standard opening (bare=${first.bare}, overlays=${first.overlays.map((o) => o.kind).join(",") || "none"})`, refs: [first.strip] });
  const hookText = first.overlays.find((o) => o.kind === "hook_card")?.text ?? m.social?.hook ?? "";
  add({ id: "H-hook-words", scope: "unit", area: "hook", title: "hook text 2–8 words, works muted", mode: "auto", result: hookText && hookText.split(/\s+/).length <= 8 ? "pass" : "warn", detail: hookText ? `"${hookText}" (${hookText.split(/\s+/).length} words)` : "no hook text", refs: [first.strip] });
  add({ id: "H-first-second", scope: "unit", area: "hook", title: "something happens in the first second", mode: "visual", result: "check", detail: `look at the first frame of ${first.id}: is the interesting thing already on screen?`, refs: [first.strip] });
  add({ id: "H-opening-speed", scope: "unit", area: "hook", title: "opening line slower than the body", mode: "auto", result: (first.speed ?? m.speed) <= m.speed ? "pass" : "warn", detail: `opening speed ${first.speed ?? m.speed} vs body ${m.speed}` });

  // --- structure / ending
  const hasCrack = scenes.some((s) => s.overlays.some((o) => ["screen_crack", "claw_marks", "batarang_stuck"].includes(o.kind)));
  const cta = last;
  const ctaOk = cta.overlays.some((o) => o.kind === "follow_card") && /follow dummy sticky/i.test(cta.text);
  add({ id: "S-screen-hit", scope: "unit", area: "structure", title: "the character hits the screen before the CTA", mode: "auto", result: hasCrack ? "pass" : "warn", detail: hasCrack ? "screen impact overlay present" : "no screen_crack / claw_marks / batarang_stuck" });
  add({ id: "S-cta", scope: "unit", area: "structure", title: "exactly one CTA, follow card, spoken", mode: "auto", result: ctaOk ? "pass" : "fail", detail: `last scene: "${cta.text}" voice ${cta.voice}`, refs: [cta.strip] });
  const ctaVoiceOk = cta.voice !== m.voice || cta.speaker !== null;
  add({ id: "S-cta-voice", scope: "unit", area: "structure", title: "CTA not in the hero's voice (narrator or a sidekick)", mode: "auto", result: ctaVoiceOk ? "pass" : "warn", detail: `CTA voice ${cta.voice}${cta.speaker ? ` spoken by ${cta.speaker}` : ""}; hero voice ${m.voice}` });
  add({ id: "S-cta-clean", scope: "unit", area: "structure", title: "nothing covers the character/card in the CTA frame", mode: "visual", result: "check", detail: "last frames of the CTA strip: card readable, character (if any) fully visible", refs: [cta.strip] });
  add({ id: "S-payoff-before-cta", scope: "integration", area: "structure", title: "payoff lands before the CTA, not after", mode: "visual", result: "check", detail: `scenes ${scenes.slice(-3, -1).map((s) => s.id).join(" → ")} then CTA` , refs: scenes.slice(-3).map((s) => s.strip) });

  // --- retention
  for (const s of scenes) {
    const per2s = s.visualEvents / Math.max(1, s.seconds / 2);
    if (s.seconds > 3 && per2s < 0.8 && !s.bare) add({ id: `R-static-${s.id}`, scope: "unit", area: "action", title: `scene "${s.id}" may feel static`, mode: "visual", result: "warn", detail: `${s.seconds}s with ${s.visualEvents} visual events`, refs: [s.strip] });
  }

  // --- captions
  const noCap = scenes.filter((s) => !s.captions && !s.bare && s.kind === "speech" && !s.overlays.some((o) => o.kind === "follow_card"));
  if (noCap.length) add({ id: "C-missing", scope: "unit", area: "captions", title: "speech scenes without captions", mode: "auto", result: "warn", detail: noCap.map((s) => s.id).join(", ") });
  add({ id: "C-readable", scope: "unit", area: "captions", title: "captions inside the safe area, not over a character's face", mode: "visual", result: "check", detail: "every strip: caption block bottom-centre, no character head under it", refs: scenes.filter((s) => s.captions && s.kind !== "silence").map((s) => s.strip) });
  add({ id: "C-emphasis", scope: "unit", area: "captions", title: "emphasis on the words that carry the idea", mode: "auto", result: m.scenes.every((s) => !s.speech || s.emphasis.length > 0 || s.speech.split(" ").length <= 2) ? "pass" : "warn", detail: m.scenes.filter((s) => s.speech && s.emphasis.length === 0 && s.speech.split(" ").length > 2).map((s) => s.id).join(", ") || "all scenes have emphasis" });

  // --- characters
  for (const s of scenes) {
    if (s.kind === "speech" && !s.hero && !s.speaker && s.voice === m.voice && !s.overlays.some((o) => o.kind === "follow_card")) {
      add({ id: `K-narrator-${s.id}`, scope: "unit", area: "characters", title: `"${s.id}": narration with no speaker on screen`, mode: "auto", result: "pass", detail: "voice-over (nobody's mouth should move)" });
    }
    if (s.kind === "speech" && s.hero && s.speaker && s.speaker !== "hero") {
      add({ id: `K-speaker-${s.id}`, scope: "unit", area: "characters", title: `"${s.id}": ${s.speaker} speaks — check only HIS mouth moves`, mode: "visual", result: "check", detail: `voice ${s.voice}`, refs: [s.strip] });
    }
    for (const e of s.extras) {
      if (!e.travel && (e.x < 0.06 || e.x > 0.94)) add({ id: `K-offscreen-${s.id}-${e.id}`, scope: "unit", area: "characters", title: `"${s.id}": ${e.id} at x=${e.x} may be clipped by the frame edge`, mode: "visual", result: "warn", detail: "frame-limit rule: keep static figures inside 0.06–0.94", refs: [s.strip] });
    }
  }
  // KO continuity: an extra knocked out in scene i must be KO from start in later scenes at the same x
  const koX = new Map<string, number>();
  for (const s of scenes) {
    for (const e of s.extras) {
      if (e.ko !== null) {
        const prev = koX.get(e.id);
        if (prev !== undefined && Math.abs(prev - e.x) > 0.02) add({ id: `K-body-moved-${s.id}-${e.id}`, scope: "unit", area: "characters", title: `"${s.id}": ${e.id}'s body moved (x ${prev} → ${e.x})`, mode: "auto", result: "fail", detail: "bodies never teleport: re-declare at the x he fell", refs: [s.strip] });
        koX.set(e.id, e.x);
      } else if (koX.has(e.id)) {
        add({ id: `K-body-up-${s.id}-${e.id}`, scope: "unit", area: "characters", title: `"${s.id}": ${e.id} was knocked out earlier but is standing`, mode: "auto", result: "warn", detail: "intentional? (recovery) otherwise set knockedOutAt: start", refs: [s.strip] });
      }
    }
  }

  // --- action
  for (const s of scenes) {
    if (s.hero && (s.hero.strikes || s.hero.shots || s.hero.throws) || s.projectiles.length) {
      add({ id: `A-contact-${s.id}`, scope: "unit", area: "action", title: `"${s.id}": hits connect / misses miss by a visible margin (check the dense event strips frame by frame)`, mode: "visual", result: "check", detail: `strikes ${s.hero?.strikes ?? 0}, shots ${s.hero?.shots ?? 0}, throws ${s.hero?.throws ?? 0}, projectiles ${s.projectiles.map((p) => `${p.from}→${p.to} ${p.outcome}@${p.at}s`).join("; ") || 0}`, refs: [s.strip, ...s.events.map((e) => e.strip)] });
    }
    const sameFrame = new Map<number, string[]>();
    for (const fx of s.sfx) sameFrame.set(fx.at, [...(sameFrame.get(fx.at) ?? []), fx.name]);
    for (const [at, names] of sameFrame) if (names.length > 2) add({ id: `A-sfx-pile-${s.id}-${at}`, scope: "unit", area: "audio", title: `"${s.id}": ${names.length} SFX on the same instant`, mode: "auto", result: "warn", detail: names.join("+") + ` at ${at}s` });
  }

  // --- audio
  const voices = [...new Set(scenes.map((s) => `${s.voice}/${s.voiceFx}`))];
  add({ id: "V-voices", scope: "unit", area: "audio", title: "voices used (one per character)", mode: "ear", result: "check", detail: voices.join(", ") + " — does each voice match its character? any two voices for one character?" });
  const laughs = scenes.filter((s) => /ha ha|haha/i.test(s.text));
  if (laughs.length) add({ id: "V-laugh", scope: "unit", area: "audio", title: "laugh is in the character's own voice and sounds like a laugh", mode: "ear", result: "check", detail: laughs.map((s) => `${s.id} (${s.kind}, ${s.voice})`).join(", ") });
  add({ id: "V-pronunciation", scope: "unit", area: "audio", title: "names pronounced right", mode: "ear", result: "check", detail: [...new Set(scenes.flatMap((s) => s.words.map((w) => w.text.replace(/[^A-Za-z']/g, ""))).filter((w) => /^[A-Z][a-z]+$/.test(w) && w.length > 3))].join(", ") });
  add({ id: "V-noisy-sfx", scope: "unit", area: "audio", title: "no thunder/glitch under dialogue", mode: "auto", result: scenes.some((s) => s.kind === "speech" && s.sfx.some((x) => ["thunder", "glitch"].includes(x.name))) ? "warn" : "pass", detail: "sustained noisy SFX read as static under speech" });

  // --- packaging
  add({ id: "P-social", scope: "unit", area: "packaging", title: "social block present (title/hook/description/tags)", mode: "auto", result: m.social ? "pass" : "fail", detail: m.social ? `"${m.social.title}"` : "missing" });
  add({ id: "P-watermark", scope: "unit", area: "packaging", title: "watermark on every non-bare frame", mode: "visual", result: "check", detail: "top-right under the progress bar, absent only on the opening", refs: [scenes[1]?.strip ?? first.strip] });

  // --- integration
  add({ id: "I-story", scope: "integration", area: "structure", title: "the story reads from the strips alone (muted)", mode: "visual", result: "check", detail: "go through the scene strips in order: can you tell what happens without the text?", refs: scenes.map((s) => s.strip) });
  add({ id: "I-escalation", scope: "integration", area: "structure", title: "each beat is bigger than the last; the payoff is the biggest", mode: "visual", result: "check", detail: scenes.map((s) => s.id).join(" → "), refs: [] });
  add({ id: "I-character", scope: "integration", area: "characters", title: "the character is recognisable and consistent (style, colour, scale) across scenes", mode: "visual", result: "check", detail: [...new Set(scenes.flatMap((s) => [s.hero?.style ?? "", ...s.extras.map((e) => e.style)]).filter(Boolean))].join(", "), refs: scenes.map((s) => s.strip) });
  add({ id: "I-funny", scope: "integration", area: "structure", title: "is it funny? where is the laugh, and does the video get out right after it?", mode: "visual", result: "check", detail: "name the scene that is the joke; if you can't, say so" });
  return out;
}

function checklistMarkdown(p: ReviewPack): string {
  const icon = { pass: "✅", fail: "❌", warn: "⚠️", check: "👁️" } as const;
  const rows = p.checks.map((c) => `| ${icon[c.result]} ${c.result} | \`${c.id}\` | ${c.scope} · ${c.area} · ${c.mode} | ${c.title} | ${c.detail.replace(/\|/g, "/")} | ${c.refs.map((r) => `\`${r}\``).join(" ")} |`);
  return `# Review checklist — ${p.title} v${p.version} (${p.seconds} s)

Automatic results are decided. **👁️ check** rows need eyes on the referenced strips; **ear** rows need a human listening.

| result | id | kind | check | detail | look at |
|---|---|---|---|---|---|
${rows.join("\n")}

## Scenes

| # | id | start | len | kind | text | voice | speaker | events |
|---|---|---|---|---|---|---|---|---|
${p.scenes.map((s) => `| ${s.index} | ${s.id} | ${s.startSec}s | ${s.seconds}s | ${s.kind} | ${s.text.replace(/\|/g, "/")} | ${s.voice}/${s.voiceFx} | ${s.speaker ?? (s.hero ? "hero" : "voice-over")} | ${s.visualEvents} |`).join("\n")}
`;
}

function readme(p: ReviewPack): string {
  return `# Review pack — ${p.title} v${p.version}

- \`summary.json\` — every scene's facts (text, word timings, voices, poses, props, SFX, camera, projectiles) + the checks.
- \`checklist.md\` — the checks as a table; automatic ones decided, the rest say which strip to look at.
- \`scenes/NN-<id>.png\` — 5 frames per scene, left→right in time: first frame, up to three event frames, last frame.
- \`events/NN-<id>-<event>.png\` — 7 frames at 2-frame spacing around every contact (ball hit/miss, strike, shot, throw): verify touches and misses HERE, frame by frame.
- \`frames/tSSS.S.png\` — the whole video every 0.5 s as single images (t012.5.png = 12.5 s).
- \`../contact.png\` — 4×3 overview of the whole video.
- \`../final.mp4\` — the render (for a human; models review from the strips).

Write the report to \`report.md\` in this folder using \`docs/REVIEW_TEMPLATE.md\`.
`;
}

export function reviewDirFor(slug: string, version?: number): VersionPaths | null {
  const p = projectPaths(slug);
  return version ? versionPaths(p, version) : latestVersion(p);
}
