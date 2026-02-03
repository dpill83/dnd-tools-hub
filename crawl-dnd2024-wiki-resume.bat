@echo off
REM Re-run crawl for dnd2024 but do NOT overwrite existing files
cd /d "%~dp0"
python scrape_dnd_wiki.py --crawl "http://dnd2024.wikidot.com/" -o scraped-dnd2024 --delay 1 --skip-existing
pause
