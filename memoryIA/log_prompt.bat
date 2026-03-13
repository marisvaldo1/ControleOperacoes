@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title AI Memory — Log de Prompt

cd /d "%~dp0..\"
set "ROOT=%CD%"
set "SCRIPTS=%ROOT%\memoryIA\scripts"

:: Detectar Python
set "PY="
if exist "%ROOT%\.venv\Scripts\python.exe" set "PY=%ROOT%\.venv\Scripts\python.exe"
if "!PY!"=="" if exist "%ROOT%\venv\Scripts\python.exe" set "PY=%ROOT%\venv\Scripts\python.exe"
if "!PY!"=="" where py  >nul 2>&1 && set "PY=py"
if "!PY!"=="" where python >nul 2>&1 && set "PY=python"
if "!PY!"=="" (
    echo [ERRO] Python nao encontrado.
    pause & exit /b 1
)

echo.
echo  =============================================
echo    AI Memory — Registrar Prompt
echo  =============================================
echo.

:: ── Modo 1: texto passado como argumento ──────────────────────────────────
if not "%~1"=="" (
    echo [INFO] Salvando prompt do argumento...
    "%PY%" "%SCRIPTS%\prompt_logger.py" %*
    goto :DONE
)

:: ── Modo 2: ler da area de transferencia (padrao) ─────────────────────────
echo  Escolha como deseja registrar o prompt:
echo.
echo  [1] Colar da area de transferencia (padrao)
echo  [2] Digitar/colar no terminal agora
echo  [3] Cancelar
echo.
set /p "MODO=Opcao [1]: "
if "!MODO!"=="" set "MODO=1"

if "!MODO!"=="1" (
    echo.
    echo [INFO] Copiando da area de transferencia...
    "%PY%" "%SCRIPTS%\prompt_logger.py"
    goto :DONE
)

if "!MODO!"=="2" (
    echo.
    echo  Cole ou digite o prompt abaixo.
    echo  Quando terminar, pressione ENTER duas vezes para confirmar.
    echo  ─────────────────────────────────────────────────────────────
    echo.
    "%PY%" "%SCRIPTS%\prompt_logger.py" --interactive
    goto :DONE
)

echo [INFO] Cancelado.
goto :EOF

:DONE
echo.
echo [OK] Arquivo de log: .ai-memory\prompts_log.txt
echo [OK] Resumo Markdown: .ai-memory\09-PROMPTS.md
echo.
pause
