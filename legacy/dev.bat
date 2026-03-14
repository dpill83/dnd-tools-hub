@echo off
cd /d "%~dp0"
echo Starting D&D Tools Hub with API (Cloudflare Pages dev).
echo Adventure Log Builder and other /api/* tools will work.
echo.
echo Put OPENAI_API_KEY in .dev.vars in this folder if you use Adventure Log Builder.
echo Open the URL shown below (usually http://localhost:8788).
echo.
npx wrangler pages dev .
