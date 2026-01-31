#!/usr/bin/env python3
"""Generate presets/sword-coast-soundscapes-music.js from Sword Coast Soundscapes-music.json."""
import json
import os

INPUT = "Sword Coast Soundscapes-music.json"
OUTPUT = os.path.join("presets", "sword-coast-soundscapes-music.js")
KEY = "Sword Coast Soundscapes"

with open(INPUT, "r", encoding="utf-8") as f:
    data = json.load(f)
compact = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
line = '(function(){window.AMBIENCE_PRESETS=window.AMBIENCE_PRESETS||{};window.AMBIENCE_PRESETS["' + KEY + '"]=' + compact + ';})();'
with open(OUTPUT, "w", encoding="utf-8") as out:
    out.write(line)
print("Wrote", OUTPUT)
