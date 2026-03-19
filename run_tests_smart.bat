@echo off
chcp 65001 >nul
title Testes Seletivos - Controle Operacoes
color 0B
cls
setlocal EnableDelayedExpansion

echo.
echo  =============================================
echo    Testes Seletivos (Smart Run)
echo  =============================================
echo.
echo  Detecta arquivos alterados e roda apenas
echo  os testes relevantes. Use run_all_tests.bat
echo  para suite completa.
echo  =============================================
echo.

cd /d "%~dp0"

:: ── Detectar Python ─────────────────────────────────────────────────────────
set PYTHON=
if exist "%~dp0.venv\Scripts\python.exe" (
    set PYTHON=%~dp0.venv\Scripts\python.exe
) else (
    for /f "delims=" %%P in ('where python 2^>nul') do if not defined PYTHON set PYTHON=%%P
    if not defined PYTHON (
        echo [ERRO] Python nao encontrado.
        exit /b 1
    )
)

:: ── Detectar arquivos alterados (git diff) ───────────────────────────────────
set CHANGED_BACKEND=0
set CHANGED_CRYPTO=0
set CHANGED_OPCOES=0
set CHANGED_E2E=0
set CHANGED_SERVER=0

:: Verificar arquivos alterados
for /f "delims=" %%F in ('git diff --name-only HEAD 2^>nul') do (
    set "FILE=%%F"
    echo !FILE! | findstr /i "backend/" >nul
    if not errorlevel 1 set CHANGED_BACKEND=1
    echo !FILE! | findstr /i "server.py" >nul
    if not errorlevel 1 set CHANGED_SERVER=1
    echo !FILE! | findstr /i "crypto" >nul
    if not errorlevel 1 set CHANGED_CRYPTO=1
    echo !FILE! | findstr /i "opcoes" >nul
    if not errorlevel 1 set CHANGED_OPCOES=1
    echo !FILE! | findstr /i "e2e-smoke" >nul
    if not errorlevel 1 set CHANGED_E2E=1
    echo !FILE! | findstr /i "playwright" >nul
    if not errorlevel 1 set CHANGED_E2E=1
)

:: Verificar arquivos não comitados (staged + unstaged)
for /f "delims=" %%F in ('git status --short 2^>nul') do (
    set "FILE=%%F"
    echo !FILE! | findstr /i "backend/" >nul
    if not errorlevel 1 set CHANGED_BACKEND=1
    echo !FILE! | findstr /i "server.py" >nul
    if not errorlevel 1 set CHANGED_SERVER=1
    echo !FILE! | findstr /i "crypto" >nul
    if not errorlevel 1 set CHANGED_CRYPTO=1
    echo !FILE! | findstr /i "opcoes" >nul
    if not errorlevel 1 set CHANGED_OPCOES=1
    echo !FILE! | findstr /i "e2e-smoke" >nul
    if not errorlevel 1 set CHANGED_E2E=1
    echo !FILE! | findstr /i "playwright" >nul
    if not errorlevel 1 set CHANGED_E2E=1
)

echo [INFO] Mudancas detectadas:
if %CHANGED_BACKEND%==1 echo        - Backend (Python/Flask)
if %CHANGED_SERVER%==1  echo        - server.py
if %CHANGED_CRYPTO%==1  echo        - Crypto (JS/HTML)
if %CHANGED_OPCOES%==1  echo        - Opcoes (JS/HTML)
if %CHANGED_E2E%==1     echo        - Testes E2E
echo.

:: ── Verificar se há algo para testar ────────────────────────────────────────
set NOTHING=1
if %CHANGED_BACKEND%==1 set NOTHING=0
if %CHANGED_CRYPTO%==1  set NOTHING=0
if %CHANGED_OPCOES%==1  set NOTHING=0
if %CHANGED_E2E%==1     set NOTHING=0
if %CHANGED_SERVER%==1  set NOTHING=0

if %NOTHING%==1 (
    echo [INFO] Nenhuma alteracao detectada. Nenhum teste executado.
    echo [DICA] Para forcar execucao: run_all_tests.bat
    exit /b 0
)

:: ── Iniciar Flask se precisar de frontend ou api ────────────────────────────
set NEED_SERVER=0
if %CHANGED_CRYPTO%==1  set NEED_SERVER=1
if %CHANGED_OPCOES%==1  set NEED_SERVER=1
if %CHANGED_E2E%==1     set NEED_SERVER=1

set FLASK_PID=
if %NEED_SERVER%==1 (
    echo [INFO] Verificando servidor em localhost:8888...
    powershell -Command "try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('127.0.0.1',8888);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
    if not errorlevel 1 (
        echo [INFO] Servidor ja rodando - encerrando instancia anterior...
        powershell -Command "Get-NetTCPConnection -LocalPort 8888 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
        powershell -Command "Start-Sleep -Seconds 2" >nul 2>&1
    )
    set PYTHONIOENCODING=UTF-8
    for /f "delims=" %%P in ('powershell -Command "(Start-Process -FilePath '%PYTHON%' -ArgumentList 'server.py' -WorkingDirectory '%~dp0backend' -WindowStyle Normal -PassThru).Id"') do set FLASK_PID=%%P
    echo [INFO] Flask iniciado ^(PID: !FLASK_PID!^). Aguardando...
    set /a WAIT=0
    :WAIT_SERVER
    powershell -Command "Start-Sleep -Seconds 1" >nul 2>&1
    set /a WAIT+=1
    powershell -Command "try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('127.0.0.1',8888);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
    if not errorlevel 1 ( echo [OK] Servidor pronto em !WAIT!s. & goto :SERVER_READY )
    if !WAIT! lss 15 goto :WAIT_SERVER
    echo [ERRO] Servidor nao respondeu. & exit /b 1
    :SERVER_READY
)

