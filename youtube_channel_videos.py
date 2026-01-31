#!/usr/bin/env python3
"""
List all videos from a YouTube channel (or playlist) and write title + URL to a text file.
Uses yt-dlp with flat extraction; no downloads, no API key.
"""

import argparse
import re
import sys

import yt_dlp


def sanitize_filename(name):
    """Remove characters invalid in file paths."""
    if not name or not name.strip():
        return "youtube_videos"
    s = re.sub(r'[<>:"/\\|?*]', "", name)
    return s.strip() or "youtube_videos"


def get_video_url(entry):
    """Get watch URL from a flat playlist entry."""
    url = entry.get("url")
    if url:
        return url
    vid = entry.get("id")
    if vid:
        return f"https://www.youtube.com/watch?v={vid}"
    return None


def main():
    parser = argparse.ArgumentParser(
        description="Export YouTube channel/playlist video titles and URLs to a text file."
    )
    parser.add_argument(
        "url",
        help="YouTube channel or playlist URL (e.g. https://www.youtube.com/@handle)",
    )
    parser.add_argument(
        "output",
        nargs="?",
        default=None,
        help="Output file path (default: channel-name-music.txt)",
    )
    args = parser.parse_args()

    ydl_opts = {
        "quiet": True,
        "extract_flat": "in_playlist",
        "no_warnings": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(args.url, download=False)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    if not info:
        print("Error: No data returned for URL.", file=sys.stderr)
        sys.exit(1)

    if args.output is None:
        channel = info.get("channel") or info.get("uploader") or info.get("title")
        base = sanitize_filename(channel) if channel else "youtube_videos"
        args.output = f"{base}-music.txt"

    entries = info.get("entries") or []
    lines = []
    for entry in entries:
        if entry is None:
            continue
        title = entry.get("title") or "Unknown"
        url = get_video_url(entry)
        if not url:
            continue
        lines.append(f"{title} | {url}")

    with open(args.output, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"Wrote {len(lines)} videos to {args.output}")


if __name__ == "__main__":
    main()
