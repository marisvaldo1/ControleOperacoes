@echo off
cls
echo ========================================
echo  Sistema de Controle de Investimentos
echo ========================================
echo.

REM Verificar se Python está instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Python não encontrado!
    echo Por favor, instale o Python 3.x
    pause
    exit /b 1
)

echo [1/2] Instalando dependencias...
cd backend
pip install -r requirements.txt -q
if %errorlevel% neq 0 (
    echo ERRO ao instalar dependencias!
    pause
    exit /b 1
)

echo.
echo [2/2] Iniciando sistema na porta 8888...
echo.
echo Acessar: http://localhost:8888/html/opcoes.html
echo.
echo Abrindo navegador...
start http://localhost:8888/html/opcoes.html

echo.
echo ========================================
echo  SERVIDOR RODANDO (CTRL+C para parar)
echo ========================================
echo.
python server.py
