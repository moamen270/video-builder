import React from "react";
import type { PropName } from "@vb/engine/schema";

export interface IconColors {
  line: string;
  fill: string;
  accent: string;
}

type Icon = React.FC<IconColors>;

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
};
