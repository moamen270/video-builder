"""Generate laughter (and other non-speech vocalisations) with Bark.

Kokoro is a narration model: it *reads* "ha ha ha". Bark is generative and
actually laughs when given "[laughs]". Output is non-deterministic, so we
render several candidates and rank them by a laugh-likeness score: how much of
the clip's energy is amplitude-modulated in the 3–7 Hz "ha-ha-ha" band, and
how much of the clip is actually voiced. The caller (or a human) picks.

  vb-audio laugh --out projects/x/clips --count 4 --prompt "[laughs] Ha ha ha ha! [laughs]"
"""
from __future__ import annotations

import json
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import soundfile as sf

BARK_MODEL = "suno/bark-small"
BARK_SR = 24_000
DEFAULT_PROMPT = "[laughs] Ha ha ha ha ha ha! [laughs] Ahh ha ha ha ha! [laughs]"
DEFAULT_VOICE = "v2/en_speaker_6"  # deep male preset


@dataclass
class Candidate:
    file: str
    seed: int
    duration: float
    score: float
    voiced_ratio: float
    modulation: float


def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def laugh_score(audio: np.ndarray, sr: int) -> tuple[float, float, float]:
    """Return (score, voiced_ratio, modulation) — higher score = more laugh-like."""
    hop = int(sr * 0.01)  # 10 ms envelope
    n = len(audio) // hop
    if n < 20:
        return 0.0, 0.0, 0.0
    env = np.sqrt(np.mean(audio[: n * hop].reshape(n, hop) ** 2, axis=1))
    env = env / (env.max() or 1.0)
    voiced_ratio = float(np.mean(env > 0.12))
    e = env - env.mean()
    spec = np.abs(np.fft.rfft(e * np.hanning(len(e))))
    freqs = np.fft.rfftfreq(len(e), d=0.01)
    band = spec[(freqs >= 3.0) & (freqs <= 7.0)].sum()
    total = spec[(freqs >= 0.5) & (freqs <= 20.0)].sum() or 1.0
    modulation = float(band / total)
    # Penalise clips that are mostly silence or mostly one long tone.
    score = modulation * min(1.0, voiced_ratio / 0.45)
    return float(score), voiced_ratio, modulation


def trim_silence(audio: np.ndarray, sr: int, thresh: float = 0.02, pad: float = 0.08) -> np.ndarray:
    idx = np.where(np.abs(audio) > thresh)[0]
    if len(idx) == 0:
        return audio
    a = max(0, idx[0] - int(pad * sr))
    b = min(len(audio), idx[-1] + int(pad * sr))
    return audio[a:b]


def generate(out_dir: Path, prompt: str, voice: str, count: int, seed0: int, max_seconds: float) -> list[Candidate]:
    import torch  # type: ignore
    from transformers import AutoProcessor, BarkModel  # type: ignore

    t0 = time.perf_counter()
    processor = AutoProcessor.from_pretrained(BARK_MODEL)
    model = BarkModel.from_pretrained(BARK_MODEL)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)
    _log(f"[laugh] bark ready on {device} in {time.perf_counter() - t0:.1f}s")

    out_dir.mkdir(parents=True, exist_ok=True)
    inputs = processor(prompt, voice_preset=voice, return_tensors="pt")
    inputs = {k: (v.to(device) if hasattr(v, "to") else v) for k, v in inputs.items()}
    results: list[Candidate] = []
    for i in range(count):
        seed = seed0 + i
        torch.manual_seed(seed)
        t1 = time.perf_counter()
        with torch.inference_mode():
            audio = model.generate(**inputs, do_sample=True, fine_temperature=0.5, coarse_temperature=0.6, semantic_temperature=0.7)
        wav = audio.cpu().numpy().squeeze().astype(np.float32)
        wav = trim_silence(wav, BARK_SR)
        wav = wav[: int(max_seconds * BARK_SR)]
        wav = wav / (np.max(np.abs(wav)) or 1.0) * 0.9
        score, voiced, mod = laugh_score(wav, BARK_SR)
        f = out_dir / f"laugh_{seed}.wav"
        sf.write(str(f), wav, BARK_SR, subtype="PCM_16")
        c = Candidate(file=f.name, seed=seed, duration=round(len(wav) / BARK_SR, 2), score=round(score, 3), voiced_ratio=round(voiced, 2), modulation=round(mod, 3))
        results.append(c)
        _log(f"[laugh] seed {seed}: {c.duration}s score={c.score} voiced={c.voiced_ratio} mod={c.modulation} ({time.perf_counter() - t1:.0f}s)")
    results.sort(key=lambda c: c.score, reverse=True)
    (out_dir / "candidates.json").write_text(json.dumps([asdict(c) for c in results], indent=2), encoding="utf-8")
    return results
