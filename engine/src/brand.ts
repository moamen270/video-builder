import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ROOT } from "./paths.js";

/** Channel identity shared by every video (repo root `brand.json`). */
export const Brand = z.object({
  name: z.string().min(1),
  handle: z.string().regex(/^@[A-Za-z0-9_.]+$/, "handle like @DummySticky"),
  tagline: z.string().default(""),
  /** Draw the handle watermark on every render. */
  watermark: z.boolean().default(true),
  /** Appended to every post's hashtags (first three matter most on YouTube). */
  defaultHashtags: z.array(z.string().regex(/^#\w+$/)).default([]),
});
export type Brand = z.infer<typeof Brand>;

export const BRAND_FILE = path.join(ROOT, "brand.json");

export function loadBrand(): Brand | null {
  if (!existsSync(BRAND_FILE)) return null;
  return Brand.parse(JSON.parse(readFileSync(BRAND_FILE, "utf8")));
}
