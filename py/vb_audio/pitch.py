"""Median fundamental frequency (F0) of voiced frames, via autocorrelation.

Used to pitch-match a laugh clip to the narrator so it sounds like the same
person:  vb-audio pitch a.wav b.wav ...   → prints median F0 per file.
"""
from __future__ import annotations

import json
import sys

import numpy as np
import soundfile as sf


def median_f0(path: str, fmin: float = 60.0, fmax: float = 400.0) -> dict:
    audio, sr = sf.read(path)
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    audio = audio.astype(np.float64)
    win = int(sr * 0.04)
    hop = int(sr * 0.02)
    lag_min = int(sr / fmax)
    lag_max = int(sr / fmin)
    rms_all = np.sqrt(np.mean(audio**2)) or 1.0
    f0s: list[float] = []
    for i in range(0, len(audio) - win, hop):
        frame = audio[i : i + win]
        if np.sqrt(np.mean(frame**2)) < 0.25 * rms_all:
            continue  # unvoiced / silence
        frame = frame - frame.mean()
        ac = np.correlate(frame, frame, mode="full")[win - 1 :]
        if ac[0] <= 0:
            continue
        ac = ac / ac[0]
        seg = ac[lag_min:lag_max]
        k = int(np.argmax(seg)) + lag_min
        if ac[k] < 0.45:
            continue  # not periodic enough
        f0s.append(sr / k)
    if not f0s:
        return {"file": path, "f0": None, "voicedFrames": 0}
    return {"file": path, "f0": float(np.median(f0s)), "voicedFrames": len(f0s)}


def main(argv: list[str]) -> int:
    print(json.dumps([median_f0(p) for p in argv], indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
