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
export const Projectiles: React.FC<{ scene: ResolvedScene; abs: number; rects: { id: string; rect: Rect; flip: boolean }[]; rectAt: (id: string, frame: number) => Rect | null; palette: Palette }> = ({ scene, abs, rects, rectAt, palette }) => {
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
    // The thrower aims at where the target STOOD when the ball left the hand; a sidestep after that is a dodge.
    const to = (p.outcome === "miss" && p.path === "through" ? rectAt(p.to, scene.startFrame) : rectAt(p.to, p.atFrame)) ?? rectOf(p.to);
    if (!to) return;
    const scale = Math.max(0.5, from.h / 700);
    const r = R * scale;
    const dir = to.x > from.x ? 1 : -1;
    const hand = { x: from.x + from.w * (dir > 0 ? 0.78 : 0.22), y: from.y + from.h * 0.36 };
    // Misses are aimed at head height of the STANDING figure so a lean/duck/jump visibly clears the ball.
    // through: a real throw that LANDS where he stood — arcs to the ground at that x and bounces there.
    const aimY = p.outcome !== "miss" ? to.y + to.h * 0.42 : p.path === "through" ? to.y + to.h - r : p.path === "under" ? to.y + to.h * 0.86 : to.y - r * 2.6;
    // through-misses land a step SHORT of where he stood (the near side), so the bounce stays clear of where he moved to
    const aimX = p.outcome === "miss" && p.path === "through" ? to.x + to.w * (dir > 0 ? 0.25 : 0.75) : to.x + to.w / 2;
    const chest = { x: aimX, y: aimY };
    const ground = to.y + to.h - r;
    const flight = Math.max(1, p.hitFrame - p.atFrame);
    const t = abs - p.atFrame;
    if (t < 0) return;

    const ballAt = (f: number): { x: number; y: number; rot: number; sq: number } | null => {
      if (p.outcome === "roll") {
        // Dropped from the hand: falls, hops toward the target and the LAST hop rises into his hip — a visible
        // touch above the ground — then bounces back off him and dies out.
        const f1 = flight * 0.3;
        const y0 = hand.y + 40;
        if (f < f1) {
          const drop = f / f1;
          return { x: hand.x, y: y0 + (ground - y0) * drop * drop, rot: 0, sq: f > f1 - 1 ? 0.3 : 0 };
        }
        const hitX = to.x + to.w / 2 - dir * r * 1.1;
        const hipY = to.y + to.h * 0.62;
        const H = ground - hipY; // hop height = exactly hip height, so the 2.5th hop peaks ON him
        if (f <= flight) {
          const k = (f - f1) / (flight - f1);
          return { x: hand.x + (hitX - hand.x) * k, y: ground - Math.abs(Math.sin(k * Math.PI * 2.5)) * H, rot: k * 900 * dir, sq: 0 };
        }
        const bf = f - flight;
        if (bf > 30) return null;
        const decay = Math.pow(1 - bf / 30, 1.3);
        return { x: hitX - dir * bf * 7, y: hipY + (ground - hipY) * Math.min(1, bf / 6) - Math.abs(Math.sin(bf * 0.35)) * H * 0.7 * decay, rot: 900 * dir - bf * 40 * dir, sq: bf < 2 ? 0.4 : 0 };
      }
      // One gravity parabola from the hand THROUGH the aim point and onward — no change of law at the target,
      // so a miss keeps falling naturally instead of "bouncing on air". vx is constant; vy chosen so y(flight) = aim.
      // misses fly flatter (a shallow descent past the head); hits and deflects keep the fuller arc
      const arcH = Math.min(320, 90 + flight * 4) * scale * (p.outcome === "miss" && p.path !== "through" ? 0.35 : 1);
      const g = (8 * arcH) / (flight * flight); // px/frame², gives an apex ~arcH above the chord
      const vy = (chest.y - hand.y - 0.5 * g * flight * flight) / flight;
      const vx = (chest.x - hand.x) / flight;
      const pos = (ff: number) => ({ x: hand.x + vx * ff, y: hand.y + vy * ff + 0.5 * g * ff * ff });
      const k = f / flight;
      if (k <= 1) return { ...pos(f), rot: k * 540 * dir, sq: 0 };
      const after = f - flight;
      if (p.outcome === "hit") {
        if (after > 6) return null;
        return { x: chest.x - dir * r * 0.6, y: chest.y, rot: 540 * dir, sq: interpolate(after, [0, 2, 6], [0.5, 0.25, 0]) };
      }
      if (p.outcome === "miss") {
        // keep flying on the same parabola; when it meets the ground, bounce there (each bounce lower) and stop.
        const q = pos(f);
        if (q.y < ground) {
          if (q.x < -120 || q.x > 1200) return null;
          return { x: q.x, y: q.y, rot: k * 540 * dir, sq: 0 };
        }
        // find the landing frame (first f where y >= ground) by stepping — cheap, flight is small
        let landF = flight;
        while (pos(landF).y < ground && landF < flight + 400) landF += 1;
        const land = pos(landF);
        const bf = f - landF;
        if (bf > 34) return null;
        const decay = Math.pow(1 - bf / 34, 1.4);
        return { x: land.x + dir * bf * 1.5, y: ground - Math.abs(Math.sin(bf * 0.33)) * 150 * decay, rot: 540 * dir + bf * 30 * dir, sq: bf < 2 ? 0.35 : 0 };
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
    // impact ring: pan deflection, and the dropped ball touching the target
    if ((p.outcome === "deflect" || p.outcome === "roll") && t >= flight && t <= flight + 5) {
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
