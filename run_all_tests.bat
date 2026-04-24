@echo off
chcp 65001 >nul
title Controle Operacoes - Testes Gerais
color 0A
cls
setlocal EnableDelayedExpansion

echo.
echo  =============================================
echo    Controle Operacoes - Suite de Testes
echo  =============================================
echo.

:: Mudar para o diretorio raiz do projeto
cd /d "%~dp0"

set PYTEST_EXIT=0
set PLAYWRIGHT_EXIT=0
set SERVER_STARTED=0

:: Detectar Python: usa .venv se existir, senao usa do sistema
if exist "%~dp0.venv\Scripts\python.exe" (
    set PYTHON=%~dp0.venv\Scripts\python.exe
    echo [INFO] Usando Python do venv.
) else (
    for /f "delims=" %%P in ('where python 2^>nul') do (set PYTHON=%%P & goto :PYTHON_FOUND)
    :PYTHON_FOUND
    if "%PYTHON%"=="" (
        echo [ERRO] Python nao encontrado. Instale Python ou crie o .venv.
        pause
        exit /b 1
    )
    echo [INFO] Usando Python do sistema: %PYTHON%
)

:: ============================================
:: 1. Verificar / Iniciar servidor Flask
:: ============================================
set "FLASK_PID="

echo [INFO] Verificando servidor em localhost:8888...
powershell -Command "try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('127.0.0.1',8888);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Servidor ja esta rodando. Encerrando para iniciar instancia limpa...
    powershell -Command "Get-NetTCPConnection -LocalPort 8888 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" >nul 2>&1
    powershell -Command "Start-Sleep -Seconds 2" >nul 2>&1
)

echo [INFO] Iniciando Flask em janela visivel...
if "%PYTHON%"=="" (
    echo [ERRO] Python nao encontrado.
    pause
    exit /b 1
)
set PYTHONIOENCODING=UTF-8
:: Inicia Flask em janela separada visivel, captura PID para kill preciso ao final
for /f "delims=" %%P in ('powershell -Command "(Start-Process -FilePath '%PYTHON%' -ArgumentList 'server.py' -WorkingDirectory '%~dp0backend' -WindowStyle Normal -PassThru).Id"') do set "FLASK_PID=%%P"

if "%FLASK_PID%"=="" (
    echo [ERRO] Nao foi possivel iniciar o Flask.
    pause
    exit /b 1
)
echo [INFO] Flask iniciado (PID: %FLASK_PID%). Aguardando resposta...

:: Aguardar servidor (max 20s)
set /a WAIT=0
:WAIT_SERVER
powershell -Command "Start-Sleep -Seconds 1" >nul 2>&1
set /a WAIT+=1
powershell -Command "try{$t=New-Object Net.Sockets.TcpClient;$t.Connect('127.0.0.1',8888);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 (
    echo [OK] Servidor iniciado em !WAIT!s.
    goto :SERVER_READY
)
if !WAIT! lss 20 (
    echo [INFO] Aguardando... (!WAIT!/20s)
    goto :WAIT_SERVER
)
echo [ERRO] Servidor nao respondeu em 20 segundos. Veja .tmp\flask_err.log
pause
exit /b 1

:SERVER_READY

:: ============================================
:: 2. Testes de Backend (pytest)
:: ============================================
echo.
echo  --------------------------------------------
echo   Testes de Backend (pytest)
echo  --------------------------------------------
if not exist "tests\results" mkdir "tests\results"
"%PYTHON%" -m pytest backend/tests/ -v --json-report --json-report-file=tests/results/pytest_results.json --tb=short 2>&1
set PYTEST_EXIT=%ERRORLEVEL%

if %PYTEST_EXIT% equ 0 (
    echo [OK] Backend: todos os testes passaram.
) else (
    echo [FALHA] Backend: ha falhas nos testes. Codigo: %PYTEST_EXIT%
)

:: ============================================
:: 3. Testes de Frontend (Playwright)
:: ============================================
echo.
echo  --------------------------------------------
echo   Testes de Frontend (Playwright)
echo  --------------------------------------------
call npx eslint frontend/js/ --max-warnings=0 >nul 2>&1
if errorlevel 1 (
    echo [AVISO] ESLint encontrou problemas no JS.
) else (
    echo [OK] ESLint: nenhum problema JS encontrado.
)

call npx playwright test
set PLAYWRIGHT_EXIT=%ERRORLEVEL%

if %PLAYWRIGHT_EXIT% equ 0 (
    echo [OK] Frontend: todos os testes passaram.
) else (
    echo [FALHA] Frontend: ha falhas. Relatorio em .tmp\playwright-report\index.html
)

:: ============================================
:: 4. Resumo e limpeza
:: ============================================
echo.
echo  =============================================
echo   Resumo dos Testes
echo  =============================================

if %PYTEST_EXIT% equ 0 (
    echo   [PASSOU]  Backend  ^(pytest^)
) else (
    echo   [FALHOU]  Backend  ^(pytest^) - codigo %PYTEST_EXIT%
)

if %PLAYWRIGHT_EXIT% equ 0 (
    echo   [PASSOU]  Frontend ^(playwright^)
) else (
    echo   [FALHOU]  Frontend ^(playwright^) - codigo %PLAYWRIGHT_EXIT%
)
echo  =============================================

:: Limpeza automatica das pastas temporarias se todos passaram
if %PYTEST_EXIT% equ 0 if %PLAYWRIGHT_EXIT% equ 0 (
    echo.
    echo [INFO] Todos os testes passaram. Limpando arquivos temporarios...
    if exist ".tmp" (
        rmdir /s /q ".tmp" 2>nul
        echo [OK] Pasta .tmp removida.
    )
)

:: Encerrar servidor Flask - kill preciso por PID + fallback por porta
echo.
echo [INFO] Encerrando servidor Flask...
if defined FLASK_PID (
    powershell -Command "Stop-Process -Id %FLASK_PID% -Force -ErrorAction SilentlyContinue" >nul 2>&1
    echo [OK] Processo Flask PID !FLASK_PID! encerrado.
)
:: Fallback: garante que a porta 8888 foi liberada de qualquer modo
powershell -Command "$conns = Get-NetTCPConnection -LocalPort 8888 -State Listen -ErrorAction SilentlyContinue; if ($conns) { $conns | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host '[OK] Porta 8888 liberada.' } else { Write-Host '[OK] Servidor encerrado e porta 8888 liberada.' }" 2>nul

:: Código de saída: falha se qualquer suite falhou
set /a TOTAL_EXIT=%PYTEST_EXIT%+%PLAYWRIGHT_EXIT%
if %TOTAL_EXIT% neq 0 (
    echo.
    echo [AVISO] Existem falhas. Verifique os detalhes acima.
    if exist ".tmp\playwright-report\index.html" (
        echo [INFO] Para ver o relatorio Playwright: npx playwright show-report .tmp\playwright-report
    )
)

echo.
exit /b %TOTAL_EXIT%
