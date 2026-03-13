# CentralClinica — Instruções Globais do Copilot

Estas regras devem ser consideradas em todas as interações neste repositório.

---

## 1. Idioma

- Sempre responder em português os seus pensamentos em portugues
- Não misturar idiomas sem necessidade técnica explícita.

---

## 2. Postura Crítica e Técnica

- Não concordar automaticamente com as ideias apresentadas.
- Sempre analisar riscos, trade-offs e possíveis falhas.
- Se a solução estiver correta, ainda assim sugerir ao menos uma melhoria, validação adicional ou edge case relevante.
- Priorizar respostas objetivas, acionáveis e técnicas.

---

## 3. Antes de Sugerir Alterações

Sempre que a solicitação envolver código:

- Identificar a camada impactada (frontend, backend, banco, autenticação, roteamento, etc.).
- Se o contexto for insuficiente, fazer até 3 perguntas objetivas antes de assumir algo.
- Indicar caminhos de arquivos ao sugerir modificações.

---

## 4. Padrão de Implementação

Ao propor implementação de código:

1. Avaliar impacto em:
   - Segurança
   - Performance
   - Manutenibilidade
   - Testabilidade

2. Ao final da solução:
   - Sugerir criação ou ajuste de testes automatizados quando aplicável
   - Indicar como executar os testes
   - Informar como validar manualmente a alteração

3. Preferir:
   - Mudanças pequenas e reversíveis
   - Código explícito e legível
   - Evitar refactors grandes sem solicitação explícit

4. Preferir:
   - Não se esquecer de ajustar o backend/requirements.txt e o start.bat caso haja necessidade.
   
---

## 5. Segurança e Debug

- Nunca sugerir bypass permanente de autenticação.
- Qualquer modo debug deve ser restrito a ambiente local ou controlado.
- Alertar sobre riscos de exposição de dados sensíveis.

---

## 6. Uso da Estrutura do Projeto

Antes de propor soluções, considerar os materiais disponíveis em:

- `.github/agents/skills/**`
- `.github/agents/rules/**`
- `.github/agents/workflows/**`
- `.github/agents/ARCHITECTURE.md`

Se houver uma skill ou regra aplicável, ela deve orientar a resposta.

---

## 7. Formato das Respostas Técnicas

- Quando solicitado, fornecer o arquivo completo.
- Caso contrário, fornecer patch mínimo com caminho do arquivo.
- Incluir passos rápidos de verificação.

## 8. Disciplina Arquitetural

- Não propor soluções que violem a arquitetura existente sem justificar.
- Se identificar incoerência estrutural, apontar antes de implementar.

---

## 9. Ciclo Obrigatório Após Qualquer Alteração

**Após TODA e qualquer modificação de código (backend, frontend, testes, configuração), sem exceção:**

1. Executar todos os testes com `.\run_all_tests.bat`
2. Se houver falhas:
   - Analisar o erro reportado
   - Corrigir o problema na fonte
   - Executar `.\run_all_tests.bat` novamente
3. Repetir o ciclo até que **todos os testes passem** (pytest + Playwright)
4. Somente após 100% de testes passando, considerar a tarefa concluída

**Nunca encerrar uma tarefa com testes falhando.**

copiar para a área de transferencia o conteúdo do último prompt e executar 
./memoryIA/log_prompt.bat
./memoryIA/ia_update.bat
