import React from "react";
import type { PropName } from "@vb/engine/schema";

export interface IconColors {
  line: string;
  fill: string;
  accent: string;
  /** 0→1 progress since the prop appeared (for icons with internal motion). */
  t?: number;
}

type Icon = React.FC<IconColors>;

/** Big stencil numeral in a rounded plate — the shot counter. */
const Numeral: React.FC<{ n: string; line: string; accent: string }> = ({ n, line, accent }) => (
  <g>
    <rect x={14} y={8} width={72} height={84} rx={14} fill={accent} stroke={line} strokeWidth={5} />
    <text x={50} y={74} textAnchor="middle" fontFamily='"Segoe UI Black", "Arial Black", Impact, sans-serif' fontWeight={900} fontSize={66} fill="#111111">
      {n}
    </text>
  </g>
);

const sw = 6;
const base = (line: string) => ({ stroke: line, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" });

export const ICONS: Record<PropName, Icon> = {
  database: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <ellipse cx={50} cy={22} rx={32} ry={12} fill={accent} />
      <path d="M18 22v56c0 6.6 14.3 12 32 12s32-5.4 32-12V22" fill={fill} />
      <path d="M18 41c0 6.6 14.3 12 32 12s32-5.4 32-12M18 60c0 6.6 14.3 12 32 12s32-5.4 32-12" />
    </g>
  ),
  lightbulb: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <path d="M50 8a26 26 0 0 1 14 48c-3 2.5-4 6-4 10H40c0-4-1-7.5-4-10A26 26 0 0 1 50 8z" fill={accent} />
      <path d="M40 76h20M42 86h16" />
      <path d="M50 30v10M42 40l8 8 8-8" stroke={fill} />
    </g>
  ),
  brain: ({ line, fill }) => (
    <g {...base(line)}>
      <path d="M45 14c-9 0-14 6-14 12-8 1-12 8-10 15-6 4-6 14 0 18-1 8 5 13 12 13 2 6 8 8 12 6V14z" fill={fill} />
      <path d="M55 14c9 0 14 6 14 12 8 1 12 8 10 15 6 4 6 14 0 18 1 8-5 13-12 13-2 6-8 8-12 6V14z" fill={fill} />
      <path d="M50 14v64M36 36c4 0 8 3 8 8M64 36c-4 0-8 3-8 8M34 58c4-1 8 1 10 5M66 58c-4-1-8 1-10 5" />
    </g>
  ),
  warning: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <path d="M50 10 92 84H8z" fill={accent} />
      <path d="M50 36v24" stroke={fill} strokeWidth={9} />
      <circle cx={50} cy={72} r={5} fill={fill} stroke="none" />
    </g>
  ),
  computer: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <rect x={10} y={16} width={80} height={52} rx={6} fill={fill} />
      <path d="M22 30h30M22 42h44M22 54h20" stroke={accent} />
      <path d="M36 84h28M50 68v16" />
    </g>
  ),
  clock: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <circle cx={50} cy={52} r={36} fill={fill} />
      <path d="M50 30v24l16 10" stroke={accent} strokeWidth={7} />
      <path d="M38 8h24" />
    </g>
  ),
  money: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <rect x={6} y={26} width={88} height={50} rx={6} fill={fill} />
      <circle cx={50} cy={51} r={14} fill={accent} />
      <path d="M50 42v18M45 47h8a3 3 0 0 1 0 6h-6a3 3 0 0 0 0 6h8" strokeWidth={4} />
      <circle cx={20} cy={51} r={3} fill={line} stroke="none" />
      <circle cx={80} cy={51} r={3} fill={line} stroke="none" />
    </g>
  ),
  chart_up: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <path d="M10 88h80M10 88V12" />
      <path d="M18 74l18-18 14 10 30-32" stroke={accent} strokeWidth={8} />
      <path d="M64 34h16v16" stroke={accent} strokeWidth={8} />
      <circle cx={36} cy={56} r={5} fill={fill} stroke="none" />
    </g>
  ),
  chart_down: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <path d="M10 88h80M10 88V12" />
      <path d="M18 26l18 18 14-10 30 32" stroke={accent} strokeWidth={8} />
      <path d="M64 66h16V50" stroke={accent} strokeWidth={8} />
      <circle cx={36} cy={44} r={5} fill={fill} stroke="none" />
    </g>
  ),
  checkmark: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <circle cx={50} cy={50} r={40} fill={accent} />
      <path d="M28 52l14 14 30-34" stroke={fill} strokeWidth={10} />
    </g>
  ),
  cross: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <circle cx={50} cy={50} r={40} fill={accent} />
      <path d="M32 32l36 36M68 32L32 68" stroke={fill} strokeWidth={10} />
    </g>
  ),
  question: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <circle cx={50} cy={50} r={40} fill={fill} />
      <path d="M36 38a14 14 0 1 1 20 12c-4 3-6 6-6 12" stroke={accent} strokeWidth={9} />
      <circle cx={50} cy={74} r={5} fill={accent} stroke="none" />
    </g>
  ),
  rocket: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <path d="M50 6c14 12 20 30 18 50H32c-2-20 4-38 18-50z" fill={fill} />
      <path d="M32 56L18 70l10 4 6-8M68 56l14 14-10 4-6-8" fill={accent} />
      <circle cx={50} cy={40} r={8} fill={accent} />
      <path d="M42 78c2 10 6 14 8 16 2-2 6-6 8-16" fill={accent} />
    </g>
  ),
  lock: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <rect x={18} y={44} width={64} height={46} rx={8} fill={accent} />
      <path d="M32 44V30a18 18 0 0 1 36 0v14" />
      <circle cx={50} cy={64} r={6} fill={fill} stroke="none" />
      <path d="M50 66v10" stroke={fill} />
    </g>
  ),
  magnifier: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <circle cx={42} cy={42} r={28} fill={fill} />
      <path d="M62 62l28 28" strokeWidth={10} />
      <path d="M28 40a14 14 0 0 1 12-12" stroke={accent} strokeWidth={5} />
    </g>
  ),
  gear: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <path
        d="M50 6l8 2 2 10 8 4 9-5 6 6-5 9 4 8 10 2 2 8-10 2-4 8 5 9-6 6-9-5-8 4-2 10-8 2-8-2-2-10-8-4-9 5-6-6 5-9-4-8-10-2-2-8 10-2 4-8-5-9 6-6 9 5 8-4 2-10z"
        fill={fill}
      />
      <circle cx={50} cy={50} r={14} fill={accent} />
    </g>
  ),
  fire: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <path d="M50 6c4 16 20 22 20 46a20 20 0 0 1-40 0c0-10 6-16 8-24 4 6 8 8 12 6-4-10-2-20 0-28z" fill={accent} />
      <path d="M50 58c6 6 8 10 8 16a8 8 0 0 1-16 0c0-6 4-10 8-16z" fill={fill} stroke="none" />
    </g>
  ),
  document: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <path d="M22 8h38l18 18v66H22z" fill={fill} />
      <path d="M60 8v18h18" />
      <path d="M34 46h32M34 60h32M34 74h20" stroke={accent} />
    </g>
  ),
  phone: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <rect x={26} y={6} width={48} height={88} rx={8} fill={fill} />
      <rect x={32} y={16} width={36} height={60} fill={accent} stroke="none" />
      <circle cx={50} cy={85} r={3} fill={line} stroke="none" />
    </g>
  ),
  cloud: ({ line, fill }) => (
    <g {...base(line)}>
      <path d="M30 78a18 18 0 0 1-2-36 24 24 0 0 1 46 6 16 16 0 0 1 2 30z" fill={fill} />
    </g>
  ),
  book: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <path d="M14 18h30a6 6 0 0 1 6 6v60a6 6 0 0 0-6-6H14z" fill={fill} />
      <path d="M86 18H56a6 6 0 0 0-6 6v60a6 6 0 0 1 6-6h30z" fill={accent} />
      <path d="M24 34h14M24 46h14M62 34h14M62 46h14" strokeWidth={4} />
    </g>
  ),
  heart: ({ line, accent }) => (
    <g {...base(line)}>
      <path d="M50 88S10 62 10 34a20 20 0 0 1 40-6 20 20 0 0 1 40 6c0 28-40 54-40 54z" fill={accent} />
    </g>
  ),
  star: ({ line, accent }) => (
    <g {...base(line)}>
      <path d="M50 6l13 27 30 4-22 21 6 30-27-15-27 15 6-30L8 37l30-4z" fill={accent} />
    </g>
  ),
  trophy: ({ line, fill, accent }) => (
    <g {...base(line)}>
      <path d="M30 10h40v24a20 20 0 0 1-40 0z" fill={accent} />
      <path d="M30 18H16c0 12 6 18 14 18M70 18h14c0 12-6 18-14 18" />
      <path d="M44 54h12v14H44zM30 68h40v16H30z" fill={fill} />
    </g>
  ),
  target: ({ line, fill }) => (
    <g {...base(line)}>
      <rect x={46} y={70} width={8} height={26} fill="#5b3a1a" stroke="none" />
      <rect x={30} y={90} width={40} height={8} rx={3} fill="#5b3a1a" stroke="none" />
      <circle cx={50} cy={42} r={36} fill="#ffffff" />
      <circle cx={50} cy={42} r={27} fill="#e63946" stroke="none" />
      <circle cx={50} cy={42} r={18} fill="#ffffff" stroke="none" />
      <circle cx={50} cy={42} r={9} fill="#e63946" stroke="none" />
      <circle cx={50} cy={42} r={3} fill={fill} stroke="none" />
    </g>
  ),
  lotus: ({ line, t = 1 }) => {
    // Petals unfold from the centre with t; a Jhin kill blooms.
    const k = Math.min(1, Math.max(0, t));
    const petal = (deg: number, len: number, w: number, col: string, i: number) => {
      const grow = Math.min(1, Math.max(0, (k - i * 0.06) / 0.7));
      return (
        <path
          key={`${deg}-${len}`}
          transform={`translate(50 62) rotate(${deg}) scale(${grow})`}
          d={`M 0 0 C ${-w} ${-len * 0.45} ${-w * 0.6} ${-len} 0 ${-len} C ${w * 0.6} ${-len} ${w} ${-len * 0.45} 0 0 Z`}
          fill={col}
          stroke={line}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      );
    };
    const outer = [-70, -35, 0, 35, 70].map((d, i) => petal(d, 44, 16, "#c2185b", i));
    const inner = [-45, -15, 15, 45].map((d, i) => petal(d, 34, 13, "#f06292", i + 2));
    return (
      <g>
        <ellipse cx={50} cy={80} rx={34 * k} ry={9 * k} fill="#2f9e44" stroke={line} strokeWidth={3} />
        {outer}
        {inner}
        <circle cx={50} cy={60} r={6 * k} fill="#ffd166" />
      </g>
    );
  },
  number_1: ({ line, accent }) => <Numeral n="1" line={line} accent={accent} />,
  number_2: ({ line, accent }) => <Numeral n="2" line={line} accent={accent} />,
  number_3: ({ line, accent }) => <Numeral n="3" line={line} accent={accent} />,
  number_4: ({ line, accent }) => <Numeral n="4" line={line} accent={accent} />,
  crate: ({ line }) => (
    <g>
      <rect x={2} y={2} width={96} height={96} rx={3} fill="#b07a3c" stroke={line} strokeWidth={4} />
      {[18, 34, 50, 66, 82].map((y) => (
        <line key={y} x1={4} y1={y} x2={96} y2={y} stroke="#8a5a26" strokeWidth={2} />
      ))}
      <rect x={2} y={2} width={96} height={12} fill="#c98d48" stroke={line} strokeWidth={4} />
      <rect x={2} y={86} width={96} height={12} fill="#c98d48" stroke={line} strokeWidth={4} />
      <rect x={2} y={2} width={12} height={96} fill="#c98d48" stroke={line} strokeWidth={4} />
      <rect x={86} y={2} width={12} height={96} fill="#c98d48" stroke={line} strokeWidth={4} />
      <line x1={14} y1={14} x2={86} y2={86} stroke="#c98d48" strokeWidth={9} />
      <line x1={14} y1={14} x2={86} y2={86} stroke={line} strokeWidth={3} />
      <line x1={86} y1={14} x2={14} y2={86} stroke="#c98d48" strokeWidth={9} />
      <line x1={86} y1={14} x2={14} y2={86} stroke={line} strokeWidth={3} />
      {[[8, 8], [92, 8], [8, 92], [92, 92]].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={2.5} fill="#3b2a14" />
      ))}
    </g>
  ),
  watermelon: ({ line }) => (
    <g {...base(line)}>
      <ellipse cx={50} cy={54} rx={42} ry={36} fill="#2f9e44" />
      {[-30, -15, 0, 15, 30].map((dx) => (
        <path key={dx} d={`M ${50 + dx} 20 q ${dx * 0.15} 34 0 68`} stroke="#1b5e20" strokeWidth={5} fill="none" />
      ))}
      <path d="M 50 18 q -4 -10 4 -14" stroke="#5b3a1a" strokeWidth={5} />
    </g>
  ),
  watermelon_split: ({ line, t = 1 }) => {
    // Two halves fly apart and tip over; seeds and juice scatter with t.
    const k = Math.min(1, Math.max(0, t));
    const dx = 26 * k;
    const rot = 22 * k;
    const half = (sign: 1 | -1) => (
      <g transform={`translate(${50 + sign * dx} 56) rotate(${sign * rot})`}>
        <path d={`M ${-sign * 2} -36 A 40 34 0 0 ${sign === 1 ? 1 : 0} ${-sign * 2} 32 Z`} fill="#2f9e44" stroke={line} strokeWidth={sw} strokeLinejoin="round" />
        <path d={`M ${-sign * 2} -28 A 31 26 0 0 ${sign === 1 ? 1 : 0} ${-sign * 2} 24 Z`} fill="#ff4d6d" />
        {[-14, 0, 12].map((y, i) => (
          <ellipse key={i} cx={sign * (10 + (i % 2) * 6)} cy={y} rx={2.6} ry={4} fill="#111" />
        ))}
      </g>
    );
    const drops = [
      [-38, -30, 0.9], [-20, -46, 1.1], [12, -50, 1.0], [34, -36, 0.8], [46, -8, 0.7], [-46, 0, 0.7],
    ] as const;
    return (
      <g>
        {half(-1)}
        {half(1)}
        {drops.map(([x, y, sz], i) => (
          <circle key={i} cx={50 + x * k} cy={56 + y * k + 30 * k * k} r={4 * sz * (1 - 0.4 * k)} fill="#ff4d6d" opacity={1 - 0.5 * k} />
        ))}
      </g>
    );
  },
};
