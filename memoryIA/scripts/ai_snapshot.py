"""
AI Snapshot — gera .ai-memory/snapshots/latest.md para colar em qualquer IA
e retomar o contexto de qualquer projeto.
Roda de: memoryIA/scripts/  →  ROOT é 2 níveis acima.
"""
from datetime import datetime
from pathlib import Path
import subprocess
import sys


ROOT     = Path(__file__).resolve().parents[2]
MEM      = ROOT / ".ai-memory"
SNAP_DIR = MEM / "snapshots"
LATEST   = SNAP_DIR / "latest.md"


def sh(cmd: list) -> str:
    try:
        return subprocess.check_output(
            cmd, cwd=ROOT, text=True, errors="ignore",
            stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        return ""


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8").strip() if p.exists() else "(arquivo não encontrado)"


def trunc(text: str, max_chars: int = 1500) -> str:
    """Trunca para não explodir o contexto da IA."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + f"\n\n... [truncado — {len(text) - max_chars} chars omitidos]"


def _read_last_prompts(n: int = 5) -> str:
    """Lê os últimos N prompts do prompts_log.txt."""
    log_file = MEM / "prompts_log.txt"
    if not log_file.exists():
        return "(nenhum prompt registrado — use memoryIA\\log_prompt.bat)"
    try:
        content = log_file.read_text(encoding="utf-8", errors="replace")
        sep = "─" * 72
        blocks = content.split(sep)
        # Filtra blocos não-vazios que contêm timestamp
        entries = []
        i = 1
        while i < len(blocks) - 1:
            header = blocks[i].strip()      # ex: "\n[2026-03-11 15:47:00]  fonte: clipboard"
            body   = blocks[i + 1].strip()  # texto do prompt
            if header and body and "[20" in header:
                entries.append((header, body))
                i += 2
            else:
                i += 1
        if not entries:
            return "(nenhum prompt registrado)"
        recent = entries[-n:]
        lines = []
        for header, body in reversed(recent):
            ts = header.replace("\n", " ").strip()
            preview = body[:400] + ("..." if len(body) > 400 else "")
            lines.append(f"{ts}\n{preview}")
        return "\n\n".join(lines)
    except Exception as e:
        return f"(erro ao ler log: {e})"


def main():
    now  = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    SNAP_DIR.mkdir(parents=True, exist_ok=True)

    branch  = sh(["git", "branch", "--show-current"]) or "(desconhecida)"
    log     = sh(["git", "log", "-n", "5", "--pretty=format:%h %ad %s", "--date=short"]) or "(sem log)"
    changed = sh(["git", "show", "--name-only", "--pretty=format:", "HEAD"]) or "(sem dados)"

    # Lê memória estruturada
    context  = trunc(read(MEM / "01-CONTEXT.md"))
    arch     = trunc(read(MEM / "02-ARCHITECTURE.md"), 800)
    stack    = trunc(read(MEM / "03-TECH-STACK.md"),  800)
    rules    = trunc(read(MEM / "04-RULES.md"),       600)
    state    = trunc(read(MEM / "05-STATE.md"))
    tasks    = trunc(read(MEM / "06-TASKS.md"))

    # ADRs recentes
    adr_dir = MEM / "07-DECISIONS"
    adr_text = ""
    if adr_dir.exists():
        adrs = sorted(adr_dir.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)[:3]
        for a in adrs:
            adr_text += f"\n### {a.name}\n{trunc(a.read_text(encoding='utf-8'), 600)}\n"
    if not adr_text:
        adr_text = "(sem decisões registradas)"

    # Últimos prompts enviados à IA
    prompts_text = _read_last_prompts(5)

    snapshot = f"""# AI PROJECT SNAPSHOT
> Cole todo este arquivo na IA para retomar o projeto sem perder contexto.
> Gerado em: {now} | Branch: {branch}

---

## COMO RETOMAR
1. Leia `.ai-memory/00-ENTRYPOINT.md` para instruções completas.
2. Use este snapshot como estado inicial da conversa.
3. Diga à IA: *"Leia o snapshot abaixo e continue de onde paramos."*

---

## GIT — últimos 5 commits
{log}

## Arquivos alterados no último commit
{changed}

---

## CONTEXTO
{context}

---

## ARQUITETURA
{arch}

---

## TECH STACK
{stack}

---

## REGRAS PARA A IA
{rules}

---

## ESTADO ATUAL (auto)
{state}

---

## TAREFAS
{tasks}

---

## DECISÕES RECENTES (ADR)
{adr_text}

---

## ÚLTIMOS PROMPTS ENVIADOS
{prompts_text}

---

*Se faltar contexto, peça o arquivo específico. Não invente.*
"""

    LATEST.write_text(snapshot, encoding="utf-8")

    # Salva cópia datada (histórico de snapshots)
    dated = SNAP_DIR / f"{datetime.now().strftime('%Y-%m-%d_%H-%M')}.md"
    dated.write_text(snapshot, encoding="utf-8")

    print(f"[OK] Snapshot gerado: {LATEST}")
    print(f"[OK] Cópia datada:    {dated}")
    print(f"\nPara retomar: copie o conteúdo de:\n  {LATEST}\ne cole na IA com: 'Use este snapshot como contexto inicial.'")


if __name__ == "__main__":
    main()
