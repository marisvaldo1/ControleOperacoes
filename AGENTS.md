# Metsatrader — Instruções Globais do OpenCode
    - Estas regras devem ser consideradas em todas as interações neste repositório.
    - Elas devem orientar o trabalho sem obrigar o agente a executar tarefas que não sejam necessárias para a solicitação atual.

## 1. Idioma

- **OBRIGATÓRIO: Toda resposta, pensamento interno, análise e justificativa devem ser apresentados exclusivamente em português brasileiro.**
- **NÃO UTILIZAR inglês para comunicação com o usuário, só mostrar palavras ou termos técnicos estejam em inglês caso extremamente necessario.**
- **Se houver dúvida sobre o idioma, SEMPRE usar português.**
- Não misturar idiomas sem necessidade técnica explícita.
- Manter nomes de APIs, comandos, código, mensagens de erro e termos técnicos no idioma original quando isso for mais claro ou necessário.
- Manter nomes de APIs, comandos, código-fonte, mensagens de erro e termos técnicos no idioma original (inglês) quando necessário para clareza técnica.
---

## 2. Postura Crítica e Técnica

- Não concordar automaticamente com as ideias apresentadas.
- Sempre analisar riscos, trade-offs e possíveis falhas.
- Se a solução estiver correta, ainda assim sugerir ao menos uma melhoria, validação adicional ou edge case relevante.
- Priorizar respostas objetivas, acionáveis e técnicas.
- Avaliar riscos, trade-offs, efeitos colaterais e possíveis falhas.
- Quando a solução proposta estiver correta, confirmar isso e, quando relevante, apontar uma melhoria, validação ou edge case.
- Priorizar respostas objetivas, técnicas e acionáveis.
- Não criar complexidade ou etapas adicionais sem necessidade.

---

## 3. Regra Principal: Trabalhar Apenas no que Foi Solicitado
    - Não executar tarefas adicionais apenas porque parecem úteis.
Não fazer refactors, reorganizações, limpezas ou melhorias fora do escopo solicitado.
Não alterar arquivos de documentação, contexto, configurações ou estrutura do projeto sem necessidade para a tarefa.
Antes de criar um novo arquivo, verificar se um arquivo existente pode ser utilizado.
Antes de alterar vários arquivos, verificar se todos são realmente necessários.
Se uma ação adicional for importante para segurança, integridade ou funcionamento da solução, explicar o motivo antes de executá-la.

4. Análise Antes da Alteração de Código
Quando a solicitação envolver código:

Identificar o componente, módulo ou camada realmente afetado.

Inspecionar somente os arquivos e referências necessários para compreender a alteração.

Não presumir que arquivos aparentemente relacionados também precisam ser modificados.

Se houver contexto suficiente no projeto, não fazer perguntas desnecessárias.

Fazer perguntas somente quando uma informação ausente impedir uma implementação segura ou correta.

5. Desenvolvimento MQL5 / MetaTrader 5
Este é um projeto de Expert Advisors (EAs) para MetaTrader 5, principalmente em MQL5.

Ao trabalhar no código:

Preservar a arquitetura, estratégia e comportamento existentes, salvo quando a alteração solicitada exigir mudança.

Não alterar regras de entrada, saída, gerenciamento de posições, grid, recuperação, filtros ou gerenciamento de risco sem deixar isso explícito.

Tratar mudanças em lógica de trading como alterações de comportamento, mesmo quando a mudança de código parecer pequena.

Evitar introduzir comportamento que possa produzir ordens inesperadas, duplicadas ou incompatíveis com as regras do robô.

Considerar efeitos sobre backtest, execução em tempo real, spread, slippage, estado das posições e reinicialização do EA quando aplicável.

Ao modificar lógica de trading, indicar quais cenários devem ser validados no Strategy Tester.

Não assumir que um resultado de backtest representa desempenho futuro ou execução real.

6. Backtests e Validação
Quando a tarefa envolver backtests:

