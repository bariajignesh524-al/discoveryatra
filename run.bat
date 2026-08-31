@echo off
echo ==================================================
echo Starting PackVote Travel Project...
echo ==================================================

echo [1/2] Launching FastAPI Backend Server...
start "PackVote Backend" cmd /k "cd backend && .venv\Scripts\uvicorn server:app --host 127.0.0.1 --port 8000"

echo [2/2] Launching React Frontend Server...
start "PackVote Frontend" cmd /k "cd frontend && npm start"

echo ==================================================
echo Project is launching!
echo - Website: http://localhost:3000
echo - API: http://127.0.0.1:8000/api/
echo ==================================================
pause
