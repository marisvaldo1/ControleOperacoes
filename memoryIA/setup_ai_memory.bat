@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title AI Project Memory — Setup
color 0B
cls

echo.
echo  =============================================
echo    AI Project Memory — Instalador Universal
echo    Funciona em Python, PHP, JS, qualquer stack
echo  =============================================
echo.

:: Mudar para a raiz do projeto (2 niveis acima de memoryIA/)
cd /d "%~dp0..\"
set "ROOT=%CD%"
set "MEM=%ROOT%\.ai-memory"
set "SCRIPTS=%ROOT%\memoryIA\scripts"
set "HOOKS=%ROOT%\.githooks"
set "VSCODE=%ROOT%\.vscode"

echo [INFO] Raiz do projeto: %ROOT%
echo.

:: ─────────────────────────────────────────────
:: 1. Detectar Python (venv do projeto primeiro)
:: ─────────────────────────────────────────────
set "PY="
if exist "%ROOT%\.venv\Scripts\python.exe" (
    set "PY=%ROOT%\.venv\Scripts\python.exe"
    echo [OK] Python: venv do projeto: .venv\Scripts\python.exe
    goto :PY_FOUND
)
if exist "%ROOT%\venv\Scripts\python.exe" (
    set "PY=%ROOT%\venv\Scripts\python.exe"
    echo [OK] Python: venv do projeto: venv\Scripts\python.exe
    goto :PY_FOUND
)
where py >nul 2>&1
if not errorlevel 1 (
    set "PY=py"
    echo [OK] Python: launcher 'py' (sistema)
    goto :PY_FOUND
)
where python >nul 2>&1
if not errorlevel 1 (
    set "PY=python"
    echo [OK] Python: 'python' (sistema)
    goto :PY_FOUND
)
echo [ERRO] Python nao encontrado. Instale o Python ou ative o venv.
pause
exit /b 1

:PY_FOUND

:: ─────────────────────────────────────────────
:: 2. Verificar Git
:: ─────────────────────────────────────────────
where git >nul 2>&1
if errorlevel 1 (
    echo [AVISO] Git nao encontrado no PATH. Hooks nao serao instalados.
    set "HAS_GIT=0"
) else (
    echo [OK] Git encontrado.
    set "HAS_GIT=1"
)
echo.

:: ─────────────────────────────────────────────
:: 3. Criar estrutura de pastas
:: ─────────────────────────────────────────────
echo [INFO] Criando estrutura .ai-memory/ ...
if not exist "%MEM%\07-DECISIONS" mkdir "%MEM%\07-DECISIONS"
if not exist "%MEM%\snapshots"    mkdir "%MEM%\snapshots"
if not exist "%HOOKS%"            mkdir "%HOOKS%"
if not exist "%VSCODE%"           mkdir "%VSCODE%"
echo [OK] Pastas criadas.
echo.

:: ─────────────────────────────────────────────
:: 4. Criar arquivos .ai-memory (nao sobrescreve se ja existirem)
:: ─────────────────────────────────────────────
call :write_if_new "%MEM%\00-ENTRYPOINT.md"  "00-ENTRYPOINT"
call :write_if_new "%MEM%\01-CONTEXT.md"     "01-CONTEXT"
call :write_if_new "%MEM%\02-ARCHITECTURE.md" "02-ARCHITECTURE"
call :write_if_new "%MEM%\03-TECH-STACK.md"  "03-TECH-STACK"
call :write_if_new "%MEM%\04-RULES.md"       "04-RULES"
call :write_if_new "%MEM%\05-STATE.md"       "05-STATE"
call :write_if_new "%MEM%\06-TASKS.md"       "06-TASKS"
call :write_if_new "%MEM%\09-PROMPTS.md"     "09-PROMPTS"
echo.

:: ─────────────────────────────────────────────
:: 5. Instalar git hooks
:: ─────────────────────────────────────────────
if "%HAS_GIT%"=="0" goto :SKIP_HOOKS

