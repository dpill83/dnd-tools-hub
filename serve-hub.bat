@echo off
echo Serving D&D Tools Hub at http://localhost:8080/
echo Open the hub, then click D&D Wiki Reference to access the wiki.
echo Press Ctrl+C to stop.
echo.
python -m http.server 8080
