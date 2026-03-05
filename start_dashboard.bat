@echo off
title Controle Operacoes - Test Dashboard
color 0A
echo ============================================================
echo   Controle Operacoes -- Test Dashboard
echo   Acesse: http://localhost:8883/
echo ============================================================
echo.

REM Detectar Python: usa .venv se existir, senao usa do sistema
if exist ".venv\Scripts\python.exe" (
    set PYTHON=.venv\Scripts\python.exe
) else (
    for /f "delims=" %%P in ('where python 2^>nul') do (set PYTHON=%%P & goto :PYTHON_FOUND)
    :PYTHON_FOUND
    if "%PYTHON%"=="" (
        echo [ERRO] Python nao encontrado. Instale Python ou crie o .venv.
        pause
        exit /b 1
    )
)
echo [INFO] Usando Python: %PYTHON%

echo [INFO] Iniciando Test Dashboard Server na porta 8883...
echo [INFO] Pressione Ctrl+C para encerrar.
echo.

REM Abre o browser apos 3s em processo minimizado (nao bloqueia)
start /min "" powershell -noprofile -command "Start-Sleep 3; Start-Process 'http://localhost:8883/'"

REM Inicia servidor na mesma janela (bloqueante)
"%PYTHON%" tests\test_server.py
