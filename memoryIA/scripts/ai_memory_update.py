"""
AI Memory Update — atualiza 05-STATE.md e 08-CHANGELOG.md a partir do Git.
Funciona em qualquer projeto (Python, PHP, JS, etc.).
Roda de: memoryIA/scripts/  →  ROOT é 2 níveis acima.
"""
import subprocess
from datetime import datetime
from pathlib import Path

ROOT    = Path(__file__).resolve().parents[2]   # raiz do projeto
MEM     = ROOT / ".ai-memory"
STATE   = MEM / "05-STATE.md"
CHANGELOG = MEM / "08-CHANGELOG.md"


def sh(cmd: list) -> str:
    try:
        return subprocess.check_output(
            cmd, cwd=ROOT, text=True, errors="ignore",
            stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return ""


def safe_write(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def indent(text: str, spaces: int = 2) -> str:
    pad = " " * spaces
    return "\n".join(pad + line for line in text.splitlines())


def main():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Commits recentes
    log = sh(["git", "log", "-n", "10", "--pretty=format:%h | %ad | %an | %s", "--date=short"])
    if not log:
        log = "(sem histórico git)"

    # Working tree status
    status_raw = sh(["git", "status", "--porcelain"])
    if status_raw:
        status_lines = status_raw.splitlines()[:25]
        status_summary = "\n".join(f"  {l}" for l in status_lines)
    else:
        status_summary = "  (working tree limpo)"

    # Branch atual
    branch = sh(["git", "branch", "--show-current"]) or "(desconhecida)"

    # Arquivos mais alterados nos últimos 20 commits
    diff_names = sh(["git", "diff", "--name-only", "HEAD~20..HEAD"])
    top_files = "\n".join(f"- {f}" for f in diff_names.splitlines()[:20]) if diff_names else "- (sem dados)"

    # Contagem de testes (detecção automática por linguagem)
    test_hint = _detect_tests()

    state_md = f"""# STATE (auto)

Última atualização: {now}
Branch: {branch}

## Commits recentes (últimos 10)
{indent(log)}

## Working tree
{status_summary}

## Arquivos mais tocados (últimos 20 commits)
{top_files}

## Contexto de testes detectado
{test_hint}

## Pontos de atenção
- Revise o working tree acima antes de merge/push.
- Atualize `.ai-memory/06-TASKS.md` ao concluir etapas.
"""
    safe_write(STATE, state_md)

    # Changelog incremental
    prev = CHANGELOG.read_text(encoding="utf-8") if CHANGELOG.exists() else "# CHANGELOG (auto)\n\n"
    entry = (
        f"\n## {now} — branch: {branch}\n\n"
        + "\n".join(f"- {l}" for l in log.splitlines()) + "\n"
    )
    save_max = 200  # mantém só as últimas 200 linhas do changelog
    lines = (prev + entry).splitlines()
    if len(lines) > save_max:
        # preserva o cabeçalho e as entradas mais recentes
        lines = lines[:2] + lines[-(save_max - 2):]
    safe_write(CHANGELOG, "\n".join(lines) + "\n")

    print(f"[OK] STATE e CHANGELOG atualizados — {now}")


def _detect_tests() -> str:
    hints = []
    if (ROOT / "pytest.ini").exists() or (ROOT / "pyproject.toml").exists():
        hints.append("- Python: pytest detectado")
    if (ROOT / "phpunit.xml").exists() or (ROOT / "phpunit.xml.dist").exists():
        hints.append("- PHP: PHPUnit detectado")
    if (ROOT / "package.json").exists():
        hints.append("- Node: package.json detectado (verificar scripts de test)")
    if (ROOT / "playwright.config.js").exists() or (ROOT / "playwright.config.ts").exists():
        hints.append("- Playwright detectado")
    if not hints:
        hints.append("- Nenhum runner de testes detectado automaticamente")
    return "\n".join(hints)


if __name__ == "__main__":
    main()
