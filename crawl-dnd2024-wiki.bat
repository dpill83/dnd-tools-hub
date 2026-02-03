@echo off
REM Crawl and scrape the entire dnd2024.wikidot.com wiki (2024 rules) into scraped-dnd2024\
REM To re-run without overwriting existing files, use crawl-dnd2024-wiki-resume.bat
cd /d "%~dp0"
python scrape_dnd_wiki.py --crawl "http://dnd2024.wikidot.com/" -o scraped-dnd2024 --delay 1
pause
