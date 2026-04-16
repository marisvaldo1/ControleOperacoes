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

Crie interfaces de front-end distintas e de nível de produção com alta qualidade de design. Use esta habilidade quando o usuário solicitar a criação de componentes web, páginas, artefatos, pôsteres ou aplicativos (exemplos incluem sites, landing pages, dashboards, componentes React, layouts HTML/CSS ou ao estilizar/embelezar qualquer interface de usuário web). Gere código criativo e refinado e design de interface de usuário que evite a estética genérica de IA. Licença: Termos completos em LICENSE.txt. Esta habilidade orienta a criação de interfaces de front-end distintas e de nível de produção que evitam a estética genérica de "IA desleixada". Implemente código funcional real com atenção excepcional aos detalhes estéticos e escolhas criativas.
O usuário fornece os requisitos de front-end: um componente, página, aplicativo ou interface a ser construído. Eles podem incluir contexto sobre a finalidade, o público-alvo ou as restrições técnicas.

Design Thinking
Antes de codificar, entenda o contexto e comprometa-se com uma direção estética OUSADA:

Propósito: Qual problema esta interface resolve? Quem a usa?
Tom: Escolha um extremo: brutalmente minimalista, caos maximalista, retrofuturista, orgânico/natural, luxuoso/refinado, lúdico/brinquedológico, editorial/revista, brutalista/cru, art déco/geométrico, suave/pastel, industrial/utilitário, etc. Há muitas opções para escolher. Use-as como inspiração, mas crie um design que seja fiel à direção estética escolhida.
Restrições: Requisitos técnicos (estrutura, desempenho, acessibilidade).

Diferenciação: O que torna isso INESQUECÍVEL? Qual é a única coisa que as pessoas vão se lembrar?

CRÍTICO: Escolha uma direção conceitual clara e execute-a com precisão. Tanto o maximalismo ousado quanto o minimalismo refinado funcionam — a chave é a intencionalidade, não a intensidade.
Em seguida, implemente um código funcional (HTML/CSS/JS, React, Vue, etc.) que seja:

Pronto para produção e funcional
Visualmente impactante e memorável
Coeso, com um ponto de vista estético claro
Meticulosamente refinado em cada detalhe

Diretrizes de Estética para Frontend
Concentre-se em:

Tipografia: Escolha fontes bonitas, únicas e interessantes. Evite fontes genéricas como Arial e Inter; opte por escolhas distintas que elevem a estética do frontend; escolhas de fontes inesperadas e com personalidade. Combine uma fonte de exibição distinta com uma fonte de corpo refinada.

Cor e Tema: Comprometa-se com uma estética coesa. Use variáveis ​​CSS para consistência. Cores dominantes com acentos nítidos têm melhor desempenho do que paletas tímidas e uniformemente distribuídas.

Movimentação: Use animações para efeitos e microinterações. Priorize soluções somente em CSS para HTML. Use a biblioteca Motion para React quando disponível. Foque em momentos de alto impacto: um carregamento de página bem orquestrado com revelações escalonadas (atraso de animação) cria mais encanto do que microinterações dispersas. Use estados de rolagem e de foco que surpreendam.
Composição Espacial: Layouts inesperados. Assimetria. Sobreposição. Fluxo diagonal. Elementos que quebram a grade. Espaço negativo generoso OU densidade controlada.
Fundos e Detalhes Visuais: Crie atmosfera e profundidade em vez de usar cores sólidas por padrão. Adicione efeitos contextuais e texturas que combinem com a estética geral. Aplique formas criativas como malhas de gradiente, texturas de ruído, padrões geométricos, transparências em camadas, sombras dramáticas, bordas decorativas, cursores personalizados e sobreposições de grãos.

NUNCA use estéticas genéricas geradas por IA, como famílias de fontes batidas (Inter, Roboto, Arial, fontes do sistema), esquemas de cores clichês (principalmente gradientes roxos em fundos brancos), layouts e padrões de componentes previsíveis e design padronizado que carece de personalidade específica ao contexto.
Interprete de forma criativa e faça escolhas inesperadas que pareçam genuinamente adequadas ao contexto. Nenhum design deve ser igual ao outro. Varie entre temas claros e escuros, fontes diferentes e estéticas distintas. JAMAIS converja para escolhas comuns (Space Grotesk, por exemplo) ao longo das gerações.
IMPORTANTE: Adeque a complexidade da implementação à visão estética. Designs maximalistas exigem código elaborado com animações e efeitos complexos. Designs minimalistas ou refinados exigem contenção, precisão e atenção cuidadosa ao espaçamento, tipografia e detalhes sutis. A elegância vem da boa execução da visão.
Lembre-se: Você é capaz de trabalhos criativos extraordinários. Não se reprima, mostre o que realmente pode ser criado quando se pensa fora da caixa e se compromete totalmente com uma visão singular.
Enviar feedback
Painéis laterais
Histórico
Salvas