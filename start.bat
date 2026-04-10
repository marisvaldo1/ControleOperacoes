@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if /I "%~1"=="--silent" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_hidden.ps1"
    exit /b %errorlevel%
)

call :resolve_python
if errorlevel 1 exit /b 1

cls
echo ========================================
echo  Sistema de Controle de Investimentos
echo ========================================
echo.
echo [1/2] Instalando dependencias...

pushd "%~dp0backend"
"%PYTHON%" -m pip install -r requirements.txt -q
if errorlevel 1 (
    popd
    echo ERRO ao instalar dependencias!
    pause
    exit /b 1
)

echo.
echo [2/2] Iniciando sistema na porta 8888...
echo.
echo Acessar: http://localhost:8888/html/opcoes.html
echo.

start "" /MIN powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:8888/html/opcoes.html'"

echo ========================================
echo  SERVIDOR RODANDO (CTRL+C para parar)
echo ========================================
echo.
"%PYTHON%" server.py
set SERVER_EXIT=%errorlevel%
popd

echo.
echo ========================================
echo  Servidor interrompido
echo ========================================
echo.

call stop.bat
exit /b %SERVER_EXIT%

:resolve_python
if exist "%~dp0.venv\Scripts\python.exe" (
    set "PYTHON=%~dp0.venv\Scripts\python.exe"
    goto :eof
)

for /f "delims=" %%P in ('where python 2^>nul') do (
    set "PYTHON=%%P"
    goto :eof
)

echo ERRO: Python nao encontrado!
echo Por favor, instale o Python 3.x ou crie a pasta .venv.
pause
exit /b 1