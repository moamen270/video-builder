"""CLI used by the Node orchestrator (engine/src/audio.ts).

  vb-chatterbox synth --request req.json --out-dir projects/x/build/audio --out result.json
  vb-chatterbox doctor

Request JSON: {"scenes": [{"id": "hook", "speech": "[laugh] I'm Batman.", "pauseAfter": 0.25, "speed": 1.0,
                           "voiceRef": "F:/.../assets/voices/lewis.wav" | null, "emotion": 0.6, "seed": 0, "hash": "..."}]}
Result JSON has the same shape as py/vb_audio's, so alignment.json does not care which engine spoke.
Never print data to stdout: torch/transformers write there. Data goes to --out.
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import sys
import time
from pathlib import Path

MODEL_ID = "ResembleAI/chatterbox"


def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def cmd_synth(args: argparse.Namespace) -> int:
    import warnings

    warnings.filterwarnings("ignore")
    from .synth import Synth

    req = json.loads(Path(args.request).read_text(encoding="utf-8"))
    out_dir = Path(args.out_dir)
    synth = Synth()
    scenes = []
    for sc in req["scenes"]:
        t1 = time.perf_counter()
        res = synth.synth_scene(
            sc["id"],
            sc["speech"],
            out_dir / f"{sc['id']}.wav",
            voice_ref=sc.get("voiceRef") or None,
            emotion=float(sc.get("emotion", 0.5)),
            speed=float(sc.get("speed", 1.0)),
            pause_after=float(sc.get("pauseAfter", 0.0)),
            seed=int(sc.get("seed", 0)),
        )
        d = dataclasses.asdict(res)
        d["sceneId"] = d.pop("scene_id")
        d["sampleRate"] = d.pop("sample_rate")
        d["hash"] = sc.get("hash", "")
        scenes.append(d)
        _log(f"[vb-chatterbox] {sc['id']}: {res.duration:.2f}s audio, {len(res.tokens)} words, {time.perf_counter() - t1:.1f}s")
    Path(args.out).write_text(json.dumps({"model": MODEL_ID, "scenes": scenes}), encoding="utf-8")
    return 0


def cmd_doctor(_: argparse.Namespace) -> int:
    import warnings

    warnings.filterwarnings("ignore")  # perth's pkg_resources deprecation notice is noise here
    ok = True
    try:
        import torch  # type: ignore

        _log(f"torch {torch.__version__} cuda={torch.cuda.is_available()}")
        if not torch.cuda.is_available():
            _log("warning: no CUDA — Chatterbox will run on CPU (slow). Reinstall torch from the cu126 index.")
    except Exception as e:  # noqa: BLE001
        _log(f"torch: MISSING ({e})")
        ok = False
    try:
        import chatterbox  # type: ignore  # noqa: F401
        import perth  # type: ignore

        if perth.PerthImplicitWatermarker is None:
            _log("perth watermarker unavailable (pkg_resources missing → pin setuptools<81)")
            ok = False
        else:
            _log("chatterbox + perth ok")
    except Exception as e:  # noqa: BLE001
        _log(f"chatterbox: MISSING ({e})")
        ok = False
    try:
        import torchaudio  # type: ignore

        _log(f"torchaudio {torchaudio.__version__} (aligner)")
    except Exception as e:  # noqa: BLE001
        _log(f"torchaudio: MISSING ({e})")
        ok = False
    print(json.dumps({"ok": ok}))
    return 0 if ok else 1


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="vb-chatterbox")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("synth")
    s.add_argument("--request", required=True)
    s.add_argument("--out-dir", required=True)
    s.add_argument("--out", required=True)
    s.set_defaults(fn=cmd_synth)
    d = sub.add_parser("doctor")
    d.set_defaults(fn=cmd_doctor)
    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
