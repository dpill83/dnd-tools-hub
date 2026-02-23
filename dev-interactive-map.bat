@echo off
if "%BATTLE_PASS_IMAGES%"=="" (
    echo Set BATTLE_PASS_IMAGES to your R2 bucket name, then run this script again.
    echo Example: set BATTLE_PASS_IMAGES=your-r2-bucket-name
    exit /b 1
)
echo Starting Wrangler Pages dev with R2 binding. Open the URL below, then go to tools/interactive-map/
npx wrangler pages dev . --r2=BATTLE_PASS_IMAGES=%BATTLE_PASS_IMAGES%
