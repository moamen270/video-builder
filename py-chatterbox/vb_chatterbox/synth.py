"""Chatterbox synthesis for one request of scenes.

Two models, chosen per scene:
  * Turbo (350 M)   — when the text carries performance tags ([laugh] [chuckle] [cough]); needs a reference clip > 5 s;
                      `emotion` is ignored (the model has no exaggeration control).
  * original (500 M) — otherwise; `emotion` -> exaggeration (0..1, default 0.5), cfg_weight 0.5 (0.3 when emotion >= 0.7 to
                      undo the speed-up that high exaggeration causes); a reference clip is optional (built-in voice without).

Speed is applied with ffmpeg atempo AFTER synthesis and BEFORE alignment, so timings match the final audio.
Output per scene: 24 kHz mono PCM16 wav (speech + pauseAfter of silence) and word tokens from the aligner.
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import time
import warnings
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import soundfile as sf

from .align import align
from .tags import has_tags, strip_tags

SAMPLE_RATE = 24_000
MIN_REF_SECONDS = 5.0
HEAD_S = 0.08  # lead-in kept before the first word


def _log(msg: str) -> None:
    print(f"[vb-chatterbox] {msg}", file=sys.stderr, flush=True)


@dataclass
class Token:
    text: str
    start: float
    end: float
    ws: str = " "


@dataclass
class SceneAudio:
    scene_id: str
    file: str
    duration: float
    sample_rate: int
    tokens: list[Token] = field(default_factory=list)


class Synth:
    def __init__(self) -> None:
        warnings.filterwarnings("ignore")
        import torch  # type: ignore

        self.torch = torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        _log(f"device {self.device}" + (f" ({torch.cuda.get_device_name(0)})" if self.device == "cuda" else " — expect ~10x slower than GPU"))
        self._turbo = None
        self._orig = None

    # -- models ---------------------------------------------------------------------------------------------------
    def turbo(self):
        if self._turbo is None:
            from chatterbox.tts_turbo import ChatterboxTurboTTS  # type: ignore

            t = time.perf_counter()
            self._turbo = ChatterboxTurboTTS.from_pretrained(device=self.device)
            _log(f"turbo model ready in {time.perf_counter() - t:.1f}s")
        return self._turbo

    def original(self):
        if self._orig is None:
            from chatterbox.tts import ChatterboxTTS  # type: ignore

            t = time.perf_counter()
            self._orig = ChatterboxTTS.from_pretrained(device=self.device)
            _log(f"original model ready in {time.perf_counter() - t:.1f}s")
        return self._orig

    # -- one scene ------------------------------------------------------------------------------------------------
    def synth_scene(
        self,
        scene_id: str,
        text: str,
        out_path: Path,
        *,
        voice_ref: str | None,
        emotion: float = 0.5,
        speed: float = 1.0,
        pause_after: float = 0.0,
        seed: int = 0,
    ) -> SceneAudio:
        tagged = has_tags(text)
        spoken = strip_tags(text)
        if not spoken:
            raise ValueError(f"scene {scene_id!r}: nothing to say after removing tags")
        if voice_ref is not None:
            _check_ref(voice_ref, scene_id)
        elif tagged:
            raise ValueError(f"scene {scene_id!r}: tags like [laugh] need the Turbo model, which needs a voiceRef (> {MIN_REF_SECONDS:.0f} s clip)")

        self.torch.manual_seed(seed)
        if tagged:
            model = self.turbo()
            wav = model.generate(text, audio_prompt_path=voice_ref)
        else:
            model = self.original()
            cfg = 0.3 if emotion >= 0.7 else 0.5
            kwargs = dict(exaggeration=float(emotion), cfg_weight=cfg)
            wav = model.generate(spoken, audio_prompt_path=voice_ref, **kwargs) if voice_ref else model.generate(spoken, **kwargs)
        audio = wav.squeeze().cpu().numpy().astype(np.float32)
        sr = int(model.sr)
        if sr != SAMPLE_RATE:
            audio = _ffmpeg(audio, sr, f"aresample={SAMPLE_RATE}", SAMPLE_RATE)
        if abs(speed - 1.0) > 1e-3:
            audio = _ffmpeg(audio, SAMPLE_RATE, f"atempo={speed:.4f}", SAMPLE_RATE)
        audio = _trim_edges(audio)

        toks = align(audio, SAMPLE_RATE, spoken, self.device)
        # Chatterbox sometimes opens with a click or breath, then 0.5-1 s of nothing before the first word. The aligner
        # knows where the first word is; cut everything before it (minus a small lead-in) so the line lands on the cut.
        if toks:
            lead = max(0.0, toks[0]["start"] - HEAD_S)
            if lead > 0.02:
                audio = audio[int(lead * SAMPLE_RATE):]
                for t in toks:
                    t["start"] = round(max(0.0, t["start"] - lead), 3)
                    t["end"] = round(max(t["start"] + 0.02, t["end"] - lead), 3)
        speech_dur = len(audio) / SAMPLE_RATE
        if pause_after > 0:
            audio = np.concatenate([audio, np.zeros(int(pause_after * SAMPLE_RATE), dtype=np.float32)])
        out_path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(out_path), audio, SAMPLE_RATE, subtype="PCM_16")
        return SceneAudio(
            scene_id=scene_id,
            file=out_path.name,
            duration=round(speech_dur, 4),
            sample_rate=SAMPLE_RATE,
            tokens=[Token(**t) for t in toks],
        )


def _check_ref(path: str, scene_id: str) -> None:
    if not os.path.exists(path):
        raise FileNotFoundError(f"scene {scene_id!r}: voiceRef not found: {path}")
    info = sf.info(path)
    if info.duration <= MIN_REF_SECONDS:
        raise ValueError(f"scene {scene_id!r}: voiceRef {path} is {info.duration:.1f}s; Chatterbox needs > {MIN_REF_SECONDS:.0f}s of clean speech")


def _ffmpeg(audio: np.ndarray, sr: int, filters: str, out_sr: int) -> np.ndarray:
    """Run an ffmpeg audio filter chain on an in-memory float32 buffer."""
    with tempfile.TemporaryDirectory() as d:
        src, dst = Path(d) / "in.wav", Path(d) / "out.wav"
        sf.write(str(src), audio, sr, subtype="FLOAT")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af", filters, "-ar", str(out_sr), "-ac", "1", str(dst)], check=True)
        out, _ = sf.read(str(dst), dtype="float32")
        return out if out.ndim == 1 else out.mean(axis=1)


def _trim_edges(audio: np.ndarray, thresh: float = 0.004, head_s: float = HEAD_S, tail_s: float = 0.12) -> np.ndarray:
    """Chatterbox pads generations with 0.2–1 s of silence on either side, varying per take. Cut it so the line
    starts on the scene cut and `pauseAfter` is the only pause the manifest controls."""
    idx = np.nonzero(np.abs(audio) > thresh)[0]
    if len(idx) == 0:
        return audio
    start = max(0, idx[0] - int(head_s * SAMPLE_RATE))
    end = min(len(audio), idx[-1] + int(tail_s * SAMPLE_RATE))
    return audio[start:end]
