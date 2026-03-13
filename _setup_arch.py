"""Script temporário para criar estrutura de pastas do projeto."""
from pathlib import Path

ROOT = Path(r'D:\Sistemas\python\ControleOperacoes')

dirs = [
    'backend/routes',
    'backend/models',
    'backend/tests/opcoes',
    'backend/tests/crypto',
    'frontend/js/opcoes',
    'frontend/js/crypto',
    'frontend/js/shared',
    'frontend/css/opcoes',
    'frontend/css/crypto',
    'frontend/css/shared',
    'frontend/components/modals/crypto',
    'frontend/tests/pages/opcoes',
    'frontend/tests/pages/crypto',
    '.ai-memory/07-DECISIONS',
    '.ai-memory/snapshots',
    'memoryIA/scripts',
]

for d in dirs:
    p = ROOT / d
    p.mkdir(parents=True, exist_ok=True)
    # Adicionar __init__.py nos pacotes Python
    if d.startswith('backend/') and 'tests' not in d:
        init = p / '__init__.py'
        if not init.exists():
            init.write_text('', encoding='utf-8')

print(f'OK - {len(dirs)} pastas criadas com sucesso')
