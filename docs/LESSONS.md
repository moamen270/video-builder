# Lessons — Moamen's feedback, and what we changed

A dated log of corrections from the channel owner. Read this before making a
video: these are the mistakes that were already made once. When a lesson
becomes a rule, it also goes into the skills; this file keeps the *why*.

## Characters

- **No costumes over the stickman.** A costumed Wolverine read as "a yellow cat". Styles add
  attachments (claws, ears + cape, hat, mask), never a suit. *(wolverine v1 → v2)*
- **The mask is the exception when the mask IS the character.** Jhin's porcelain mask replaces
  the face; expression becomes head tilt. Walker gets a profile version so he stays masked
  while walking. *(jhin v6)*
- **Villains must be recognisable at phone size.** Joker = white face, slicked green hair,
  dark eye sockets, red painted grin; not green spikes. Penguin = top hat + monocle.
  Riddler = green bowler with "?". *(batman v3, v6)*
- **Smaller casts read better in action scenes.** Hero 0.85 / villains 0.75 / Robin 0.62 gave
  the batarang somewhere to fly and made the pile of bodies a pile. *(batman v6)*
- **Bodies never teleport.** Re-declare a knocked-out extra at the x he was hit with an
  explicit `fallDir`. *(batman v3)*

## Voice and audio

- **Match the voice to the character, by measurement.** Batman on `am_fenrir` sounded like a
  kid (139 Hz); `bm_lewis` + growl (~100 Hz) fixed it. Jhin: `bm_george` + `mask`. Names of
  voices are not a guide — measure F0. *(batman v3, jhin v6)*
- **One character = one voice, including the laugh.** A Bark laugh next to a Kokoro voice
  sounds like two people (and Bark hallucinated words). If a character laughs, TTS it in his
  voice with `captionStyle: beat`; or cut the laugh. *(jhin v7 → v8)*
- **A speech bubble is silent.** If a line should be heard ("WAIT!"), give it a scene with
  the extra as `speaker`. *(batman v6)*
- **Whose mouth moves matters.** Robin talking with Batman's mouth moving was noticed
  instantly → `speaker`. *(batman v6)*
- **Sustained noisy SFX under dialogue sound like a broken radio** (thunder, glitch). Use
  drum / boom / chime hits. *(batman v3)*
- **Opening lines slower than the body** (speed ~0.78): the first line is a performance,
  not narration. *(jhin v7)*

## Action and timing

- **Hits must connect.** A slash pose next to a melon isn't a hit; aim the arm through the
  target, swap the prop on impact. *(wolverine v3)*
- **Target → impact → effect, in that order.** The target must still be there when the shot
  arrives (`exit: cut`), then a glow, then the bloom. Fading the target early reads as "it
  disappeared before the shot". *(jhin v7)*
- **Distance is drawn, not assumed.** Small hero + small target + a walk across the frame
  before the shot gave the third shot room. *(jhin v7)*
- **Match the game.** Jhin's W is a thin white line with a blue-violet halo, not a pink wall.
  When the source has a canonical look, use the screenshot. *(jhin v9)*
- **Keep the hero's exit inside its scene.** A grapple that spans scenes breaks when the
  next scene needs a different speaker. Split: exit scene → reaction scene. *(batman v6)*

- **A "miss" must miss by a visible margin.** Aiming a dodgeball at head height and having the target
  lean is not a miss — the ball lands on the head. Misses fly above the standing head and stay flat;
  the dodge starts BEFORE the ball arrives, never after. *(dodgeball v4 → v8)*
- **Worn things are drawn on top.** A medal "behind" the character reads as a sticker on the wall;
  props attached to a figure render after him. Gold is gold (#f2c200), not the theme accent. *(dodgeball v7 → v8)*
- **Anger ramps.** A character at maximum red from the first setback has nowhere to go; escalate the
  expression with the beats (worried → fierce → angry). *(dodgeball v6 review)*
- **Camera should be on whoever owns the beat** (`focus`); captions stay fixed to the frame under
  any camera move. *(dodgeball v4 → v5)*

## Structure

- **First 3 seconds decide everything.** Talking intros lost viewers; open on the action
  and a text hook, character alone, famous line. Standard opening = `bare` + `spotlight` +
  `hook_card`. *(review after wolverine v5)*
- **Exactly one CTA, spoken.** Standard ending = the character hits the screen → cracks →
  black → narrator "Follow Dummy Sticky for more." A funny in-character variant is allowed
  when it lands (Robin relaying Batman's message). *(jhin v6–v8, batman v5)*
- **Don't put anything over the character in the CTA frame.** The batarang overlay on the
  ending hid Robin; the clean frame was better. *(batman v7)*
- **Keep what works.** When the owner says the ending is right, change nothing in it.

## Packaging

- Bio tone chosen: deadpan/dry ("Stick figures. Serious faces. Ridiculous problems.").
- Cover text and hook are the same sentence; hashtags: `#shorts` first on YouTube, `#fyp` on TikTok.
- Watermark on every frame except the `bare` opening.
