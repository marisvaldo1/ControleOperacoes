@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

REM ============================================================================
REM  ia_memory_update.bat
REM
REM  Atualiza os arquivos de memória da IA e registra o prompt enviado.
REM
REM  Uso:
REM    .\ia_memory_update.bat                          -> apenas atualiza STATE.md e snapshot
REM    .\ia_memory_update.bat "meu prompt aqui"        -> atualiza + registra prompt no log
REM    .\ia_memory_update.bat log "meu prompt aqui"    -> registra prompt no log somente
REM
REM  O arquivo de log fica em: .ai-memory\prompts_log.txt
REM ============================================================================

set "SCRIPT_DIR=%~dp0"
set "MEMORY_DIR=%SCRIPT_DIR%.ai-memory"
set "STATE_FILE=%MEMORY_DIR%\05-STATE.md"
set "CHANGELOG_FILE=%MEMORY_DIR%\08-CHANGELOG.md"
set "PROMPTS_LOG=%MEMORY_DIR%\prompts_log.txt"
set "SNAPSHOT_DIR=%MEMORY_DIR%\snapshots"
set "LATEST_SNAPSHOT=%SNAPSHOT_DIR%\latest.md"

REM ── Data e hora atual ────────────────────────────────────────────────────
for /f "tokens=1-6 delims=/:. " %%a in ("%date% %time%") do (
    set "DAY=%%a"
    set "MON=%%b"
    set "YEAR=%%c"
    set "HOUR=%%d"
    set "MIN=%%e"
    set "SEC=%%f"
)
REM Ajuste para formato DD/MM/AAAA (padrão pt-BR)
REM Se o formato do sistema for AAAA-MM-DD, ajuste aqui

set "TIMESTAMP=%YEAR%-%MON%-%DAY% %HOUR%:%MIN%:%SEC%"
set "DATE_COMPACT=%YEAR%-%MON%-%DAY%"
set "TIME_COMPACT=%HOUR%-%MIN%"
set "SNAPSHOT_NAME=%DATE_COMPACT%_%TIME_COMPACT%"

REM ── Modo "log only" ──────────────────────────────────────────────────────
if "%1"=="log" (
    if not "%~2"=="" (
        echo [%TIMESTAMP%] ^| %~2>> "%PROMPTS_LOG%"
        echo [LOG] Prompt registrado em prompts_log.txt
    ) else (
        echo [AVISO] Uso: ia_memory_update.bat log "texto do prompt"
    )
    goto :EOF
)

REM ── Registra prompt (se fornecido como 1º argumento) ─────────────────────
if not "%~1"=="" (
    echo [%TIMESTAMP%] ^| %~1>> "%PROMPTS_LOG%"
    echo [LOG] Prompt registrado: %~1
)

REM ── Atualiza STATE.md ─────────────────────────────────────────────────────
echo.
echo  Atualizando .ai-memory\05-STATE.md...

REM Coleta informacoes do git
for /f "delims=" %%b in ('git -C "%SCRIPT_DIR%" branch --show-current 2^>nul') do set "BRANCH=%%b"
if "!BRANCH!"=="" set "BRANCH=desconhecida"

(
echo # STATE ^(auto^)
echo.
echo Ultima atualizacao: %TIMESTAMP%
echo Branch: !BRANCH!
echo.
echo ## Commits recentes ^(ultimos 10^)
git -C "%SCRIPT_DIR%" log --oneline -10 --format="  %%h ^| %%ad ^| %%an ^| %%s" --date=short 2^>nul
echo.
echo ## Working tree
git -C "%SCRIPT_DIR%" status --short 2^>nul
echo.
echo ## Arquivos mais tocados ^(ultimos 20 commits^)
git -C "%SCRIPT_DIR%" log --name-only --pretty=format: -20 2^>nul ^| findstr /v "^$" ^| sort ^| uniq /c ^| sort /rn ^| head -20 2^>nul
echo.
echo ## Contexto de testes detectado
if exist "%SCRIPT_DIR%phpunit.xml" echo - PHP: PHPUnit detectado
if exist "%SCRIPT_DIR%package.json" echo - Node: package.json detectado ^(verificar scripts de test^)
echo.
echo ## Pontos de atencao
echo - Revise o working tree acima antes de merge/push.
echo - Atualize `.ai-memory/06-TASKS.md` ao concluir etapas.
) > "%STATE_FILE%"

echo  [OK] 05-STATE.md atualizado.

REM ── Gera snapshot ─────────────────────────────────────────────────────────
if not exist "%SNAPSHOT_DIR%" mkdir "%SNAPSHOT_DIR%"

(
echo # SNAPSHOT — %TIMESTAMP%
echo.
echo ## Branch
echo !BRANCH!
echo.
echo ## Commits recentes
git -C "%SCRIPT_DIR%" log --oneline -5 --format="- %%h %%s ^(%%ad^)" --date=short 2^>nul
echo.
echo ## Status
git -C "%SCRIPT_DIR%" status --short 2^>nul
echo.
echo ## Prompt desta sessão
if not "%~1"=="" (echo %~1) else (echo N/A)
) > "%SNAPSHOT_DIR%\%SNAPSHOT_NAME%.md"

copy /Y "%SNAPSHOT_DIR%\%SNAPSHOT_NAME%.md" "%LATEST_SNAPSHOT%" >nul 2>&1

echo  [OK] Snapshot salvo: snapshots\%SNAPSHOT_NAME%.md

REM ── Atualiza CHANGELOG ────────────────────────────────────────────────────
REM Prepend nova entrada no CHANGELOG.md
set "TMPFILE=%TEMP%\ia_changelog_tmp_%RANDOM%.md"

(
echo.
echo ## %TIMESTAMP% — branch: !BRANCH!
echo.
if not "%~1"=="" (
    echo Prompt: %~1
    echo.
)
git -C "%SCRIPT_DIR%" log --oneline -5 --format="- %%h ^| %%ad ^| %%an ^| %%s" --date=short 2^>nul
echo.
) > "%TMPFILE%"

REM Adiciona após a primeira linha do changelog (título)
set "FIRST=1"
(
for /f "usebackq delims=" %%L in ("%CHANGELOG_FILE%") do (
    echo %%L
    if "!FIRST!"=="1" (
        type "%TMPFILE%"
        set "FIRST=0"
    )
)
) > "%CHANGELOG_FILE%.new"
move /Y "%CHANGELOG_FILE%.new" "%CHANGELOG_FILE%" >nul 2>&1
del /Q "%TMPFILE%" >nul 2>&1

echo  [OK] 08-CHANGELOG.md atualizado.
echo.
echo  ============================================================
echo   Memoria da IA atualizada com sucesso!
echo   Arquivo de prompts: .ai-memory\prompts_log.txt
echo  ============================================================
echo.
