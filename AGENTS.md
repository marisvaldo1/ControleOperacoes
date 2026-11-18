# Controle de Operações — Instruções Globais do OpenCode

Estas regras valem para todas as interações neste repositório. Elas orientam o trabalho sem obrigar a execução de tarefas desnecessárias para a solicitação atual. Aplicar, em cada tarefa, somente as regras pertinentes.

> **Princípio central:** fazer exatamente o que foi pedido, com segurança, mudanças pequenas e verificáveis.

## 1. Idioma

- Toda resposta, raciocínio, análise e justificativa devem ser apresentados exclusivamente em português brasileiro.
- Em caso de dúvida sobre o idioma, usar sempre português.
- Não misturar idiomas sem necessidade técnica explícita.
- Manter nomes de APIs, comandos, código, mensagens de erro e termos técnicos no idioma original (inglês) quando isso for mais claro ou necessário.

## 2. Postura crítica e técnica

- Não concordar automaticamente com as ideias apresentadas.
- Mesmo quando a solução estiver correta, sugerir ao menos uma melhoria, validação adicional ou edge case relevante.
- Priorizar respostas objetivas, acionáveis e técnicas.
- Não criar complexidade ou etapas adicionais sem necessidade.

## 3. Escopo, análise e preservação

- Executar apenas o que foi solicitado; não executar tarefas adicionais apenas porque parecem úteis.
- Não fazer refactors, reorganizações, limpezas ou melhorias fora do escopo solicitado.
- Identificar o componente, módulo ou camada realmente afetado.
- Inspecionar somente os arquivos e referências necessários para compreender a alteração.
- Não presumir que arquivos aparentemente relacionados também precisam ser modificados.
- Antes de criar um novo arquivo, verificar se um arquivo existente pode ser utilizado.
- Antes de alterar vários arquivos, verificar se todos são realmente necessários.
- Se houver contexto suficiente no projeto, não fazer perguntas desnecessárias; perguntar somente quando uma informação ausente impedir uma implementação segura ou correta.
- Preservar arquitetura, estratégia e comportamento existentes, salvo quando a alteração solicitada exigir mudança.
- Preservar mecanismos existentes de proteção, limites e validações, salvo solicitação explícita para alterá-los.
- Se uma ação adicional for importante para segurança, integridade ou funcionamento da solução, explicar o motivo antes de executá-la.

## 4. Documentação e contexto do projeto

- Consultar somente os arquivos relevantes para a tarefa atual nos diretórios `.ai/`, `.ai/agents/`, `.ai/skills/`, `.ai/rules/` e `_documentacao/`.
- Não ler esses materiais indiscriminadamente nem carregar ou processar todas as skills, regras ou documentos apenas por existirem no projeto.
- Se existir skill, regra ou documentação específica para o problema em questão, utilizá-la como referência.
- Não atualizar automaticamente arquivos de contexto ou documentação.
- Atualizar documentação somente quando solicitado explicitamente ou quando a própria tarefa exigir a atualização de um artefato que faz parte da implementação.

## 5. Agentes e skills

- Utilizar o agente selecionado para a especialidade da tarefa.
- Não aplicar regras de outro domínio apenas porque estão disponíveis no repositório.
- Utilizar skills apenas quando forem relevantes para a tarefa, e não de forma indiscriminada.
- Não ler todas as skills disponíveis antes de começar um trabalho.
- Se uma skill ou agente contiver instruções conflitantes com este arquivo, priorizar as instruções específicas da tarefa e a configuração efetiva do OpenCode.

## 6. Alterações de código

- Preferir mudanças pequenas, claras e reversíveis.
- Preservar código existente que não esteja relacionado à solicitação.
- Evitar refactors abrangentes sem solicitação explícita.
- Não criar abstrações prematuramente.
- Informar os arquivos alterados e o motivo de cada alteração.

## 7. Testes e verificação

- Criar testes sempre que uma nova funcionalidade for criada.
- Ajustar testes para funcionalidades alteradas que possam impactar os testes existentes.
- Executar somente os testes ou verificações relevantes para a mudança, quando disponíveis e apropriados.
- Não executar uma bateria extensa de testes sem necessidade.
- Informar quais verificações foram realizadas.
- Se não for possível executar uma validação, informar claramente o que ficou sem validação.

## 8. Formato das respostas

- Responder de forma objetiva.
- Quando solicitado o conteúdo completo de um arquivo, fornecer o arquivo completo; caso contrário, preferir alterações pontuais.
- Incluir comandos de verificação somente quando forem úteis para a tarefa.
- Não repetir informações que já estejam claras no contexto da conversa.

## 9. Prioridade

- Estas instruções são regras gerais do projeto.
- Elas não devem impedir o agente de executar uma solicitação válida nem obrigá-lo a realizar etapas que não sejam necessárias.
- Para cada tarefa, aplicar somente as regras pertinentes ao problema atual.

## 10. Versão

- Atualizar a versão do sistema em todos os ajustes.