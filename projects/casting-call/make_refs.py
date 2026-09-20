"""Build Chatterbox reference clips for The Shapeshifter from the game voice packs Moamen dropped in clips/.

    python projects/casting-call/make_refs.py

Per character: the longest dialogue files, concatenated, gaps > 0.45 s removed, mono 24 kHz, loudness-normalised
to -20 LUFS. Chatterbox wants > 5 s of clean speech; 12-20 s is the sweet spot. Output: clips/ref-<name>.wav
(project-local on purpose - these are third-party recordings, never for assets/voices/).
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CLIPS = HERE / "clips"

PACKS = {
    "vader": ("PC _ Computer - Disney Infinity 3.0 - Playable Character Voices (English) - Darth Vader", ["VDR0286.wav", "VDR0108.wav"]),
    "vegeta": ("PC _ Computer - Dragon Ball Xenoverse 2 - Characters - Vegeta", ["BDQ_VGT_018.wav", "BDQ_VGT_038.wav", "BDQ_VGT_042.wav", "BDQ_VGT_036.wav"]),
    "glados": ("PC _ Computer - Portal 2 - Voices - GLaDOS", ["dlc1_mp_coop_paint_crazy_box_intro02.wav"]),
    "spongebob": ("PlayStation - SpongeBob SquarePants_ SuperSponge - Playable Characters - SpongeBob SquarePants", ["042.wav", "065.wav"]),
    "jinx": ("jinx", ["Jinx_Select.ogg", "Jinx_Ban.ogg"]),
}


def duration(p: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def build(name: str, folder: str, files: list[str]) -> Path:
    srcs = [CLIPS / folder / f for f in files]
    for s in srcs:
        if not s.exists():
            sys.exit(f"missing {s}")
    out = CLIPS / f"ref-{name}.wav"
    args = ["ffmpeg", "-y", "-v", "error"]
    for s in srcs:
        args += ["-i", str(s)]
    chain = f"concat=n={len(srcs)}:v=0:a=1,silenceremove=stop_periods=-1:stop_duration=0.45:stop_threshold=-40dB,aresample=24000,loudnorm=I=-20:TP=-2:LRA=9"
    args += ["-filter_complex", chain, "-ac", "1", "-ar", "24000", str(out)]
    subprocess.run(args, check=True)
    print(f"{out.name:20} {duration(out):5.1f}s  <- {', '.join(files)}")
    return out


if __name__ == "__main__":
    for name, (folder, files) in PACKS.items():
        build(name, folder, files)
