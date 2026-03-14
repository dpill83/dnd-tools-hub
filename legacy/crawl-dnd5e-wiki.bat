@echo off
REM Crawl and scrape the entire dnd5e.wikidot.com wiki into scraped-dnd5e\
REM To re-run without overwriting existing files, add: --skip-existing
cd /d "%~dp0"
python scrape_dnd_wiki.py --crawl "https://dnd5e.wikidot.com/" -o scraped-dnd5e --delay 1
pause
