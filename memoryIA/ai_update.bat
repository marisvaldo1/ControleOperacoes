@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title AI Memory — Update + Snapshot

cd /d "%~dp0..\"
set "ROOT=%CD%"
set "SCRIPTS=%ROOT%\memoryIA\scripts"

:: Detectar Python (venv primeiro)
set "PY="
if exist "%ROOT%\.venv\Scripts\python.exe" set "PY=%ROOT%\.venv\Scripts\python.exe"
if "!PY!"=="" if exist "%ROOT%\venv\Scripts\python.exe" set "PY=%ROOT%\venv\Scripts\python.exe"
if "!PY!"=="" where py >nul 2>&1 && set "PY=py"
if "!PY!"=="" where python >nul 2>&1 && set "PY=python"
if "!PY!"=="" (
    echo [ERRO] Python nao encontrado.
    pause & exit /b 1
)

echo.
echo [AI Memory] Atualizando estado e snapshot...
echo.
"%PY%" "%SCRIPTS%\ai_memory_update.py"
"%PY%" "%SCRIPTS%\ai_snapshot.py"
echo.

:: ── Registrar prompt opcional ─────────────────────────────────────────────
echo  Deseja registrar o prompt que voce enviou para a IA?
echo  (deixe em branco e pressione ENTER para pular)
echo.
echo  [1] Sim — ler da area de transferencia
echo  [2] Sim — digitar agora no terminal
echo  [ENTER] Pular
echo.
set /p "LOG_CHOICE=Opcao: "

if "!LOG_CHOICE!"=="1" (
    echo.
    "%PY%" "%SCRIPTS%\prompt_logger.py"
    echo.
)
if "!LOG_CHOICE!"=="2" (
    echo.
    "%PY%" "%SCRIPTS%\prompt_logger.py" --interactive
    echo.
)

echo [OK] Memoria atualizada. Arquivo para colar na IA:
echo      .ai-memory\snapshots\latest.md
echo.
