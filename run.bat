@echo off
cd /d "c:\Users\rdiep\OneDrive - QWERTY Computing Technologies Inc\Clients\Zura Bio\Competitive Web Alerts"

:: Run agent and notify
"C:\Program Files\nodejs\node.exe" --env-file=.env agent.js >> results\run.log 2>&1
if %errorlevel% equ 0 (
  "C:\Program Files\nodejs\node.exe" --env-file=.env notify.js >> results\run.log 2>&1
)

:: Regenerate historical dashboard
"C:\Program Files\nodejs\node.exe" historical.js >> results\run.log 2>&1

:: Commit and push updated HTML to GitHub
git add results/report_latest.html results/historical.html results/credit-calculator.html >> results\run.log 2>&1
git commit -m "Daily scan %date% %time%" >> results\run.log 2>&1
git push origin main >> results\run.log 2>&1