echo [INFO] Instalando git hooks (.githooks/) ...

:: post-commit
(
    echo #!/usr/bin/env bash
    echo # AI Memory auto-update apos commit
    echo python "memoryIA/scripts/ai_memory_update.py" ^>^>".ai-memory/hook.log" 2^>^&1
    echo python "memoryIA/scripts/ai_snapshot.py"      ^>^>".ai-memory/hook.log" 2^>^&1
) > "%HOOKS%\post-commit"

:: post-merge
(
    echo #!/usr/bin/env bash
    echo # AI Memory auto-update apos merge/pull
    echo python "memoryIA/scripts/ai_memory_update.py" ^>^>".ai-memory/hook.log" 2^>^&1
    echo python "memoryIA/scripts/ai_snapshot.py"      ^>^>".ai-memory/hook.log" 2^>^&1
) > "%HOOKS%\post-merge"

:: post-checkout
(
    echo #!/usr/bin/env bash
    echo # AI Memory auto-update apos troca de branch
    echo python "memoryIA/scripts/ai_memory_update.py" ^>^>".ai-memory/hook.log" 2^>^&1
) > "%HOOKS%\post-checkout"

git config core.hooksPath .githooks
if errorlevel 1 (
    echo [AVISO] Falha ao configurar hooksPath. Execute manualmente:
    echo         git config core.hooksPath .githooks
) else (
    echo [OK] Hooks instalados e git configurado: core.hooksPath = .githooks
)
goto :AFTER_HOOKS

:SKIP_HOOKS
echo [AVISO] Hooks ignorados (git nao disponivel).

:AFTER_HOOKS
echo.

:: ─────────────────────────────────────────────
:: 6. Adicionar tasks ao .vscode/tasks.json
:: ─────────────────────────────────────────────
echo [INFO] Configurando VS Code tasks...
call :write_vscode_tasks
echo.

:: ─────────────────────────────────────────────
:: 7. Atualizar .gitignore (snapshots datados ignorados, latest versionado)
:: ─────────────────────────────────────────────
if not exist "%ROOT%\.gitignore" goto :no_gitignore
findstr /C:".ai-memory/snapshots/20" "%ROOT%\.gitignore" >nul 2>&1
if not errorlevel 1 goto :gitignore_ok
echo.>> "%ROOT%\.gitignore"
echo # AI Memory - snapshots datados (nao versionar)>> "%ROOT%\.gitignore"
echo .ai-memory/snapshots/20*.md>> "%ROOT%\.gitignore"
echo .ai-memory/hook.log>> "%ROOT%\.gitignore"
echo [OK] .gitignore atualizado (snapshots datados ignorados).
goto :after_gitignore
:gitignore_ok
echo [OK] .gitignore ja configurado.
goto :after_gitignore
:no_gitignore
echo [AVISO] .gitignore nao encontrado. Crie manualmente se necessario.
:after_gitignore
echo.

:: ─────────────────────────────────────────────
:: 8. Primeira execucao dos scripts
:: ─────────────────────────────────────────────
echo [INFO] Gerando estado inicial e snapshot...
"%PY%" "%SCRIPTS%\ai_memory_update.py"
if errorlevel 1 echo [AVISO] ai_memory_update.py retornou erro (normal se sem commits).
"%PY%" "%SCRIPTS%\ai_snapshot.py"
if errorlevel 1 echo [AVISO] ai_snapshot.py retornou erro (normal se sem commits).
echo.

