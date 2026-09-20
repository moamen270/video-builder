"""Forced alignment: word timestamps for audio whose text we already know.

Chatterbox returns audio only. We trust the transcript and let a CTC acoustic model (torchaudio's
WAV2VEC2_ASR_BASE_960H, English, ~360 MB, cached under TORCH_HOME) decide *when* each word happens.
Calibrated against Kokoro's native timestamps in F:/PoCs/audios/experiments/003-alignment: the CTC
emissions fire ~75 ms late (std 23 ms); after subtracting that, word starts are within 12 ms median /
37 ms p90 — inside one video frame.

Output tokens follow py/vb_audio's convention: punctuation glued to the previous word, `ws` " ".
Differences from Kokoro: the last word ends at its acoustic end, not at the end of the file.
"""
from __future__ import annotations

import re

import numpy as np
import soundfile as sf
import torch
import torchaudio

START_BIAS_S = 0.075
END_BIAS_S = 0.020

_bundle = None
_model = None
_labels = None


def _load(device: str):
    global _bundle, _model, _labels
    if _model is None:
        _bundle = torchaudio.pipelines.WAV2VEC2_ASR_BASE_960H
        _model = _bundle.get_model().to(device).eval()
        _labels = _bundle.get_labels()
    return _bundle, _model, _labels


def words_of(text: str) -> list[dict]:
    """Whitespace-split words with punctuation kept; `letters` is what the CTC model can emit (A-Z and ')."""
    out = []
    for m in re.finditer(r"\S+", text):
        w = m.group(0)
        letters = re.sub(r"[^A-Za-z']", "", w).upper()
        if letters:
            out.append({"text": w, "letters": letters})
    return out


def align(audio: np.ndarray, sr: int, text: str, device: str) -> list[dict]:
    """Return [{text,start,end,ws}] in seconds for `text` spoken in `audio` (mono float32)."""
    bundle, model, labels = _load(device)
    wave = torch.from_numpy(np.asarray(audio, dtype=np.float32)).unsqueeze(0)
    if sr != bundle.sample_rate:
        wave = torchaudio.functional.resample(wave, sr, bundle.sample_rate)
    with torch.inference_mode():
        emission, _ = model(wave.to(device))
    emission = torch.log_softmax(emission, dim=-1).cpu()

    words = words_of(text)
    if not words:
        return []
    label_idx = {c: i for i, c in enumerate(labels)}
    transcript = "|".join(w["letters"] for w in words)
    targets = torch.tensor([[label_idx.get(c, label_idx["|"]) for c in transcript]], dtype=torch.int32)
    aligned, scores = torchaudio.functional.forced_align(emission, targets, blank=0)
    spans = torchaudio.functional.merge_tokens(aligned[0], scores[0].exp())

    frame_sec = wave.shape[1] / bundle.sample_rate / emission.shape[1]
    total = wave.shape[1] / bundle.sample_rate
    out, i = [], 0
    for w in words:
        n = len(w["letters"])
        chunk = spans[i : i + n]
        i += n + 1  # skip the '|' separator
        if not chunk:
            continue
        start = max(0.0, chunk[0].start * frame_sec - START_BIAS_S)
        end = min(total, max(start + 0.02, (chunk[-1].end + 1) * frame_sec - END_BIAS_S))
        out.append({"text": w["text"], "start": round(start, 3), "end": round(end, 3), "ws": " "})
    return out


def align_file(path: str, text: str, device: str | None = None) -> list[dict]:
    audio, sr = sf.read(path, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return align(audio, sr, text, device or ("cuda" if torch.cuda.is_available() else "cpu"))


def transcribe(audio: np.ndarray, sr: int, device: str) -> str:
    """Greedy CTC decode with the same wav2vec2 model: what the line actually sounds like, as text."""
    bundle, model, labels = _load(device)
    wave = torch.from_numpy(np.asarray(audio, dtype=np.float32)).unsqueeze(0)
    if sr != bundle.sample_rate:
        wave = torchaudio.functional.resample(wave, sr, bundle.sample_rate)
    with torch.inference_mode():
        emission, _ = model(wave.to(device))
    idx = emission[0].argmax(-1).tolist()
    out, prev = [], None
    for i in idx:
        if i != prev and i != 0:
            out.append(labels[i])
        prev = i
    return "".join(out).replace("|", " ").strip().lower()


def intelligibility(audio: np.ndarray, sr: int, text: str, device: str) -> tuple[float, str]:
    """0..1 similarity between the ASR read-back and the intended words (letters only). Below ~0.6 a listener
    will not catch the line either — e.g. Chatterbox turning 'Dummy Sticky' into a smear at high exaggeration."""
    import difflib

    heard = transcribe(audio, sr, device)
    want = " ".join(w["letters"].lower() for w in words_of(text))
    got = re.sub(r"[^a-z' ]", "", heard)
    score = difflib.SequenceMatcher(None, want.replace(" ", ""), got.replace(" ", "")).ratio()
    return round(score, 3), heard
