import pathlib


def patch(f, pairs):
    p = pathlib.Path(f); s = p.read_text(encoding="utf-8")
    for a, b in pairs:
        assert a in s, (f, a[:70])
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")


patch("engine/src/schema/manifest.ts", [
('''  /** Gunslinger only: muzzle flash + recoil at these anchors. `big` = the dramatic final shot. */''',
 '''  /**
   * Melee strikes (front rig): wind-up, then the hand swings THROUGH the centre of the
   * `target` prop zone at `at` (lunging closer if out of reach), follow-through, recover.
   * Put the prop swap (e.g. watermelon → watermelon_split) at the same anchor +0.03.
   */
  strikes: z
    .array(z.object({ at: Anchor, target: z.enum(PROP_POSITIONS), big: z.boolean().default(false) }))
    .max(8)
    .default([]),
  /** Gunslinger only: muzzle flash + recoil at these anchors. `big` = the dramatic final shot. */'''),
])

patch("engine/src/schema/resolved.ts", [
('''export const ResolvedShot = z.object({ atFrame: z.number().int(), big: z.boolean() });''',
 '''export const ResolvedShot = z.object({ atFrame: z.number().int(), big: z.boolean() });
export const ResolvedStrike = z.object({ atFrame: z.number().int(), target: z.enum(PROP_POSITIONS), big: z.boolean() });'''),
('''      shots: z.array(ResolvedShot).default([]),
      /** Pixel x of the character rect's left edge over [startFrame, endFrame]. */''',
 '''      shots: z.array(ResolvedShot).default([]),
      strikes: z.array(ResolvedStrike).default([]),
      /** Pixel x of the character rect's left edge over [startFrame, endFrame]. */'''),
])

patch("engine/src/resolver/resolve.ts", [
('''          shots: s.character.shots.map((sh, i) => ({ atFrame: at(sh.at, `character.shots[${i}]`), big: sh.big })),''',
 '''          shots: s.character.shots.map((sh, i) => ({ atFrame: at(sh.at, `character.shots[${i}]`), big: sh.big })),
          strikes: s.character.strikes
            .map((st, i) => ({ atFrame: at(st.at, `character.strikes[${i}]`), target: st.target, big: st.big }))
            .sort((x, y) => x.atFrame - y.atFrame),'''),
])

# sample.ts
p = pathlib.Path("renderer/src/sample.ts"); s = p.read_text(encoding="utf-8")
s = s.replace("        shots: [],\n        travel: null,", "        shots: [],\n        strikes: [],\n        travel: null,")
p.write_text(s, encoding="utf-8")
print("ok")
