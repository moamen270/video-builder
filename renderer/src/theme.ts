import type { Layout, Position, PropPosition, Theme } from "@vb/engine/schema";

export interface Palette {
  bg: [string, string];
  fg: string;
  fgDim: string;
  accent: string;
  accent2: string;
  stroke: string;
  /** Character line colour. */
  ink: string;
  /** Body fill for prop icons (contrasts with ink). */
  propFill: string;
}

export const PALETTES: Record<Theme, Palette> = {
  midnight: { bg: ["#0f1020", "#1c2040"], fg: "#ffffff", fgDim: "#8b8fa8", accent: "#ffd60a", accent2: "#4cc9f0", stroke: "#000000", ink: "#ffffff", propFill: "#2a2f55" },
  paper: { bg: ["#fdf6e3", "#f1e6c8"], fg: "#1a1a1a", fgDim: "#8a8577", accent: "#e63946", accent2: "#1d7fd1", stroke: "#ffffff", ink: "#1a1a1a", propFill: "#ffffff" },
  sunset: { bg: ["#ff7a18", "#af002d"], fg: "#ffffff", fgDim: "#ffd3b8", accent: "#ffe66d", accent2: "#ffffff", stroke: "#3a0010", ink: "#ffffff", propFill: "#5a1020" },
  mint: { bg: ["#0b3d2e", "#14664d"], fg: "#f0fff4", fgDim: "#9fd3b8", accent: "#7bf1a8", accent2: "#ffd166", stroke: "#03241a", ink: "#f0fff4", propFill: "#0a2e24" },
  grape: { bg: ["#2b0a3d", "#5a189a"], fg: "#ffffff", fgDim: "#c7a9e6", accent: "#ff9e00", accent2: "#f72585", stroke: "#1a0426", ink: "#ffffff", propFill: "#3d1160" },
};

export const W = 1080;
export const H = 1920;
export const SAFE = { top: 250, bottom: 420, left: 60, right: 140 };

export const FONT = '"Segoe UI Black", "Segoe UI", "Arial Black", Impact, Arial, sans-serif';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutSpec {
  /** Where the stickman is drawn (per horizontal position). */
  character: Record<Position, Rect> | null;
  caption: Rect;
  /** Prop zones by requested position. */
  props: Record<PropPosition, Rect>;
  captionFontPx: number;
}

const propZones = (o: Partial<Record<PropPosition, Rect>>): Record<PropPosition, Rect> => ({
  top: { x: 140, y: 300, w: 800, h: 460 },
  top_left: { x: 80, y: 300, w: 420, h: 420 },
  top_right: { x: 580, y: 300, w: 420, h: 420 },
  left: { x: 60, y: 800, w: 400, h: 400 },
  right: { x: 620, y: 800, w: 400, h: 400 },
  center: { x: 240, y: 660, w: 600, h: 600 },
  above_character: { x: 340, y: 780, w: 400, h: 340 },
  ...o,
});

export const LAYOUTS: Record<Layout, LayoutSpec> = {
  character_bottom: {
    character: {
      left: { x: 40, y: 1080, w: 440, h: 700 },
      center: { x: 320, y: 1080, w: 440, h: 700 },
      right: { x: 600, y: 1080, w: 440, h: 700 },
    },
    caption: { x: SAFE.left, y: 760, w: W - SAFE.left - SAFE.right, h: 280 },
    props: propZones({}),
    captionFontPx: 84,
  },
  character_left: {
    character: {
      left: { x: 30, y: 940, w: 400, h: 620 },
      center: { x: 30, y: 940, w: 400, h: 620 },
      right: { x: 30, y: 940, w: 400, h: 620 },
    },
    caption: { x: SAFE.left, y: 380, w: W - SAFE.left - SAFE.right, h: 440 },
    props: propZones({
      top: { x: 460, y: 940, w: 480, h: 480 },
      right: { x: 460, y: 940, w: 480, h: 480 },
      center: { x: 460, y: 940, w: 480, h: 480 },
      above_character: { x: 60, y: 560, w: 360, h: 340 },
    }),
    captionFontPx: 88,
  },
  character_center: {
    character: {
      left: { x: 80, y: 560, w: 520, h: 820 },
      center: { x: 280, y: 560, w: 520, h: 820 },
      right: { x: 480, y: 560, w: 520, h: 820 },
    },
    caption: { x: SAFE.left, y: 1330, w: W - SAFE.left - SAFE.right, h: 200 },
    props: propZones({
      above_character: { x: 340, y: 280, w: 400, h: 300 },
      top: { x: 240, y: 270, w: 600, h: 300 },
      left: { x: 40, y: 700, w: 300, h: 300 },
      right: { x: 740, y: 700, w: 300, h: 300 },
      center: { x: 340, y: 280, w: 400, h: 300 },
    }),
    captionFontPx: 76,
  },
  caption_only: {
    character: null,
    caption: { x: SAFE.left, y: 640, w: W - SAFE.left - SAFE.right, h: 620 },
    props: propZones({ top: { x: 240, y: 300, w: 600, h: 320 }, center: { x: 240, y: 300, w: 600, h: 320 }, above_character: { x: 240, y: 300, w: 600, h: 320 } }),
    captionFontPx: 112,
  },
};
