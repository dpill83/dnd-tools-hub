#!/usr/bin/env python3
"""
Scrape main article text from D&D Wikidot wiki pages (dnd5e.wikidot.com, dnd2024.wikidot.com).
Extracts #page-content / #main-content; outputs plain text to stdout and/or files.
Use --crawl to follow links and scrape entire site(s) from seed URL(s).
"""

import argparse
import csv
import os
import re
import sys
import time
import warnings
from collections import deque
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)


DEFAULT_URLS = [
    "https://dnd5e.wikidot.com/",
    "http://dnd2024.wikidot.com/",
]
# Browser-like headers so Wikidot serves the same content as in a browser (avoids 404 for real pages)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
REQUEST_TIMEOUT = 15


def sanitize_filename(name):
    """Remove characters invalid in file paths; limit length."""
    if not name or not name.strip():
        return "page"
    s = re.sub(r'[<>:"/\\|?*]', "", name)
    s = s.strip() or "page"
    return s[:80] if len(s) > 80 else s


def filename_from_url(url):
    """Derive a safe filename from a page URL."""
    parsed = urlparse(url)
    netloc = parsed.netloc.replace(".", "-")
    path = (parsed.path or "/").strip("/").replace("/", "-").replace(":", "-")
    if path and path != "-":
        name = f"{netloc}-{path}"
    else:
        name = netloc or "page"
    return sanitize_filename(name) + ".txt"


def normalize_url(url, base_url):
    """Resolve relative URL and strip fragment for consistent deduplication."""
    full = urljoin(base_url, url)
    parsed = list(urlparse(full))
    parsed[5] = ""  # remove fragment
    return urlunparse(parsed).rstrip("/") or full


def should_skip_url(url):
    """True if URL is a non-page (demo, help template, XML feed, forum, etc.) and should not be fetched."""
    parsed = urlparse(url)
    path = (parsed.path or "/").strip("/")
    if path.startswith("system:") or path.startswith("nav:") or "login" in path.lower():
        return True
    if path.startswith("demo:") or path.startswith("help:_"):
        return True
    if ".xml" in path or "feed" in path.lower() or "forum-threads" in path.lower():
        return True
    # Forum threads and posts (e.g. forum:t-14029426, forum-t-14029426-daylight-bard-spell-list)
    if path.startswith("forum") or "forum-t-" in path:
        return True
    return False


def extract_links(html, base_url, allowed_netlocs):
    """Return set of same-domain page URLs from HTML (all <a href>)."""
    soup = BeautifulSoup(html, "html.parser")
    seen = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith("#") or href.startswith("mailto:"):
            continue
        full = normalize_url(href, base_url)
        parsed = urlparse(full)
        if parsed.scheme not in ("http", "https"):
            continue
        if parsed.netloc not in allowed_netlocs:
            continue
        if should_skip_url(full):
            continue
        seen.add(full)
    return seen


def _log_crawl(log_handle, log_writer, url, status, details):
    """Write one row to the crawl report CSV and flush."""
    row = [url, status, str(details), time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())]
    log_writer.writerow(row)
    log_handle.flush()


