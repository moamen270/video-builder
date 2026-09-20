import json, pathlib
HERE = pathlib.Path(__file__).parent
real = HERE / "manifest.real.json"
m = json.loads(real.read_text(encoding="utf-8"))
by = {s["id"]: s for s in m["scenes"]}

by["open"]["speech"] = "One actor. Five voices."
by["open"]["character"]["poseChanges"] = [{"pose": "mic_out", "expression": "smug", "at": "word:five"}]
by["open"]["pauseAfter"] = 0.7
by["open2"]["pauseAfter"] = 0.7
by["open2"]["sfx"] = [{"name": "breath", "at": "end-0.7", "volume": 0.9}]
by["room"]["speech"] = "Name and talent."
by["name"]["speech"] = "Sticky. Voices."
by["ask1"]["speech"] = "Prove it. Vader."
by["vader1"]["pauseAfter"] = 0.7
by["vader1"]["sfx"] = [{"name": "breath", "at": "end-0.65", "volume": 0.9}]
by["vader2"]["speech"] = "Your parking is terrible."
by["vader2"]["character"]["poseChanges"] = [{"pose": "mic", "at": "word:terrible"}]
by["vegeta2"]["speech"] = "Reduced to a microphone."
by["vegeta2"]["character"]["pose"] = "mic"
by["vegeta2"]["character"]["poseChanges"] = [{"pose": "arms_crossed", "expression": "smug", "at": "word:microphone"}]
by["glados1"]["speech"] = "Congratulations. You survived. That was not the plan."
by["glados1"]["emphasis"] = ["not the plan"]
by["ask5"]["speech"] = "SpongeBob."
by["sponge1"]["pauseAfter"] = 0.5
by["ego"]["speech"] = "One take. Where do I sign?"
by["ego"]["emphasis"] = ["One take"]
by["ego"]["camera"] = [{"move": "punch_in", "at": "word:take"}]
by["rage"]["pauseAfter"] = 0.7
by["cta4"]["speech"] = "I'll make a note."
by["cta5"]["pauseAfter"] = 0.8

drop = {"jinx2", "glados2", "sponge2"}
# the director's laugh moves onto sponge1 (already there); ask5's transform overlay stays.
m["scenes"] = [s for s in m["scenes"] if s["id"] not in drop]
# sponge1 must hand over to the ego scene with a transform (was on sponge2)
by["sponge1"]["sfx"].append({"name": "transform", "at": "end-0.45", "volume": 0.7})
by["sponge1"]["overlays"].append({"kind": "transform", "at": "end-0.5"})

real.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
s = json.dumps(m, indent=2, ensure_ascii=False) + "\n"
for a, b in [("ref-vader.wav", "lewis.wav"), ("ref-jinx.wav", "heart.wav"), ("ref-vegeta.wav", "george.wav"), ("ref-glados.wav", "heart.wav"), ("ref-spongebob.wav", "puck.wav")]:
    s = s.replace(a, b)
(HERE / "manifest.json").write_text(s, encoding="utf-8")
print("scenes:", len(m["scenes"]))
