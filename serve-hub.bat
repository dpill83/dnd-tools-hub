@echo off
cd /d "%~dp0"
echo Serving D&D Tools Hub at http://localhost:8080/
echo Open in Edge: http://localhost:8080
echo Press Ctrl+C to stop.
echo.
python -m http.server 8080