Preservar os parâmetros e condições do teste original, salvo instrução contrária.

Identificar claramente qualquer mudança de parâmetro, período, ativo, timeframe ou condição de execução.

Diferenciar resultado de backtest, validação out-of-sample e comportamento esperado em conta real.

Não considerar uma melhoria de backtest como prova suficiente de melhoria da estratégia.

Quando aplicável, sugerir testes adicionais para verificar overfitting, robustez e sensibilidade dos parâmetros.

Não executar múltiplos backtests ou análises extensas sem que isso seja necessário para a solicitação.

7. Segurança e Gerenciamento de Risco
Não sugerir alterações que removam ou contornem controles de risco sem explicitar o impacto.

Alertar quando uma alteração puder aumentar exposição, frequência de operações, tamanho de posição, drawdown ou risco operacional.

Não mascarar erros de execução ou falhas de negociação apenas para evitar mensagens no log.

Preservar mecanismos existentes de proteção, limites e validações, salvo solicitação explícita para alterá-los.

8. Documentação e Contexto do Projeto
O projeto pode conter materiais auxiliares em:

.ai/

.ai/agents/

.ai/skills/

.ai/rules/

.kiro/

_documentacao/

Esses materiais não devem ser lidos indiscriminadamente.

Consultar somente os arquivos relevantes para a tarefa atual.

Se existir uma skill, regra ou documentação específica para o problema em questão, utilizá-la como referência.

Não carregar ou processar todas as skills, regras ou documentos apenas por existirem no projeto.

Não atualizar automaticamente arquivos de contexto ou documentação.

Atualizar documentação somente quando solicitado explicitamente ou quando a própria tarefa exigir a atualização de um artefato que faz parte da implementação.

9. Agentes e Skills
Utilizar o agente selecionado para a especialidade da tarefa.

Não aplicar regras de outro domínio apenas porque estão disponíveis no repositório.

Skills devem ser utilizadas quando forem relevantes para a tarefa, e não de forma indiscriminada.

Não ler todas as skills disponíveis antes de começar um trabalho.

Se uma skill ou agente contiver instruções conflitantes com este arquivo, priorizar as instruções específicas da tarefa e a configuração efetiva do OpenCode.

10. Alterações de Código
Ao implementar uma alteração:

Preferir mudanças pequenas, claras e reversíveis.

Preservar código existente que não esteja relacionado à solicitação.

Evitar refactors abrangentes sem solicitação explícita.

Não criar abstrações prematuramente.

Informar os arquivos alterados e o motivo de cada alteração.

Quando apropriado, fornecer um patch ou resumo objetivo das mudanças.

11. Testes e Verificação
Após uma alteração:

Executar somente os testes ou verificações relevantes para a mudança, quando disponíveis e apropriados.

Não executar uma bateria extensa de testes sem necessidade.

Informar quais verificações foram realizadas.

Se não for possível executar uma validação, informar claramente o que ficou sem validação.

Para alterações de trading, indicar também a validação recomendada no MetaTrader 5 Strategy Tester quando aplicável.

12. Git
Não criar commits, branches, merges, pushes, resets ou operações destrutivas sem solicitação explícita.

Não descartar alterações existentes do usuário.

Antes de operações potencialmente destrutivas, verificar o estado do repositório e explicar o impacto.

13. Formato das Respostas
Responder de forma objetiva.

Quando solicitado o conteúdo completo de um arquivo, fornecer o arquivo completo.

Caso contrário, preferir alterações pontuais.

Incluir comandos de verificação somente quando forem úteis para a tarefa.

Não repetir informações que já estejam claras no contexto da conversa.

14. Regra de Prioridade
Estas instruções são regras gerais do projeto.

Elas não devem impedir o agente de executar uma solicitação válida nem obrigá-lo a realizar etapas que não sejam necessárias.

Para cada tarefa, aplicar somente as regras que forem pertinentes ao problema atual.