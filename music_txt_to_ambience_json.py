#!/usr/bin/env python3
"""
Convert a youtube_channel_videos.py output file (title | url per line) into
ambience-sounds import JSON: folders, profiles with emojis, and settings.
"""

import argparse
import json
import re
import sys

# Same emoji set as ambience-sounds.js; rotate so each profile gets one
EMOJIS = ["⚔️", "🍺", "⛺", "🌙", "🏰", "🌲", "🕳️", "🔥", "🌧️", "🌊", "🏘️", "🐉", "🦇", "📜", "🕯️", "🎵", "⚡", "❄️", "🌿", "🗡️"]


def slug_for_id(name):
    """Make a safe id fragment from a name (alphanumeric and hyphens)."""
    if not name or not name.strip():
        return "folder"
    s = re.sub(r"[^\w\s-]", "", name)
    s = re.sub(r"[-\s]+", "-", s).strip("-").lower()
    return s or "folder"


# Same six folders as Bardify-music.json; order matches Bardify
BARDIFY_FOLDERS = [
    {"id": "folder-Combat", "name": "Combat", "order": 0},
    {"id": "folder-Exploration", "name": "Exploration", "order": 1},
    {"id": "folder-Narrative", "name": "Narrative", "order": 2},
    {"id": "folder-Nautical", "name": "Nautical", "order": 3},
    {"id": "folder-Social", "name": "Social", "order": 4},
    {"id": "folder-Spooky", "name": "Spooky", "order": 5},
]

# Keywords (lowercase) per folder; first match wins. Order matters: Spooky before Exploration so "death house" beats "dungeon". Default: Narrative.
FOLDER_KEYWORDS = {
    "Combat": ["combat", "battle", "fight", "attack", "raid", "siege", "war", "assault", "surprise", "besieged", "raider", "greenest in flames"],
    "Nautical": ["sea", "ship", "boat", "harbour", "harbor", "port", "maelstrom", "frostskimmr", "saltmarsh", "cove", "crabber", "obad hai", "moving ice", "open waters", "beach", "waters"],
    "Social": ["tavern", "inn", "street", "town", "village", "city", "phandalin", "farm", "orchard", "hall", "provisions", "exchange", "coster", "shrine", "tap room", "stonehill", "fireplace", "library", "feast", "ranchouse", "ale and", "phandalin", "streets"],
    "Spooky": ["haunted", "death house", "death god", "ravenloft", "strahd", "barovia", "vampire", "catacombs", "necropolis", "dark", "shadow", "curse", "bereavement", "old bonegrinder", "amber temple", "yawning portal", "kolat", "xanathar", "asmodeus", "night serpent", "abyss", "ritual", "ominous", "svalich"],
    "Exploration": ["woods", "forest", "cave", "dungeon", "temple", "mine", "trail", "road", "bridge", "hill", "mountain", "excavation", "grove", "basin", "jungle", "chult", "tower", "maze", "stronghold", "hatchery", "camp", "fort", "lodge", "ranch", "manse", "umbrage", "gnomengarde", "dwarven", "dragon barrow", "circle of thunder", "axeholm", "standing stones", "encampment", "journey", "naerytar", "carnath", "dragon hatchery", "xonthal", "oyaviggaton", "serpent hills", "ice caves", "mere of dead", "gnomengarde", "falcon", "butterskull", "conyberry", "neverwinter wood", "umbrage hill", "mountain's toe", "tower of storms", "icespire", "dragon barrow", "dwarven excavation", "lost city", "mbala", "fort beluarian", "fane of the night", "aldani", "camp vengeance", "port nyanzaru", "argynvostholt", "van richten", "tsolenka", "wizard of the wines", "ruins of berez", "kolat towers", "wave echo"],
    "Narrative": [],  # default when nothing else matches
}


def infer_bardify_folder(title):
    """Assign title to one of Bardify's six folders by keyword. Default: Narrative."""
    lower = title.lower()
    for folder_name, keywords in FOLDER_KEYWORDS.items():
        if folder_name == "Narrative":
            continue
        for kw in keywords:
            if kw in lower:
                return folder_name
    return "Narrative"


def default_settings():
    return {
        "playbackMode": "newTab",
        "customColors": None,
        "cardsPerRow": 1,
        "cardSize": "medium",
        "startFromBeginning": True,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Convert title|url text file to ambience-sounds import JSON."
    )
    parser.add_argument(
        "input",
        help="Input text file (lines: 'Title | https://...')",
    )
    parser.add_argument(
        "output",
        nargs="?",
        default=None,
        help="Output JSON path (default: input name with -music.json)",
    )
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        lines = [ln.strip() for ln in f if ln.strip()]

    # Parse lines into (title, url)
    profiles_raw = []
    for line in lines:
        parts = line.split(" | ", 1)
        if len(parts) != 2:
            continue
        title, url = parts[0].strip(), parts[1].strip()
        if not title or not url or ("youtube.com" not in url and "youtu.be" not in url):
            continue
        profiles_raw.append({"title": title, "url": url})

    if not profiles_raw:
        print("No valid title | url lines found.", file=sys.stderr)
        sys.exit(1)

    # Use Bardify's six folders: Combat, Exploration, Narrative, Nautical, Social, Spooky
    folders = list(BARDIFY_FOLDERS)
    name_to_folder_id = {f["name"]: f["id"] for f in folders}

    # Profile slug from input filename for id prefix
    base = re.sub(r"\.txt$", "", args.input, flags=re.IGNORECASE)
    base = re.sub(r"-music$", "", base, flags=re.IGNORECASE).strip()
    profile_slug = slug_for_id(base) if base else "ambience"

    out_profiles = []
    for i, p in enumerate(profiles_raw):
        folder_name = infer_bardify_folder(p["title"])
        folder_id = name_to_folder_id[folder_name]
        icon = EMOJIS[i % len(EMOJIS)]
        out_profiles.append({
            "id": f"id-{profile_slug}-{i + 1}",
            "folderId": folder_id,
            "order": i,
            "name": p["title"],
            "url": p["url"],
            "icon": icon,
        })

    out = {
        "version": 1,
        "settings": default_settings(),
        "folders": folders,
        "profiles": out_profiles,
    }

    out_path = args.output
    if out_path is None:
        out_path = re.sub(r"\.txt$", ".json", args.input, flags=re.IGNORECASE)
        if out_path == args.input:
            out_path = args.input + ".json"

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(out_profiles)} profiles and {len(folders)} folders to {out_path}")


if __name__ == "__main__":
    main()
