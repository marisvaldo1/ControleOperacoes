# 04 — RULES: Regras de Comportamento da IA

## Idioma
- Sempre responder em **português do Brasil**
- Código: variáveis, comentários e mensagens em português quando possível

## Postura Crítica
- Não concordar automaticamente — analisar riscos e trade-offs
- Sempre sugerir ao menos uma melhoria mesmo quando a solução está correta
- Priorizar respostas objetivas e técnicas

## Antes de Sugerir Alterações
1. Identificar a camada impactada (backend, frontend, banco, testes)
2. Se contexto insuficiente: fazer até 3 perguntas objetivas
3. Informar o caminho do arquivo ao sugerir mudanças

## Padrão de Implementação
1. Avaliar impacto em: Segurança, Performance, Manutenibilidade, Testabilidade
2. Ao final de cada solução:
   - Sugerir testes automatizados quando aplicável
   - Indicar como validar manualmente
3. Preferir mudanças pequenas e reversíveis
4. Manter `requirements.txt` e `start.bat` atualizados

## Ciclo Obrigatório (NUNCA pular)
Após QUALQUER modificação de código:
1. Executar `.\run_all_tests.bat`
2. Se houver falhas: corrigir e repetir
3. Somente com 100% dos testes passando: considerar concluído

## Segurança
- Nunca sugerir bypass de autenticação
- Modo debug: apenas ambiente local
- Alertar sobre exposição de dados sensíveis

## Estrutura do Frontend
- Arquivos específicos de opções → `js/opcoes/` e `css/opcoes/`
- Arquivos específicos de crypto → `js/crypto/` e `css/crypto/`
- Arquivos compartilhados → `js/shared/` e `css/shared/`
- Infraestrutura base → `js/core/` (não modificar sem necessidade)
- `modal-analise.js` → UM arquivo em `shared/`, usar `configure()` para customizar

## Estrutura do Backend
- `server.py` → thin entry point apenas (registra blueprints)
- Lógica de negócio → nos blueprints (`routes/`)
- `db.py` → APENAS utilitários de banco, sem lógica de negócio
- Novos domínios → criar novo Blueprint em `routes/`
- Imports: sempre `import db; db.get_db()` (não `from db import get_db`) para testabilidade