def crawl(seed_urls, output_dir, delay, report_path=None, skip_existing=False):
    """Crawl entire site(s) from seed URLs; save one .txt per page in output_dir; write report log."""
    os.makedirs(output_dir, exist_ok=True)
    if report_path is None:
        report_path = os.path.join(output_dir, "scrape_report.csv")
    log_handle = open(report_path, "w", encoding="utf-8", newline="")
    log_writer = csv.writer(log_handle)
    log_writer.writerow(["url", "status", "details", "timestamp"])
    log_handle.flush()

    allowed_netlocs = {urlparse(u).netloc for u in seed_urls}
    queue = deque(normalize_url(u, u) for u in seed_urls)
    visited = set()
    done = 0
    skipped = 0
    try:
        print(f"Report log: {report_path}", file=sys.stderr)
        if skip_existing:
            print("Skip-existing: will not overwrite files that already exist.", file=sys.stderr)
        while queue:
            url = queue.popleft()
            if url in visited:
                continue
            visited.add(url)
            if should_skip_url(url):
                continue
            if delay > 0 and (done + skipped) > 0:
                time.sleep(delay)
            out_path = os.path.join(output_dir, filename_from_url(url))
            try:
                html = fetch_page(url)
            except requests.RequestException as e:
                print(f"Error fetching {url}: {e}", file=sys.stderr)
                _log_crawl(log_handle, log_writer, url, "error", str(e))
                continue
            text = extract_main_text(html)
            if skip_existing and os.path.isfile(out_path):
                skipped += 1
                _log_crawl(log_handle, log_writer, url, "skipped", "(existing)")
                if skipped % 100 == 0 and skipped > 0:
                    print(f"[{done} new, {skipped} skipped] ...", file=sys.stderr)
            else:
                with open(out_path, "w", encoding="utf-8") as f:
                    f.write(text)
                done += 1
                _log_crawl(log_handle, log_writer, url, "ok", len(text))
                print(f"[{done}] {len(text)} chars -> {out_path}", file=sys.stderr)
            for link in extract_links(html, url, allowed_netlocs):
                if link not in visited:
                    queue.append(link)
    finally:
        log_handle.close()
    if skipped:
        print(f"Skipped {skipped} existing file(s).", file=sys.stderr)
    return done


def fetch_page(url):
    """Fetch HTML for url; raise on error."""
    resp = requests.get(
        url,
        timeout=REQUEST_TIMEOUT,
        headers=REQUEST_HEADERS,
    )
    resp.raise_for_status()
    return resp.text


def extract_main_text(html):
    """Extract main article text from Wikidot HTML (#page-content or #main-content)."""
    soup = BeautifulSoup(html, "html.parser")
    content = soup.find(id="page-content") or soup.find(id="main-content")
    if not content:
        return ""
    # Strip script/style so they don't appear in text
    for tag in content.find_all(["script", "style"]):
        tag.decompose()
    text = content.get_text(separator="\n", strip=True)
    # Normalize multiple blank lines to at most two
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def main():
    parser = argparse.ArgumentParser(
        description="Scrape main text from D&D Wikidot wiki pages.",
    )
    parser.add_argument(
        "urls",
        nargs="*",
        default=None,
        help="Page URL(s) to scrape (default: dnd5e and dnd2024 wiki homepages)",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        help="Output file (single URL) or directory (multiple URLs); one .txt per page",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Seconds between requests when multiple URLs (default: 1)",
    )
    parser.add_argument(
        "--crawl",
        action="store_true",
        help="Crawl entire site(s) from seed URL(s); -o must be a directory",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="When crawling: do not overwrite files that already exist (still fetches to discover links)",
    )
    args = parser.parse_args()

    urls = args.urls if args.urls else DEFAULT_URLS

    if args.crawl:
        out_dir = args.output or "scraped"
        if os.path.isfile(out_dir):
            print(f"Error: --output must be a directory when using --crawl, not a file: {out_dir}", file=sys.stderr)
            sys.exit(1)
        n = crawl(urls, out_dir, args.delay, skip_existing=args.skip_existing)
        print(f"Crawled {n} new pages into {out_dir}", file=sys.stderr)
        return

    for i, url in enumerate(urls):
        if i > 0 and args.delay > 0:
            time.sleep(args.delay)
        try:
            html = fetch_page(url)
        except requests.RequestException as e:
            print(f"Error fetching {url}: {e}", file=sys.stderr)
            continue
        text = extract_main_text(html)
        if args.output:
            if len(urls) == 1:
                out_path = args.output
            else:
                out_dir = args.output
                os.makedirs(out_dir, exist_ok=True)
                out_path = os.path.join(out_dir, filename_from_url(url))
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(text)
            print(f"Wrote {len(text)} chars to {out_path}", file=sys.stderr)
        else:
            print(text)
            if i < len(urls) - 1:
                print("\n---\n")


if __name__ == "__main__":
    main()
