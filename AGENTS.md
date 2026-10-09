# Controle de operações — Instruções Globais do OpenCode
  - Estas regras devem ser consideradas em todas as interações neste repositório.
  - Elas devem orientar o trabalho sem obrigar o agente a executar tarefas que não sejam necessárias para a solicitação atual.

## 1. Idioma
- **OBRIGATÓRIO: Toda resposta, pensamento interno, análise e justificativa devem ser apresentados exclusivamente em português brasileiro.**
- **Se houver dúvida sobre o idioma, SEMPRE usar português.**
- Não misturar idiomas sem necessidade técnica explícita.
- Manter nomes de APIs, comandos, código, mensagens de erro e termos técnicos no idioma original quando isso for mais claro ou necessário.
- Manter nomes de APIs, comandos, código-fonte, mensagens de erro e termos técnicos no idioma original (inglês) quando necessário para clareza técnica.

---

## 2. Postura Crítica e Técnica
- Não concordar automaticamente com as ideias apresentadas.
- Se a solução estiver correta, ainda assim sugerir ao menos uma melhoria, validação adicional ou edge case relevante.
- Priorizar respostas objetivas, acionáveis e técnicas.
- Não criar complexidade ou etapas adicionais sem necessidade.

---

## 3. Regra Principal: Trabalhar Apenas no que Foi Solicitado
- Não executar tarefas adicionais apenas porque parecem úteis.
- Não fazer refactors, reorganizações, limpezas ou melhorias fora do escopo solicitado.
- Não alterar arquivos de documentação, contexto, configurações ou estrutura do projeto sem necessidade para a tarefa.
- Antes de criar um novo arquivo, verificar se um arquivo existente pode ser utilizado.
- Antes de alterar vários arquivos, verificar se todos são realmente necessários.
- Se uma ação adicional for importante para segurança, integridade ou funcionamento da solução, explicar o motivo antes de executá-la.

---

4. Análise Antes da Alteração de Código
- Identificar o componente, módulo ou camada realmente afetado.
- Inspecionar somente os arquivos e referências necessários para compreender a alteração.
- Não presumir que arquivos aparentemente relacionados também precisam ser modificados.
- Se houver contexto suficiente no projeto, não fazer perguntas desnecessárias.
- Fazer perguntas somente quando uma informação ausente impedir uma implementação segura ou correta.

---

5. Ao trabalhar no código:
- Preservar a arquitetura, estratégia e comportamento existentes, salvo quando a alteração solicitada exigir mudança.
- Preservar mecanismos existentes de proteção, limites e validações, salvo solicitação explícita para alterá-los.

---

6. Documentação e Contexto do Projeto
O projeto pode conter materiais auxiliares em:

.ai/
.ai/agents/
.ai/skills/
.ai/rules/
_documentacao/

- Esses materiais não devem ser lidos indiscriminadamente.
- Consultar somente os arquivos relevantes para a tarefa atual.
- Se existir uma skill, regra ou documentação específica para o problema em questão, utilizá-la como referência.
- Não carregar ou processar todas as skills, regras ou documentos apenas por existirem no projeto.
- Não atualizar automaticamente arquivos de contexto ou documentação.
- Atualizar documentação somente quando solicitado explicitamente ou quando a própria tarefa exigir a atualização de um artefato que faz parte da implementação.

---

7. Agentes e Skills
- Utilizar o agente selecionado para a especialidade da tarefa.
- Não aplicar regras de outro domínio apenas porque estão disponíveis no repositório.
- Skills devem ser utilizadas quando forem relevantes para a tarefa, e não de forma indiscriminada.
- Não ler todas as skills disponíveis antes de começar um trabalho.
- Se uma skill ou agente contiver instruções conflitantes com este arquivo, priorizar as instruções específicas da tarefa e a configuração efetiva do OpenCode.

---

8. Alterações de Código
- Preferir mudanças pequenas, claras e reversíveis.
- Preservar código existente que não esteja relacionado à solicitação.
- Evitar refactors abrangentes sem solicitação explícita.
- Não criar abstrações prematuramente.
- Informar os arquivos alterados e o motivo de cada alteração.

---

9. Testes e Verificação
- Executar somente os testes ou verificações relevantes para a mudança, quando disponíveis e apropriados.
- Não executar uma bateria extensa de testes sem necessidade.
- Informar quais verificações foram realizadas.
- Se não for possível executar uma validação, informar claramente o que ficou sem validação.

---

10. Formato das Respostas
- Responder de forma objetiva.
- Quando solicitado o conteúdo completo de um arquivo, fornecer o arquivo completo.
- Caso contrário, preferir alterações pontuais.
- Incluir comandos de verificação somente quando forem úteis para a tarefa.
- Não repetir informações que já estejam claras no contexto da conversa.

---

11. Regra de Prioridade
- Estas instruções são regras gerais do projeto.
- Elas não devem impedir o agente de executar uma solicitação válida nem obrigá-lo a realizar etapas que não sejam necessárias.
- Para cada tarefa, aplicar somente as regras que forem pertinentes ao problema atual.

## 12. Versão
- Atualizar a versão do sistema para todos os ajustes.
