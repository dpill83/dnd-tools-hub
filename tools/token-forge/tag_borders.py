#!/usr/bin/env python3
"""
tag_borders.py - Auto-tag the Token Forge border collection.

Walks a folder of border images, extracts metadata from each one
(theme + mood from filename, dominant color + shape from pixels),
and writes a manifest.json the Token Forge UI uses to build filter chips.

Usage:
    python tag_borders.py                  # uses ./borders, writes ./borders/manifest.json
    python tag_borders.py --dir path/to/borders
    python tag_borders.py --rebuild        # re-analyze every file (ignore cache)

Requires: Pillow  (pip install pillow)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("error: Pillow is required. Install with:  pip install pillow", file=sys.stderr)
    sys.exit(1)


# ---------- Vocabulary ----------
# Edit these freely. Anything added here becomes a clickable chip in the UI
# as soon as at least one filename matches.

THEME_WORDS: set[str] = {
    # D&D classes
    "barbarian", "bard", "cleric", "druid", "fighter", "monk",
    "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard",
    "artificer", "blood-hunter",
    # Races / peoples
    "elf", "dwarf", "human", "halfling", "gnome", "orc", "half-orc",
    "half-elf", "tiefling", "dragonborn", "goblin", "kobold",
    "aquafolk", "merfolk", "fae", "fairy",
    # Monsters / creatures
    "werewolf", "vampire", "lich", "dragon", "demon", "angel",
    "skeleton", "zombie", "ghost", "wraith", "phoenix", "griffin",
    "wolf", "bear", "bird", "snake", "spider",
    # Professions / archetypes
    "baker", "herbalist", "hunter", "alchemist", "blacksmith",
    "merchant", "thief", "knight", "noble", "priest", "scholar",
    # Materials & gems
    "obsidian", "ivory", "bone", "stone", "wood",
    "emerald", "ruby", "sapphire", "amethyst", "diamond", "topaz",
    "sunstone", "moonstone", "opal", "onyx", "jade", "pearl",
    # Elements / arcane
    "fire", "water", "earth", "air", "ice", "lightning", "shadow",
    "light", "void", "arcane", "divine", "nature", "blood",
}

MOOD_WORDS: set[str] = {
    "sacred", "wild", "musical", "feathered", "natural", "delicate",
    "sturdy", "simple", "radiant", "forest", "discreet", "dark",
    "moonlit", "marine", "ornate", "elegant", "rough", "battered",
    "ancient", "twisted", "thorny", "leafy", "icy", "fiery",
    "shadowy", "glowing", "rustic", "regal", "magical", "mystical",
    "grim", "holy", "cursed", "blessed",
}

COLOR_NAMES = {
    "gold", "silver", "bronze", "copper", "red", "orange",
    "green", "teal", "blue", "purple", "pink", "dark", "mixed",
}

SHAPE_NAMES = {"round", "square", "oval", "rectangle", "irregular"}

# Color bucket definitions: (name, hue_min_deg, hue_max_deg, sat_min, val_min, val_max)
# Tuned for stylized fantasy borders. "silver" and "dark" are detected separately.
_COLOR_BUCKETS = [
    ("gold",    40,  60,  0.35, 0.45, 1.00),
    ("bronze",  20,  40,  0.30, 0.20, 0.65),
    ("copper",  10,  30,  0.40, 0.30, 0.85),
    ("red",      0,  15,  0.35, 0.20, 1.00),
    ("red",    345, 360,  0.35, 0.20, 1.00),
    ("orange",  15,  35,  0.45, 0.50, 1.00),
    ("green",   80, 160,  0.25, 0.20, 1.00),
    ("teal",   160, 200,  0.25, 0.20, 1.00),
    ("blue",   200, 250,  0.25, 0.15, 1.00),
    ("purple", 250, 310,  0.25, 0.15, 1.00),
    ("pink",   310, 345,  0.25, 0.40, 1.00),
]


# ---------- Filename parsing ----------

_ATTRIB_RE = re.compile(
    r"(by[-_ ]+sacred[-_ ]*arts[-_ ]*designs[-_ ]*etsy.*"
    r"|sacred[-_ ]*arts[-_ ]*designs[-_ ]*etsy.*"
    r"|crafted[-_ ]*by[-_ ]*.*etsy.*"
    r"|created[-_ ]*by[-_ ]*.*etsy.*"
    r"|made[-_ ]*by[-_ ]*.*etsy.*"
    r"|art[-_ ]*by[-_ ]*.*etsy.*"
    r"|design[-_ ]*by[-_ ]*.*etsy.*"
    r"|createdby[-_ ]*.*etsy.*"
    r")",
    re.IGNORECASE,
)
_UUID_RE = re.compile(r"[0-9a-f]{6,8}(?:-[0-9a-f]{2,8}){1,4}", re.IGNORECASE)
_HEX_RUN_RE = re.compile(r"\b[0-9a-f]{6,}\b", re.IGNORECASE)
_NOISE = {"a", "border", "with", "and", "the", "of", "frame", "circle",
          "token", "empty", "ring", "perha", "circl", "wi", "wit", "w"}


def _filename_tokens(stem: str) -> list[str]:
    s = _ATTRIB_RE.sub(" ", stem)
    s = _UUID_RE.sub(" ", s)
    s = _HEX_RUN_RE.sub(" ", s)
    s = s.lower()
    parts = re.split(r"[^a-z\-]+", s)
    return [p.strip("-") for p in parts if p and p not in _NOISE and len(p.strip("-")) > 1]


def extract_filename_tags(stem: str) -> tuple[list[str], list[str]]:
    """Return (themes, moods) recognized in the filename."""
    tokens = _filename_tokens(stem)
    joined = " " + " ".join(tokens) + " "

    themes: list[str] = []
    moods: list[str] = []
    seen: set[str] = set()

    # Multi-word/hyphenated themes first
    for theme in THEME_WORDS:
        if "-" in theme and theme not in seen:
            if f" {theme} " in joined:
                themes.append(theme)
                seen.add(theme)

    for tok in tokens:
        if tok in THEME_WORDS and tok not in seen:
            themes.append(tok)
            seen.add(tok)
        if tok in MOOD_WORDS and tok not in seen:
            moods.append(tok)
            seen.add(tok)

    return themes, moods


# ---------- Image analysis ----------

def analyze_image(path: Path) -> dict:
    """Return {color, shape} derived from pixels."""
    try:
        with Image.open(path) as im:
            im = im.convert("RGBA")
            im.thumbnail((256, 256))  # plenty for color/shape detection
            w, h = im.size
            pixels = list(im.getdata())
    except Exception as e:
        return {"color": "mixed", "shape": "irregular", "error": str(e)}

    # ---- Shape from alpha bounding box + corner sampling ----
    opaque_count = 0
    min_x, min_y, max_x, max_y = w, h, -1, -1
    for i, (_, _, _, a) in enumerate(pixels):
        if a >= 200:
            opaque_count += 1
            x, y = i % w, i // w
            if x < min_x: min_x = x
            if x > max_x: max_x = x
            if y < min_y: min_y = y
            if y > max_y: max_y = y

    if opaque_count < 100 or max_x < 0:
        return {"color": "mixed", "shape": "irregular"}

    bbox_w = max_x - min_x + 1
    bbox_h = max_y - min_y + 1
    aspect = bbox_w / bbox_h if bbox_h else 1.0
    corners = [(min_x, min_y), (max_x, min_y), (min_x, max_y), (max_x, max_y)]
    avg_corner_alpha = sum(pixels[cy * w + cx][3] for cx, cy in corners) / 4

    if 0.88 <= aspect <= 1.14:
        shape = "round" if avg_corner_alpha < 80 else "square"
    else:
        shape = "oval" if avg_corner_alpha < 80 else "rectangle"

    # ---- Dominant color via HSV bucketing ----
    bucket_counts: Counter[str] = Counter()
    darks = lights = total = 0

    for r, g, b, a in pixels:
        if a < 200:
            continue
        mx, mn = max(r, g, b), min(r, g, b)
        v = mx / 255.0
        delta = mx - mn
        s = (delta / mx) if mx > 0 else 0.0

        if v < 0.18:
            darks += 1
            total += 1
            continue
        if s < 0.15 and v > 0.55:
            lights += 1
            total += 1
            continue

        if delta == 0:
            hue = 0.0
        elif mx == r:
            hue = 60.0 * (((g - b) / delta) % 6)
        elif mx == g:
            hue = 60.0 * ((b - r) / delta + 2)
        else:
            hue = 60.0 * ((r - g) / delta + 4)

        for name, hmin, hmax, smin, vmin, vmax in _COLOR_BUCKETS:
            if hmin <= hue <= hmax and s >= smin and vmin <= v <= vmax:
                bucket_counts[name] += 1
                break
        total += 1

    if total == 0:
        return {"color": "mixed", "shape": shape}

    # Promote silver/dark if they dominate
    if lights / total > 0.35:
        bucket_counts["silver"] = lights
    if darks / total > 0.45:
        bucket_counts["dark"] = darks

    if not bucket_counts:
        color = "mixed"
    else:
        top, count = bucket_counts.most_common(1)[0]
        color = top if count / total > 0.18 else "mixed"

    return {"color": color, "shape": shape}


# ---------- Main ----------

_IMAGE_EXTS = {".png", ".webp", ".jpg", ".jpeg"}


def main() -> int:
    ap = argparse.ArgumentParser(description="Tag Token Forge borders.")
    ap.add_argument("--dir", default="borders",
                    help="Folder of border images (default: ./borders)")
    ap.add_argument("--out", default=None,
                    help="Output manifest path (default: <dir>/manifest.json)")
    ap.add_argument("--rebuild", action="store_true",
                    help="Re-analyze every file, ignoring cache.")
    args = ap.parse_args()

    folder = Path(args.dir)
    if not folder.is_dir():
        print(f"error: not a directory: {folder}", file=sys.stderr)
        return 1

    out_path = Path(args.out) if args.out else folder / "manifest.json"

    # Use existing manifest as a cache so re-runs only process new/changed files
    cache: dict[str, dict] = {}
    if out_path.exists() and not args.rebuild:
        try:
            existing = json.loads(out_path.read_text(encoding="utf-8"))
            if isinstance(existing, dict) and existing.get("version") == 2:
                for entry in existing.get("borders", []):
                    cache[entry["file"]] = entry
        except Exception:
            pass

    files = sorted(
        p for p in folder.iterdir()
        if p.is_file() and p.suffix.lower() in _IMAGE_EXTS
    )

    entries: list[dict] = []
    tag_counts: Counter[str] = Counter()
    new_count = 0

    for i, p in enumerate(files, 1):
        mtime = int(p.stat().st_mtime)
        cached = cache.get(p.name)
        if cached and cached.get("mtime") == mtime:
            entry = cached
        else:
            themes, moods = extract_filename_tags(p.stem)
            visual = analyze_image(p)
            color = visual.get("color", "mixed")
            shape = visual.get("shape", "irregular")
            tags = list(dict.fromkeys(themes + moods + [color, shape]))
            entry = {
                "file": p.name,
                "mtime": mtime,
                "themes": themes,
                "moods": moods,
                "color": color,
                "shape": shape,
                "tags": tags,
            }
            new_count += 1

        entries.append(entry)
        for t in entry["tags"]:
            tag_counts[t] += 1

        if i % 25 == 0 or i == len(files):
            print(f"\r  {i}/{len(files)} processed", end="", file=sys.stderr, flush=True)

    print("", file=sys.stderr)

    def _group(names: set[str]) -> list[list]:
        return sorted(
            ([t, c] for t, c in tag_counts.items() if t in names),
            key=lambda kv: -kv[1],
        )

    chips = {
        "theme": _group(THEME_WORDS),
        "mood":  _group(MOOD_WORDS),
        "color": _group(COLOR_NAMES),
        "shape": _group(SHAPE_NAMES),
    }

    output = {
        "version": 2,
        "count": len(entries),
        "chips": chips,
        "borders": entries,
    }

    out_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"\nWrote {out_path}", file=sys.stderr)
    print(f"  borders:  {len(entries)}", file=sys.stderr)
    print(f"  new/changed: {new_count}", file=sys.stderr)

    print("\nTop chips by category:", file=sys.stderr)
    for group, items in chips.items():
        head = ", ".join(f"{name}:{n}" for name, n in items[:10])
        print(f"  {group:6s} {head or '(none)'}", file=sys.stderr)

    untagged = sum(1 for e in entries if not e["themes"] and not e["moods"])
    if untagged:
        print(f"\nNote: {untagged} files had no theme/mood tags from filename "
              f"(only color/shape). Add more words to THEME_WORDS / MOOD_WORDS "
              f"and re-run with --rebuild to expand coverage.", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