set PYTEST_EXIT=0
set PLAYWRIGHT_EXIT=0

:: ── Testes de Backend (se backend mudou) ────────────────────────────────────
if %CHANGED_BACKEND%==1 (
    echo.
    echo  [BACKEND] Rodando testes relevantes...
    if not exist "tests\results" mkdir "tests\results"

    :: Determinar quais arquivos de teste rodar
    set PYTEST_ARGS= 
    if %CHANGED_CRYPTO%==1 set PYTEST_ARGS=!PYTEST_ARGS! backend/tests/test_api_crypto.py
    if %CHANGED_OPCOES%==1 set PYTEST_ARGS=!PYTEST_ARGS! backend/tests/test_api_opcoes.py
    if %CHANGED_SERVER%==1 set PYTEST_ARGS=!PYTEST_ARGS! backend/tests/

    :: Se nenhum alvo específico, roda tudo de backend
    if "!PYTEST_ARGS!"=="" set PYTEST_ARGS=backend/tests/

    "%PYTHON%" -m pytest !PYTEST_ARGS! -v --tb=short --json-report --json-report-file=tests/results/pytest_results.json 2>&1
    set PYTEST_EXIT=!ERRORLEVEL!

    if !PYTEST_EXIT! equ 0 (
        echo [OK] Backend: testes passaram.
    ) else (
        echo [FALHA] Backend. Rodando suite completa para verificar regressoes...
        "%PYTHON%" -m pytest backend/tests/ -v --tb=short 2>&1
        set PYTEST_EXIT=!ERRORLEVEL!
    )
)

:: ── Testes de Frontend (se frontend mudou) ──────────────────────────────────
if %CHANGED_CRYPTO%==1 (
    echo.
    echo  [FRONTEND] Rodando testes de Crypto...
    call npx playwright test --grep "Crypto" 2>&1
    set PLAYWRIGHT_EXIT=!ERRORLEVEL!
    if !PLAYWRIGHT_EXIT! neq 0 (
        echo [FALHA] Crypto. Rodando suite completa para verificar regressoes...
        call npx playwright test
        set PLAYWRIGHT_EXIT=!ERRORLEVEL!
    )
)

if %CHANGED_OPCOES%==1 (
    if %CHANGED_CRYPTO%==0 (
        echo.
        echo  [FRONTEND] Rodando testes de Opcoes...
        call npx playwright test --grep "Opcoes\|E2E" 2>&1
        set PLAYWRIGHT_EXIT=!ERRORLEVEL!
        if !PLAYWRIGHT_EXIT! neq 0 (
            echo [FALHA] Opcoes. Rodando suite completa...
            call npx playwright test
            set PLAYWRIGHT_EXIT=!ERRORLEVEL!
        )
    )
)

if %CHANGED_E2E%==1 (
    if %CHANGED_CRYPTO%==0 if %CHANGED_OPCOES%==0 (
        echo.
        echo  [FRONTEND] Rodando testes E2E...
        call npx playwright test frontend/tests/pages/e2e-smoke.spec.js 2>&1
        set PLAYWRIGHT_EXIT=!ERRORLEVEL!
    )
)

:: ── Resumo ───────────────────────────────────────────────────────────────────
echo.
echo  =============================================
echo   Resumo dos Testes Seletivos
echo  =============================================
if %CHANGED_BACKEND%==0 echo   [SKIP]    Backend  ^(sem alteracoes^)
if %PYTEST_EXIT% equ 0 if %CHANGED_BACKEND%==1 echo   [PASSOU]  Backend  ^(pytest^)
if %PYTEST_EXIT% neq 0 echo   [FALHOU]  Backend  ^(pytest^)

if %CHANGED_CRYPTO%==0 if %CHANGED_OPCOES%==0 if %CHANGED_E2E%==0 echo   [SKIP]    Frontend ^(sem alteracoes^)
if %PLAYWRIGHT_EXIT% equ 0 if %NEED_SERVER%==1 echo   [PASSOU]  Frontend ^(playwright seletivo^)
if %PLAYWRIGHT_EXIT% neq 0 echo   [FALHOU]  Frontend ^(playwright^)
echo  =============================================

:: ── Encerrar Flask ───────────────────────────────────────────────────────────
if %NEED_SERVER%==1 (
    echo.
    if defined FLASK_PID (
        powershell -Command "Stop-Process -Id %FLASK_PID% -Force -ErrorAction SilentlyContinue" >nul 2>&1
    )
    powershell -Command "$c=Get-NetTCPConnection -LocalPort 8888 -State Listen -EA SilentlyContinue; if($c){$c|ForEach-Object{Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue}; Write-Host '[OK] Porta 8888 liberada.'} else {Write-Host '[OK] Servidor encerrado.'}" 2>nul
)

echo.
set /a TOTAL=%PYTEST_EXIT%+%PLAYWRIGHT_EXIT%
if %TOTAL% neq 0 (
    echo [AVISO] Falhas encontradas. Execute run_all_tests.bat para verificacao completa.
    exit /b 1
)
echo [OK] Todos os testes seletivos passaram.