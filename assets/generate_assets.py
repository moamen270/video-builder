"""Procedurally generate license-free SFX and a lo-fi music loop.

Run from repo root:  uv run --project py python assets/generate_assets.py
Everything here is synthesized from scratch (numpy), so there is no licensing
question. Drop better files into assets/sfx or assets/music at any time — the
engine only cares about the file name (stem) matching the catalog.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import soundfile as sf

SR = 44_100
HERE = Path(__file__).parent
SFX = HERE / "sfx"
MUSIC = HERE / "music"


def t(dur: float) -> np.ndarray:
    return np.arange(int(SR * dur)) / SR


def env(n: int, a: float = 0.005, d: float = 0.2, curve: float = 3.0) -> np.ndarray:
    x = np.arange(n) / SR
    att = np.clip(x / max(a, 1e-4), 0, 1)
    dec = np.exp(-x * (curve / max(d, 1e-3)))
    return att * dec


def norm(x: np.ndarray, peak: float = 0.9) -> np.ndarray:
    m = np.max(np.abs(x)) or 1.0
    return (x / m * peak).astype(np.float32)


def lowpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    # one-pole IIR, cheap and good enough for sfx
    rc = 1.0 / (2 * np.pi * cutoff)
    a = (1 / SR) / (rc + 1 / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc)
        y[i] = acc
    return y


def write(name: str, x: np.ndarray, folder: Path = SFX) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    sf.write(str(folder / f"{name}.wav"), norm(x), SR, subtype="PCM_16")
    print(f"  {folder.name}/{name}.wav  {len(x) / SR:.2f}s")


def pop() -> np.ndarray:
    x = t(0.18)
    f = 900 * np.exp(-x * 30) + 180
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(x), 0.001, 0.09)


def click() -> np.ndarray:
    x = t(0.06)
    return (np.random.default_rng(1).uniform(-1, 1, len(x)) * env(len(x), 0.0005, 0.02) + np.sin(2 * np.pi * 2400 * x) * env(len(x), 0.0005, 0.015))


def tick() -> np.ndarray:
    x = t(0.05)
    return np.sin(2 * np.pi * 3200 * x) * env(len(x), 0.0005, 0.012)


def whoosh(dur: float = 0.45, rising: bool = True) -> np.ndarray:
    rng = np.random.default_rng(2)
    n = int(SR * dur)
    noise = rng.normal(0, 1, n)
    sweep = np.linspace(300, 3500, n) if rising else np.linspace(3500, 300, n)
    out = np.zeros(n)
    # band-ish filter via modulated lowpass: chunked cutoff
    step = 512
    for i in range(0, n, step):
        out[i : i + step] = lowpass(noise[i : i + step], float(sweep[min(i, n - 1)]))
    shape = np.sin(np.pi * np.arange(n) / n) ** 1.5
    return out * shape


def ding() -> np.ndarray:
    x = t(0.9)
    tone = sum(np.sin(2 * np.pi * f * x) * a for f, a in [(1568, 1.0), (3136, 0.35), (4700, 0.15)])
    return tone * env(len(x), 0.002, 0.5)


def boom() -> np.ndarray:
    x = t(1.1)
    f = 140 * np.exp(-x * 4) + 38
    body = np.sin(2 * np.pi * np.cumsum(f) / SR)
    thump = np.random.default_rng(3).normal(0, 1, len(x)) * env(len(x), 0.001, 0.05)
    return body * env(len(x), 0.002, 0.8, 2.2) + lowpass(thump, 400) * 0.6


def error() -> np.ndarray:
    x = t(0.5)
    a = np.sign(np.sin(2 * np.pi * 220 * x)) * 0.5
    b = np.sign(np.sin(2 * np.pi * 165 * x)) * 0.5
    gate = (np.sin(2 * np.pi * 8 * x) > 0).astype(float)
    return lowpass((a + b) * gate, 1800) * env(len(x), 0.002, 0.6, 1.5)


def cash() -> np.ndarray:
    x = t(0.5)
    ch = sum(np.sin(2 * np.pi * f * x) * env(len(x), 0.001, 0.25) for f in (2093, 2637, 3136))
    coins = np.zeros(len(x))
    for k, off in enumerate((0.0, 0.07, 0.15)):
        i = int(off * SR)
        seg = t(0.2)
        coins[i : i + len(seg)] += np.sin(2 * np.pi * (5200 + 400 * k) * seg) * env(len(seg), 0.0005, 0.06)
    return ch * 0.6 + coins


def glitch() -> np.ndarray:
    rng = np.random.default_rng(4)
    x = t(0.35)
    n = len(x)
    out = np.zeros(n)
    for _ in range(9):
        s = rng.integers(0, n - 800)
        ln = rng.integers(200, 800)
        out[s : s + ln] += np.sign(np.sin(2 * np.pi * rng.uniform(300, 2500) * x[:ln])) * rng.uniform(0.3, 1)
    return out * env(n, 0.001, 0.5, 1.2)


def drum() -> np.ndarray:
    x = t(0.4)
    f = 180 * np.exp(-x * 18) + 50
    kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(x), 0.001, 0.25)
    snare = np.random.default_rng(5).normal(0, 1, len(x)) * env(len(x), 0.001, 0.12)
    return kick + lowpass(snare, 5000) * 0.5


def lofi_loop(name: str = "lofi-01", bpm: float = 78, bars: int = 8, seed: int = 7) -> np.ndarray:
    """Warm lo-fi chord loop with soft kick/hat. Loops cleanly (bar-aligned)."""
    rng = np.random.default_rng(seed)
    beat = 60 / bpm
    bar = beat * 4
    n = int(SR * bar * bars)
    out = np.zeros(n)
    # ii–V–I–vi in C: Dm7 G7 Cmaj7 Am7 (voiced low)
    chords = [
        [146.83, 174.61, 220.0, 261.63],
        [98.0, 123.47, 146.83, 174.61],
        [130.81, 164.81, 196.0, 246.94],
        [110.0, 130.81, 164.81, 196.0],
    ]
    for b in range(bars):
        chord = chords[b % len(chords)]
        s = int(b * bar * SR)
        seg = t(bar)
        pad = np.zeros(len(seg))
        for f in chord:
            detune = 1 + rng.uniform(-0.002, 0.002)
            pad += (np.sin(2 * np.pi * f * detune * seg) + 0.4 * np.sin(2 * np.pi * 2 * f * seg) * np.exp(-seg * 2)) * 0.25
        pad *= np.minimum(1, seg / 0.3) * np.exp(-seg * 0.35)
        wobble = 1 + 0.004 * np.sin(2 * np.pi * 0.7 * seg)  # tape flutter
        out[s : s + len(seg)] += lowpass(pad * wobble, 1800)
    # drums
    kick = drum()[: int(SR * 0.3)] * 0.55
    hat = tick() * 0.25
    for b in range(bars):
        for k in (0, 2.5):
            i = int((b * bar + k * beat) * SR)
            out[i : i + len(kick)] += kick[: max(0, min(len(kick), n - i))]
        for h in range(8):
            i = int((b * bar + h * beat / 2) * SR)
            if h % 2 == 1:
                out[i : i + len(hat)] += hat[: max(0, min(len(hat), n - i))]
    # vinyl crackle
    crackle = rng.normal(0, 1, n) * (rng.uniform(0, 1, n) > 0.9985) * 0.4
    out += lowpass(crackle, 3000)
    return out


def main() -> None:
    print("sfx:")
    write("pop", pop())
    write("click", click())
    write("tick", tick())
    write("whoosh", whoosh(0.45, True))
    write("swoosh", whoosh(0.35, False))
    write("ding", ding())
    write("boom", boom())
    write("error", error())
    write("cash", cash())
    write("glitch", glitch())
    write("drum", drum())
    print("music:")
    write("lofi-01", lofi_loop("lofi-01", 78, 8, 7), MUSIC)
    write("lofi-02", lofi_loop("lofi-02", 88, 8, 11), MUSIC)


if __name__ == "__main__":
    main()
