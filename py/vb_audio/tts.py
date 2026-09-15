"""Kokoro-82M synthesis with forced word timestamps.

We never re-transcribe the audio: Kokoro predicts a duration per phoneme, and
misaki maps phonemes back to the source tokens, so every word gets an exact
[start, end] that matches the script by construction.
"""
from __future__ import annotations

import math
import warnings
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import soundfile as sf

SAMPLE_RATE = 24_000
REPO_ID = "hexgrad/Kokoro-82M"

# Kokoro lang codes: 'a' American English, 'b' British English.
_LANG_BY_VOICE_PREFIX = {"a": "a", "b": "b"}


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
    def __init__(self, voice: str, speed: float = 1.0) -> None:
        # Import lazily so `vb-audio doctor` works before the model is downloaded.
        warnings.filterwarnings("ignore", category=FutureWarning)
        warnings.filterwarnings("ignore", category=UserWarning)
        from kokoro import KPipeline  # type: ignore

        lang = _LANG_BY_VOICE_PREFIX.get(voice[0], "a")
        self.voice = voice
        self.speed = speed
        self.pipeline = KPipeline(lang_code=lang, repo_id=REPO_ID)

    def synth_scene(self, scene_id: str, text: str, out_path: Path, pause_after: float = 0.0) -> SceneAudio:
        chunks: list[np.ndarray] = []
        tokens: list[Token] = []
        offset = 0.0

        for result in self.pipeline(text, voice=self.voice, speed=self.speed, split_pattern=r"\n+"):
            audio = result.audio
            if audio is None:
                continue
            audio_np = audio.numpy() if hasattr(audio, "numpy") else np.asarray(audio)
            chunk_dur = len(audio_np) / SAMPLE_RATE
            for tk in result.tokens or []:
                tokens.append(_to_token(tk, offset))
            chunks.append(audio_np.astype(np.float32))
            offset += chunk_dur

        if not chunks:
            raise RuntimeError(f"Kokoro produced no audio for scene {scene_id!r}")

        speech = np.concatenate(chunks)
        speech_dur = len(speech) / SAMPLE_RATE
        if pause_after > 0:
            speech = np.concatenate([speech, np.zeros(int(pause_after * SAMPLE_RATE), dtype=np.float32)])

        out_path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(out_path), speech, SAMPLE_RATE, subtype="PCM_16")

        merged = _merge_punctuation(_fill_missing_timestamps(tokens, speech_dur))
        return SceneAudio(
            scene_id=scene_id,
            file=out_path.name,
            duration=round(speech_dur, 4),
            sample_rate=SAMPLE_RATE,
            tokens=merged,
        )


def _to_token(tk, offset: float) -> Token:
    start = getattr(tk, "start_ts", None)
    end = getattr(tk, "end_ts", None)
    return Token(
        text=tk.text,
        start=(offset + start) if start is not None else math.nan,
        end=(offset + end) if end is not None else math.nan,
        ws=getattr(tk, "whitespace", " ") or "",
    )


def _fill_missing_timestamps(tokens: list[Token], total: float) -> list[Token]:
    """Punctuation tokens have no timestamps; snap them to their neighbours."""
    out: list[Token] = []
    for i, t in enumerate(tokens):
        if not math.isnan(t.start) and not math.isnan(t.end):
            out.append(t)
            continue
        prev_end = out[-1].end if out else 0.0
        nxt = next((x for x in tokens[i + 1 :] if not math.isnan(x.start)), None)
        start = prev_end
        end = nxt.start if nxt else total
        out.append(Token(text=t.text, start=start, end=max(start, end), ws=t.ws))
    return out


def _merge_punctuation(tokens: list[Token]) -> list[Token]:
    """Glue punctuation-only tokens onto the previous word so captions show one word 'fast!' not two."""
    out: list[Token] = []
    for t in tokens:
        if not t.text.strip():
            continue
        is_punct = not any(ch.isalnum() for ch in t.text)
        if is_punct and out:
            prev = out[-1]
            out[-1] = Token(text=prev.text + t.text, start=prev.start, end=max(prev.end, t.end), ws=t.ws)
        elif is_punct:
            continue  # leading punctuation with no word before it: drop
        else:
            out.append(t)
    for t in out:
        t.start = round(t.start, 3)
        t.end = round(t.end, 3)
    return out