:: ─────────────────────────────────────────────
:: 9. Resumo final
:: ─────────────────────────────────────────────
echo.
echo  =============================================
echo   INSTALACAO CONCLUIDA
echo  =============================================
echo.
echo   Proximos passos:
echo.
echo   1. Edite os arquivos em .ai-memory\ com dados do projeto:
echo      - 01-CONTEXT.md   ...... objetivo e estado do projeto
echo      - 02-ARCHITECTURE.md ... estrutura de pastas
echo      - 03-TECH-STACK.md ..... linguagens e frameworks
echo      - 06-TASKS.md .......... tarefas pendentes
echo.
echo   2. Para atualizar a memoria manualmente:
echo      memoryIA\ai_update.bat
echo.
echo   3. Para retomar em outra IA:
echo      Copie .ai-memory\snapshots\latest.md
echo      e cole na IA dizendo: "Use como contexto inicial."
echo.
echo   4. Para registrar um prompt enviado para a IA:
echo      memoryIA\log_prompt.bat
echo      ^(ou execute apos ai_update.bat — ele pergunta automaticamente^)
echo.
echo   5. A memoria atualiza automaticamente apos cada:
echo      git commit / git pull / git checkout
echo.
echo  =============================================
echo.
pause
goto :EOF


:: ─────────────────────────────────────────────
:: FUNCAO: escreve arquivo apenas se nao existir
:: ─────────────────────────────────────────────
:write_if_new
set "FILEPATH=%~1"
set "TEMPLATE=%~2"
if exist "%FILEPATH%" (
    echo [SKIP] %FILEPATH% ja existe, mantendo.
    goto :EOF
)
call :write_%TEMPLATE% "%FILEPATH%"
echo [OK]   Criado: %FILEPATH%
goto :EOF

:write_00-ENTRYPOINT
(
echo # AI PROJECT MEMORY — ENTRYPOINT
echo.
echo Leia e siga nesta ordem:
echo.
echo 1. .ai-memory/04-RULES.md
echo 2. .ai-memory/01-CONTEXT.md
echo 3. .ai-memory/02-ARCHITECTURE.md
echo 4. .ai-memory/03-TECH-STACK.md
echo 5. .ai-memory/05-STATE.md   ^(auto^)
echo 6. .ai-memory/06-TASKS.md
echo 7. .ai-memory/07-DECISIONS/ ^(ADRs mais recentes^)
echo 8. .ai-memory/snapshots/latest.md
echo.
echo Depois continue a tarefa SEM inventar fatos fora do repositorio.
echo Se faltar informacao, peca o arquivo/trecho exato.
) > "%~1"
goto :EOF

:write_01-CONTEXT
(
echo # CONTEXT
echo.
echo Projeto:
echo - Nome: ^<preencha^>
echo - Objetivo: ^<preencha em 1-3 linhas^>
echo.
echo Escopo ^(o que o sistema faz^):
echo - ^<item^>
echo - ^<item^>
echo.
echo Restricoes:
echo - ^<ex.: rodar local / sem cloud / prazo / compliance^>
echo.
echo Estado atual:
echo - Funcionando: ^<o que ja funciona^>
echo - Pendente:    ^<o que falta^>
echo.
echo Como rodar:
echo - ^<comandos ou passos^>
echo.
echo Como testar:
echo - ^<ex.: .\run_all_tests.bat^>
) > "%~1"
goto :EOF

:write_02-ARCHITECTURE
(
echo # ARCHITECTURE
echo.
echo Visao geral:
echo - ^<ex.: monolito / API + frontend / CLI / microsservicos^>
echo.
echo Pastas principais:
echo - ^<pasta^>  : ^<responsabilidade^>
echo - ^<pasta^>  : ^<responsabilidade^>
echo.
echo Fluxo principal:
echo - ^<ex.: request -^> controller -^> service -^> db^>
echo.
echo Integrações externas:
echo - ^<ex.: API de pagamento / IA / OCR^>
) > "%~1"
goto :EOF

:write_03-TECH-STACK
(
echo # TECH STACK
echo.
echo Linguagens:
echo - ^<ex.: Python / PHP / JavaScript^>
echo.
echo Frameworks / libs principais:
echo - ^<ex.: Flask / Laravel / React^>
echo.
echo Banco de dados:
echo - ^<ex.: MySQL / PostgreSQL / SQLite^>
echo.
echo Infraestrutura:
echo - ^<ex.: Docker / Laragon / WSL / servidor local^>
echo.
echo Testes:
echo - ^<ex.: Pytest + Playwright / PHPUnit / Jest^>
echo.
echo Ferramentas dev:
echo - VS Code, Git
) > "%~1"
goto :EOF

