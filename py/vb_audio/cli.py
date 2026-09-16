"""CLI used by the Node orchestrator.

  vb-audio synth --request req.json --out-dir projects/x/audio --out align.json
  vb-audio doctor                                                -> checks model + deps
  vb-audio probe file.wav                                        -> duration/sample rate

Request JSON: {"voice": "af_heart", "speed": 1.05,
               "scenes": [{"id": "hook", "speech": "...", "pauseAfter": 0.25, "hash": "..."}]}
"""
from __future__ import annotations

import argparse
import dataclasses
import json
import sys
import time
from pathlib import Path


def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def cmd_synth(args: argparse.Namespace) -> int:
    from .tts import REPO_ID, Synth

    req = json.loads(Path(args.request).read_text(encoding="utf-8"))
    out_dir = Path(args.out_dir)
    t0 = time.perf_counter()
    synth = Synth(voice=req["voice"], speed=float(req.get("speed", 1.0)))
    _log(f"[vb-audio] model ready in {time.perf_counter() - t0:.1f}s")

    scenes = []
    for sc in req["scenes"]:
        t1 = time.perf_counter()
        res = synth.synth_scene(
            scene_id=sc["id"],
            text=sc["speech"],
            out_path=out_dir / f"{sc['id']}.wav",
            pause_after=float(sc.get("pauseAfter", 0.0)),
            speed=float(sc["speed"]) if sc.get("speed") is not None else None,
        )
        d = dataclasses.asdict(res)
        d["sceneId"] = d.pop("scene_id")
        d["sampleRate"] = d.pop("sample_rate")
        d["hash"] = sc.get("hash", "")
        scenes.append(d)
        _log(
            f"[vb-audio] {sc['id']}: {res.duration:.2f}s audio, {len(res.tokens)} words, "
            f"{time.perf_counter() - t1:.1f}s"
        )

    out = {"model": REPO_ID, "voice": req["voice"], "speed": float(req.get("speed", 1.0)), "scenes": scenes}
    # Never use stdout for data: third-party libs (spaCy, HF hub) print to it.
    Path(args.out).write_text(json.dumps(out), encoding="utf-8")
    return 0


def cmd_doctor(_: argparse.Namespace) -> int:
    ok = True
    try:
        import torch  # type: ignore

        _log(f"torch {torch.__version__} cuda={torch.cuda.is_available()}")
    except Exception as e:  # noqa: BLE001
        _log(f"torch: MISSING ({e})")
        ok = False
    try:
        import kokoro  # type: ignore

        _log(f"kokoro {getattr(kokoro, '__version__', '?')}")
    except Exception as e:  # noqa: BLE001
        _log(f"kokoro: MISSING ({e})")
        ok = False
    try:
        from misaki import en  # type: ignore  # noqa: F401

        _log("misaki[en] ok")
    except Exception as e:  # noqa: BLE001
        _log(f"misaki: MISSING ({e})")
        ok = False
    print(json.dumps({"ok": ok}))
    return 0 if ok else 1


def cmd_probe(args: argparse.Namespace) -> int:
    import soundfile as sf

    info = sf.info(args.file)
    print(json.dumps({"duration": info.duration, "sampleRate": info.samplerate, "channels": info.channels}))
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="vb-audio")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("synth")
    s.add_argument("--request", required=True)
    s.add_argument("--out-dir", required=True)
    s.add_argument("--out", required=True, help="where to write the alignment JSON")
    s.set_defaults(fn=cmd_synth)

    d = sub.add_parser("doctor")
    d.set_defaults(fn=cmd_doctor)

    pr = sub.add_parser("probe")
    pr.add_argument("file")
    pr.set_defaults(fn=cmd_probe)

    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
