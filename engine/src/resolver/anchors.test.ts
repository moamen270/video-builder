import { describe, expect, it } from "vitest";
import type { Word } from "../schema/index.js";
import { applyEmphasis, resolveAnchor, type SceneTimeline } from "./anchors.js";

const mk = (texts: string[], startFrame = 100): SceneTimeline => {
  const words: Word[] = texts.map((text, i) => ({
    text,
    i,
    start: i * 0.5,
    end: i * 0.5 + 0.4,
    startFrame: startFrame + i * 15,
    endFrame: startFrame + i * 15 + 12,
    emphasis: false,
  }));
  return { startFrame, endFrame: startFrame + texts.length * 15 + 10, words, fps: 30 };
};

describe("resolveAnchor", () => {
  const tl = mk(["Your", "database", "is", "slow.", "Every.", "Single.", "row,", "every", "time!"]);

  it("start / end", () => {
    expect(resolveAnchor("start", tl, "t")).toBe(100);
    expect(resolveAnchor("end", tl, "t")).toBe(tl.endFrame);
  });

  it("word ignores case and punctuation", () => {
    expect(resolveAnchor("word:Database", tl, "t")).toBe(115);
    expect(resolveAnchor("word:slow", tl, "t")).toBe(145);
    expect(resolveAnchor("word:row", tl, "t")).toBe(190);
  });

  it("nth occurrence", () => {
    expect(resolveAnchor("word:every", tl, "t")).toBe(160);
    expect(resolveAnchor("word:every#2", tl, "t")).toBe(205);
  });

  it("phrase with underscores", () => {
    expect(resolveAnchor("word:every_single_row", tl, "t")).toBe(160);
  });

  it("second offsets and clamping", () => {
    expect(resolveAnchor("word:slow+0.5", tl, "t")).toBe(160);
    expect(resolveAnchor("word:slow-0.2", tl, "t")).toBe(139);
    expect(resolveAnchor("start-5", tl, "t")).toBe(100);
    expect(resolveAnchor("end+9", tl, "t")).toBe(tl.endFrame);
  });

  it("helpful error on missing word", () => {
    expect(() => resolveAnchor("word:index", tl, "scenes[0].props[1]")).toThrow(/scenes\[0\]\.props\[1\].*not found.*Scene words/);
    expect(() => resolveAnchor("word:every#3", tl, "t")).toThrow(/occurrence #3/);
  });

  it("rejects bad grammar", () => {
    expect(() => resolveAnchor("middle", tl, "t")).toThrow(/invalid anchor/);
  });
});

describe("applyEmphasis", () => {
  it("marks consecutive phrase words, case/punct-insensitive", () => {
    const tl = mk(["Ten", "million", "rows.", "Full", "scan:", "seconds."]);
    applyEmphasis(tl.words, ["ten million", "SECONDS"]);
    expect(tl.words.map((w) => w.emphasis)).toEqual([true, true, false, false, false, true]);
  });
});
