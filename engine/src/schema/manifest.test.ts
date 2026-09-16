import { describe, expect, it } from "vitest";
import { Manifest } from "./manifest.js";

const base = {
  version: 1,
  slug: "test-video",
  title: "Test",
  scenes: [{ id: "hook", speech: "Your database is slow. Here is why." }],
};

describe("Manifest schema", () => {
  it("applies defaults", () => {
    const m = Manifest.parse(base);
    expect(m.voice).toBe("af_heart");
    expect(m.scenes[0]!.character).toEqual({ id: "narrator", pose: "explaining", expression: "neutral", position: "center", poseChanges: [], shots: [] });
    expect(m.scenes[0]!.pauseAfter).toBe(0.25);
    expect(m.characters).toEqual([{ id: "narrator", style: "stickman" }]);
  });

  it("rejects unknown pose / prop / sfx", () => {
    const bad = { ...base, scenes: [{ id: "a", speech: "x", character: { pose: "dancing" } }] };
    expect(Manifest.safeParse(bad).success).toBe(false);
    const badProp = { ...base, scenes: [{ id: "a", speech: "x", props: [{ name: "unicorn", at: "start" }] }] };
    expect(Manifest.safeParse(badProp).success).toBe(false);
  });

  it("rejects bad anchors", () => {
    const bad = { ...base, scenes: [{ id: "a", speech: "x y", props: [{ name: "brain", at: "at 2 seconds" }] }] };
    const r = Manifest.safeParse(bad);
    expect(r.success).toBe(false);
  });

  it("emphasis must be a substring of speech", () => {
    const r = Manifest.safeParse({ ...base, scenes: [{ id: "a", speech: "fast queries", emphasis: ["slow"] }] });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/not a substring/);
  });

  it("duplicate scene ids fail", () => {
    const r = Manifest.safeParse({ ...base, scenes: [{ id: "a", speech: "x" }, { id: "a", speech: "y" }] });
    expect(r.success).toBe(false);
  });

  it("rejects scripts far over the platform cap", () => {
    const speech = Array.from({ length: 60 }, () => "word").join(" ");
    const r = Manifest.safeParse({ ...base, scenes: Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, speech })) });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/hard cap/);
  });

  it("allows character: null for caption-only scenes", () => {
    const m = Manifest.parse({ ...base, scenes: [{ id: "a", speech: "x", layout: "caption_only", character: null }] });
    expect(m.scenes[0]!.character).toBeNull();
  });
});

describe("clip scenes", () => {
  it("accepts clip without speech and rejects both/neither", () => {
    const ok = Manifest.safeParse({ ...base, scenes: [{ id: "l", clip: { file: "laugh.wav", caption: "HAHA" } }] });
    expect(ok.success).toBe(true);
    const both = Manifest.safeParse({ ...base, scenes: [{ id: "l", speech: "x", clip: { file: "laugh.wav" } }] });
    expect(both.success).toBe(false);
    const neither = Manifest.safeParse({ ...base, scenes: [{ id: "l" }] });
    expect(neither.success).toBe(false);
  });
});