:write_04-RULES
(
echo # AI RULES
echo.
echo - Responder em portugues.
echo - Se houver ambiguidade, sugerir 2 caminhos com trade-offs.
echo - NAO inventar arquivos, rotas, tabelas, variaveis ou decisoes.
echo - Preferir mudancas pequenas, seguras e reversiveis.
echo - Ao sugerir alteracao, sempre indicar:
echo   ^(a^) arquivos afetados
echo   ^(b^) risco
echo   ^(c^) como testar
echo - Apos toda alteracao, sugerir como executar os testes.
) > "%~1"
goto :EOF

:write_05-STATE
(
echo # STATE ^(auto^)
echo.
echo Ultima atualizacao: ^(ainda nao gerado — execute ai_update.bat^)
echo.
echo Resumo:
echo - ^(auto^)
echo.
echo Working tree:
echo - ^(auto^)
echo.
echo Arquivos mais tocados:
echo - ^(auto^)
) > "%~1"
goto :EOF

:write_06-TASKS
(
echo # TASKS
echo.
echo ## TODO
echo - [ ] ^<tarefa 1^>
echo - [ ] ^<tarefa 2^>
echo.
echo ## DOING
echo - [ ] ^<tarefa em andamento^>
echo.
echo ## DONE
echo - [x] Setup AI Project Memory
) > "%~1"
goto :EOF

:write_09-PROMPTS
(
echo # 09 ^— PROMPTS LOG
echo.
echo ^> Registre os prompts enviados para a IA usando: `memoryIA\log_prompt.bat`
echo ^> Ou aperte ENTER ao final do ai_update.bat para salvar da area de transferencia.
echo.
echo ^(nenhum prompt registrado ainda^)
) > "%~1"
goto :EOF

:write_vscode_tasks
:: Verifica se tasks.json ja tem as tasks de AI Memory
if exist "%VSCODE%\tasks.json" (
    findstr /C:"AI Memory" "%VSCODE%\tasks.json" >nul 2>&1
    if not errorlevel 1 (
        echo [OK] VS Code tasks de AI Memory ja existem.
        goto :EOF
    )
)
:: Cria ou substitui com tasks completas
(
echo {
echo   "version": "2.0.0",
echo   "tasks": [
echo     {
echo       "label": "AI Memory: Update",
echo       "type": "shell",
echo       "command": "memoryIA/ai_update.bat",
echo       "windows": { "command": "memoryIA\\ai_update.bat" },
echo       "problemMatcher": [],
echo       "group": "build",
echo       "presentation": { "reveal": "always", "panel": "shared" }
echo     },
echo     {
echo       "label": "AI Memory: Snapshot",
echo       "type": "shell",
echo       "command": "python memoryIA/scripts/ai_snapshot.py",
echo       "windows": { "command": "python memoryIA\\scripts\\ai_snapshot.py" },
echo       "problemMatcher": [],
echo       "presentation": { "reveal": "always", "panel": "shared" }
echo     },
echo     {
echo       "label": "AI Memory: Update + Snapshot",
echo       "dependsOrder": "sequence",
echo       "dependsOn": ["AI Memory: Update", "AI Memory: Snapshot"],
echo       "problemMatcher": []
echo     },
echo     {
echo       "label": "AI Memory: Log Prompt",
echo       "type": "shell",
echo       "command": "memoryIA/log_prompt.bat",
echo       "windows": { "command": "memoryIA\\log_prompt.bat" },
echo       "problemMatcher": [],
echo       "presentation": { "reveal": "always", "panel": "shared" }
echo     }
echo   ]
echo }
) > "%VSCODE%\tasks.json"
echo [OK] .vscode/tasks.json criado com tasks de AI Memory.
goto :EOF
