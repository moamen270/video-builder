import React from "react";
import { interpolate } from "remotion";
import type { ResolvedScene } from "@vb/engine/schema";
import type { Palette, Rect } from "../theme";

type P = ResolvedScene["projectiles"][number];

const R = 34; // ball radius in scene px at extra scale 1 (scaled by the thrower's size)
const GHOSTS = 3; // motion-blur copies trailing a fast ball

/** Deterministic 0–1 from integers. */
const hash = (a: number, b: number) => {
  const x = Math.sin(a * 91.7 + b * 47.3) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Dodgeballs. Each projectile flies on a parabola from the thrower's hand to the
 * target's chest. Outcomes on arrival:
 *   hit     — stops on the target, squashes, gone after 6 frames
 *   miss    — continues on the same arc off the frame
 *   deflect — bounces off (a pan) and flies away up/back, spinning
 *   roll    — dropped from the hand, falls to the ground, rolls to the target's foot
 * Fast balls draw fading ghost copies behind them (motion blur).
 */
export const Projectiles: React.FC<{ scene: ResolvedScene; abs: number; rects: { id: string; rect: Rect; flip: boolean }[]; palette: Palette }> = ({ scene, abs, rects, palette }) => {
  const els: React.ReactNode[] = [];
  const rectOf = (id: string) => rects.find((r) => r.id === id)?.rect ?? null;

  scene.projectiles.forEach((p, i) => {
    const from = rectOf(p.from);
    if (!from) return;
    if (p.to === "camera") {
      // At the viewer: the ball grows from the hand to a big disc at frame centre, then the crack overlay takes over.
      const f = abs - p.atFrame;
      const flightC = Math.max(1, p.hitFrame - p.atFrame);
      if (f < 0 || f > flightC) return;
      const k = f / flightC;
      const hx = from.x + from.w * 0.78;
      const hy = from.y + from.h * 0.36;
      const x = interpolate(k, [0, 1], [hx, 540]);
      const y = interpolate(k, [0, 1], [hy, 860]) - Math.sin(Math.PI * k) * 120;
      const rr = interpolate(k * k, [0, 1], [R * 0.9, 300]);
      els.push(
        <g key={`cam${i}`} transform={`translate(${x} ${y}) rotate(${k * 720})`}>
          <circle r={rr} fill="#d62828" stroke={palette.ink} strokeWidth={4} />
          <path d={`M ${-rr * 0.85} ${-rr * 0.2} Q 0 ${rr * 0.35} ${rr * 0.85} ${-rr * 0.2}`} stroke="#f4d6c5" strokeWidth={rr * 0.16} fill="none" />
        </g>,
      );
      return;
    }
    const to = rectOf(p.to);
    if (!to) return;
    const scale = Math.max(0.5, from.h / 700);
    const r = R * scale;
    const dir = to.x > from.x ? 1 : -1;
    const hand = { x: from.x + from.w * (dir > 0 ? 0.78 : 0.22), y: from.y + from.h * 0.36 };
    // Misses are aimed at head height of the STANDING figure so a lean/duck/jump visibly clears the ball.
    const chest = { x: to.x + to.w / 2, y: p.outcome === "miss" ? to.y - r * 1.6 : to.y + to.h * 0.42 };
    const ground = to.y + to.h - r;
    const flight = Math.max(1, p.hitFrame - p.atFrame);
    const t = abs - p.atFrame;
    if (t < 0) return;

    const ballAt = (f: number): { x: number; y: number; rot: number; sq: number } | null => {
      if (p.outcome === "roll") {
        // fall from the hand (gravity), bounce once, roll to the target's foot
        const drop = Math.min(1, f / (flight * 0.35));
        const y0 = hand.y + 40;
        if (f < flight * 0.35) return { x: hand.x, y: y0 + (ground - y0) * drop * drop, rot: 0, sq: 0 };
        const k = Math.min(1, (f - flight * 0.35) / (flight * 0.65));
        const ease = 1 - (1 - k) * (1 - k);
        const bounce = Math.abs(Math.sin(k * Math.PI * 3)) * 110 * Math.pow(1 - k, 1.3); // three real bounces, each lower
        if (k >= 1 && f > flight + 40) return null;
        return { x: hand.x + (to.x + to.w * (dir > 0 ? 0.42 : 0.58) - hand.x) * ease, y: ground - bounce, rot: k * 720 * dir, sq: 0 };
      }
      const k = f / flight;
      const arcH = Math.min(320, 90 + flight * 4) * scale;
      const along = (kk: number) => ({ x: hand.x + (chest.x - hand.x) * kk, y: hand.y + (chest.y - hand.y) * kk - Math.sin(Math.PI * Math.min(1, Math.max(0, kk)) * 0.9 + 0.1) * arcH * (kk < 1 ? 1 : 0) });
      if (k <= 1) return { ...along(k), rot: k * 540 * dir, sq: 0 };
      const after = f - flight;
      if (p.outcome === "hit") {
        if (after > 6) return null;
        return { x: chest.x - dir * r * 0.6, y: chest.y, rot: 540 * dir, sq: interpolate(after, [0, 2, 6], [0.5, 0.25, 0]) };
      }
      if (p.outcome === "miss") {
        // keep going past the target, dropping, until off-frame
        const x = chest.x + dir * (after / flight) * Math.abs(chest.x - hand.x) * 1.2;
        const y = chest.y + after * after * 0.5;
        if (x < -100 || x > 1180 || y > 2000) return null;
        return { x, y, rot: (1 + after / flight) * 540 * dir, sq: 0 };
      }
      // deflect: bounce back and up, a different angle per ball
      const ang = -Math.PI * (0.55 + hash(i, p.n) * 0.5); // between straight up and back-over-the-shoulder
      const speed = 34 + hash(p.n, i) * 22;
      const x = chest.x - dir * r + Math.cos(ang) * speed * after * -dir;
      const y = chest.y + Math.sin(ang) * speed * after + after * after * 1.2;
      if (after > 40 || y < -150 || x < -150 || x > 1230) return null;
      return { x, y, rot: 540 * dir - after * 40 * dir, sq: after < 2 ? 0.4 : 0 };
    };

    const now = ballAt(t);
    if (!now) return;
    // ghosts (motion blur) while airborne and fast
    const fast = flight <= 14 && t <= flight + 2;
    if (fast) {
      for (let g = GHOSTS; g >= 1; g--) {
        const prev = ballAt(t - g * 0.8);
        if (!prev) continue;
        els.push(<circle key={`g${i}-${p.n}-${g}`} cx={prev.x} cy={prev.y} r={r * (1 - g * 0.12)} fill="#d62828" opacity={0.28 - g * 0.07} />);
      }
    }
    // deflect spark
    if (p.outcome === "deflect" && t >= flight && t <= flight + 5) {
      const k = (t - flight) / 5;
      els.push(<circle key={`sp${i}-${p.n}`} cx={chest.x - dir * r} cy={chest.y} r={interpolate(k, [0, 1], [14, 70]) * scale} fill="none" stroke="#ffffff" strokeWidth={interpolate(k, [0, 1], [10, 1])} opacity={1 - k} />);
    }
    els.push(
      <g key={`b${i}-${p.n}`} transform={`translate(${now.x} ${now.y}) rotate(${now.rot}) scale(${1 + now.sq * 0.6} ${1 - now.sq})`}>
        <circle r={r} fill="#d62828" stroke={palette.ink} strokeWidth={3} />
        <path d={`M ${-r * 0.85} ${-r * 0.2} Q 0 ${r * 0.35} ${r * 0.85} ${-r * 0.2}`} stroke="#f4d6c5" strokeWidth={r * 0.16} fill="none" />
        <circle cx={-r * 0.35} cy={-r * 0.45} r={r * 0.18} fill="#ffffff" opacity={0.55} />
      </g>,
    );
  });

  if (!els.length) return null;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
      {els}
    </svg>
  );
};
