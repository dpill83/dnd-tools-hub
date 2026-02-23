@echo off
echo Serving D^&D Tools Hub at http://localhost:8080/
echo Interactive Map works with local mock API (data in tools\interactive-map\.local-dev-data).
echo Open the hub, then go to Interactive Map or any tool. Press Ctrl+C to stop.
echo.
python tools\interactive-map\local-maps-server.py 8080
