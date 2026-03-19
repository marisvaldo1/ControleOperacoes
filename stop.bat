@echo off
setlocal enabledelayedexpansion
cls

set PORT=8888

echo ========================================
echo  Encerrando servidores
echo ========================================
echo.

echo [1/3] Encerrando processos que estao usando a porta %PORT%...

set FOUND_PORT_PROCESS=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    set FOUND_PORT_PROCESS=1
    echo Matando PID %%a...
    taskkill /PID %%a /F >nul 2>&1
)

if "!FOUND_PORT_PROCESS!"=="0" (
    echo Nenhum processo ouvindo na porta %PORT%.
)

echo.
echo [2/3] Encerrando possiveis instancias do server.py...

wmic process where "name='python.exe' and commandline like '%%server.py%%'" delete >nul 2>&1
wmic process where "name='pythonw.exe' and commandline like '%%server.py%%'" delete >nul 2>&1

echo.
echo [3/3] Validando se a porta foi liberada...

timeout /t 1 /nobreak >nul
netstat -ano | findstr :%PORT% | findstr LISTENING >nul 2>&1

if %errorlevel% equ 0 (
    echo ATENCAO: ainda existe processo usando a porta %PORT%.
    echo Verifique manualmente com:
    echo netstat -ano ^| findstr :%PORT%
) else (
    echo OK: nenhuma instancia ativa na porta %PORT%.
)

echo.
echo ========================================
echo  Finalizado
echo ========================================
