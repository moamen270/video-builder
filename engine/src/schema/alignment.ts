import { z } from "zod";

/** Output of py/vb_audio for one scene: audio file + word timings from Kokoro's token timestamps. */
export const AlignmentToken = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  /** Whitespace that followed the token in the source text ("" or " "). */
  ws: z.string().default(" "),
});

export const SceneAlignment = z.object({
  sceneId: z.string(),
  file: z.string(),
  /** Seconds of actual speech audio (before pause padding). */
  duration: z.number(),
  sampleRate: z.number().int(),
  tokens: z.array(AlignmentToken),
});
export type SceneAlignment = z.infer<typeof SceneAlignment>;

export const AlignmentFile = z.object({
  model: z.string(),
  voice: z.string(),
  speed: z.number(),
  /** sha256 of (voice|speed|speech) per scene; lets the resolver skip unchanged scenes. */
  scenes: z.array(SceneAlignment.extend({ hash: z.string() })),
});
export type AlignmentFile = z.infer<typeof AlignmentFile>;
