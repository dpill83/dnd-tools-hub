@echo off
REM Re-run crawl but do NOT overwrite existing files (fills in missing/failed pages only)
cd /d "%~dp0"
python scrape_dnd_wiki.py --crawl "https://dnd5e.wikidot.com/" -o scraped-dnd5e --delay 1 --skip-existing
pause
