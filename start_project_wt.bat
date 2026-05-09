@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo Starting Docker services (Postgres + Redis)...
docker compose -f docker-compose.local.yml up -d
if errorlevel 1 (
  echo.
  echo ERROR: Docker services failed to start.
  echo Make sure Docker Desktop is running, then try again.
  pause
  exit /b 1
)

timeout /t 2 /nobreak

echo.
echo Starting services in separate terminals...
echo.

REM Get the current directory
set PROJ_DIR=%~dp0
set BACKEND_DIR=%PROJ_DIR%backend
set FRONTEND_DIR=%PROJ_DIR%frontend

REM Start Ollama
start "PromptLedger - Ollama" cmd /k "title PromptLedger - Ollama && ollama serve"

REM Start API
start "PromptLedger - API" cmd /k "cd /d "%BACKEND_DIR%" && title PromptLedger - API && python -m alembic upgrade head && python -m uvicorn app.main:app --reload --port 8000"

REM Start Worker
start "PromptLedger - Worker" cmd /k "cd /d "%BACKEND_DIR%" && title PromptLedger - Worker && python -m celery -A app.workers.celery_app worker --loglevel=info --pool=solo"

REM Start Beat
start "PromptLedger - Beat" cmd /k "cd /d "%BACKEND_DIR%" && title PromptLedger - Beat && python -m celery -A app.workers.celery_app beat --loglevel=info"

REM Start Frontend
start "PromptLedger - Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && title PromptLedger - Frontend && npm run dev"

echo.
echo PromptLedger startup launched successfully!
echo.
echo Services should be opening in separate windows...
echo.
echo Services:
echo   - Ollama:    (local LLM server)
echo   - API:       http://localhost:8000
echo   - Worker:    (Celery task worker)
echo   - Beat:      (Celery scheduled tasks)
echo   - Frontend:  http://localhost:3000
echo.
echo If windows don't appear, start them manually:
echo   - cd backend ^&^& python -m uvicorn app.main:app --reload --port 8000
echo   - cd backend ^&^& python -m celery -A app.workers.celery_app worker --loglevel=info --pool=solo
echo   - cd backend ^&^& python -m celery -A app.workers.celery_app beat --loglevel=info
echo   - cd frontend ^&^& npm run dev
echo.

endlocal
