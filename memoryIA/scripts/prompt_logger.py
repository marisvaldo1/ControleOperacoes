"""
Prompt Logger — registra prompts enviados à IA em .ai-memory/prompts_log.txt
e mantém um resumo Markdown em .ai-memory/09-PROMPTS.md.

Modos de uso:
  1. Ler da área de transferência (padrão):
       python prompt_logger.py

  2. Texto direto como argumento:
       python prompt_logger.py "seu prompt aqui"

  3. Via stdin (pipe):
       echo "seu prompt" | python prompt_logger.py --stdin

  4. Modo interativo (digitar no terminal):
       python prompt_logger.py --interactive
"""

import sys
import os
from datetime import datetime
from pathlib import Path

ROOT     = Path(__file__).resolve().parents[2]
MEM      = ROOT / ".ai-memory"
LOG_FILE = MEM / "prompts_log.txt"
MD_FILE  = MEM / "09-PROMPTS.md"

SEP = "─" * 72


def get_clipboard() -> str:
    """Lê conteúdo da área de transferência via PowerShell (Windows)."""
    try:
        import subprocess
        result = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command", "Get-Clipboard"],
            text=True, errors="replace", stderr=subprocess.DEVNULL
        )
        return result.strip()
    except Exception as e:
        return ""


def save_prompt(text: str, source: str = "clipboard") -> bool:
    """Grava o prompt no log de texto e atualiza o Markdown."""
    text = text.strip()
    if not text:
        print("[AVISO] Prompt vazio — nenhum registro salvo.")
        return False

    MEM.mkdir(parents=True, exist_ok=True)
    now  = datetime.now()
    ts   = now.strftime("%Y-%m-%d %H:%M:%S")
    date = now.strftime("%Y-%m-%d")
    time = now.strftime("%H:%M:%S")

    # ── 1. prompts_log.txt ──────────────────────────────────────────────────
    entry = (
        f"\n{SEP}\n"
        f"[{ts}]  fonte: {source}\n"
        f"{SEP}\n"
        f"{text}\n"
    )

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(entry)

    # ── 2. 09-PROMPTS.md (últimos N prompts em Markdown) ───────────────────
    _update_md(ts, text)

    chars = len(text)
    preview = text[:80].replace("\n", " ")
    print(f"[OK] Prompt registrado — {ts} ({chars} chars)")
    print(f"     Preview: {preview}{'...' if chars > 80 else ''}")
    print(f"     Log:     {LOG_FILE}")
    return True


def _update_md(ts: str, text: str):
    """Mantém 09-PROMPTS.md com os últimos 50 prompts."""
    MAX_ENTRIES = 50

    # Lê entradas existentes
    existing = []
    if MD_FILE.exists():
        content = MD_FILE.read_text(encoding="utf-8")
        # Extrai blocos entre "---" separadores
        import re
        blocks = re.split(r"\n---\n", content)
        # Pula cabeçalho (primeiro bloco)
        existing = [b.strip() for b in blocks[1:] if b.strip()]

    # Nova entrada no topo
    new_entry = f"**`{ts}`**\n\n```\n{text}\n```"
    entries = [new_entry] + existing
    entries = entries[:MAX_ENTRIES]  # mantém apenas os últimos 50

    header = (
        "# 09 — PROMPTS LOG\n\n"
        f"> Atualizado automaticamente. Total registrado: {len(entries)} entrada(s).\n"
        "> Para registrar um novo prompt: `memoryIA\\log_prompt.bat`\n"
    )

    body = "\n\n---\n\n".join(entries)
    MD_FILE.write_text(header + "\n\n---\n\n" + body + "\n", encoding="utf-8")


def main():
    args = sys.argv[1:]

    # ── modo --stdin ────────────────────────────────────────────────────────
    if "--stdin" in args:
        text = sys.stdin.read()
        save_prompt(text, source="stdin")
        return

    # ── modo --interactive ──────────────────────────────────────────────────
    if "--interactive" in args:
        print("Cole ou digite seu prompt abaixo.")
        print("Quando terminar, pressione ENTER duas vezes (linha em branco) ou Ctrl+Z + ENTER.\n")
        lines = []
        try:
            while True:
                line = input()
                if line == "" and lines and lines[-1] == "":
                    break
                lines.append(line)
        except EOFError:
            pass
        text = "\n".join(lines).strip()
        save_prompt(text, source="interativo")
        return

    # ── texto direto como argumento ─────────────────────────────────────────
    if args and not args[0].startswith("--"):
        text = " ".join(args)
        save_prompt(text, source="argumento")
        return

    # ── padrão: área de transferência ───────────────────────────────────────
    print("[INFO] Lendo área de transferência...")
    text = get_clipboard()
    if not text:
        print("[AVISO] Área de transferência vazia ou inacessível.")
        print("        Use: python prompt_logger.py --interactive")
        print("        Ou:  python prompt_logger.py \"seu prompt aqui\"")
        sys.exit(1)
    save_prompt(text, source="clipboard")


if __name__ == "__main__":
    main()
