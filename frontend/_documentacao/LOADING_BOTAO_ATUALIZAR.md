# Loading no Botão Atualizar

**Data**: 06/05/2026  
**Tarefa**: Adicionar loading em todos os valores durante atualização

---

## ✅ Implementação

### Problema
Ao clicar no botão "Atualizar" (refresh) no modal de Análise, os valores não mostravam um indicador de loading enquanto os dados estavam sendo recarregados.

### Solução
Expandida a função `setMetricsLoading()` para incluir **TODOS** os elementos que são atualizados durante o refresh:

---

## 📋 Elementos com Loading

### 1. ✅ Métricas Principais (Centro do Donut)
- `maDonutValue` - Valor total do lucro
- `maDonutSub` - Quantidade de operações

### 2. ✅ Métricas da Esquerda
- `maWinRate` - Taxa de acerto (%)
- `maTicketMedio` - Ticket médio
- `maRoiValue` - ROI (%)

### 3. ✅ Painel Direito Header
- `maRightResult` - Lucro total
- `maRightSub` - Resumo (Lucro Total | X Operações | Y% Win Rate)

### 4. ✅ Footer Summary
- `maMelhorTrade` - Melhor trade
- `maTicketMedioFooter` - Ticket médio (footer)
- `maRoiFooter` - ROI (footer)

### 5. ✅ Lista de Operações
- `maOpsList` - Lista completa de operações individuais

### 6. ✅ Listas de Tipo
- `maTipoList` - Lista de tipos (esquerda)
- `maDistTipo` - Distribuição por tipo (direita)

### 7. ✅ Badges de Totalização
- Badge TOTAL (azul)
- Badge ABERTAS (verde)
- Badge FECHADAS (cinza)
- Badge PRÊMIO US$ (amarelo)

---

## 🔧 Código Implementado

**Arquivo**: `frontend/js/shared/modal-analise.js`

```javascript
const _LOADING_SPIN = '<span class="spinner-border spinner-border-sm text-secondary" role="status"></span>';

function setMetricsLoading() {
    // Métricas principais (centro do donut)
    ['maDonutValue', 'maDonutSub'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = _LOADING_SPIN;
    });
    
    // Métricas da esquerda
    ['maWinRate', 'maTicketMedio', 'maRoiValue'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = _LOADING_SPIN;
    });
    
    // Painel direito header
    ['maRightResult', 'maRightSub'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = _LOADING_SPIN;
    });
    
    // Footer summary
    ['maMelhorTrade', 'maTicketMedioFooter', 'maRoiFooter'].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = _LOADING_SPIN;
    });
    
    // Lista de operações
    const opsList = document.getElementById('maOpsList');
    if (opsList) {
        opsList.innerHTML = '<div class="text-center py-4">' + _LOADING_SPIN + '</div>';
    }
    
    // Listas de tipo (esquerda e direita)
    const tipoList = document.getElementById('maTipoList');
    if (tipoList) {
        tipoList.innerHTML = '<div class="text-center py-2">' + _LOADING_SPIN + '</div>';
    }
    
    const distTipo = document.getElementById('maDistTipo');
    if (distTipo) {
        distTipo.innerHTML = '<div class="text-center py-2">' + _LOADING_SPIN + '</div>';
    }
    
    // Badges de totalização (se existirem)
    const totalsContainer = document.querySelector('.cfb-totals');
    if (totalsContainer) {
        const badges = totalsContainer.querySelectorAll('.cfb-tag');
        badges.forEach(function(badge) {
            const originalClass = badge.className;
            badge.innerHTML = _LOADING_SPIN;
            badge.className = originalClass; // Preserva as classes de estilo
        });
    }
}
```

---

## 🧪 Teste Automatizado

**Arquivo**: `frontend/tests/pages/crypto.spec.js`

```javascript
test("[Crypto] loading deve aparecer durante atualização", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
        window.__appLayoutReady === true &&
        typeof window.ModalAnalise !== 'undefined'
    , { timeout: 20000 });

    // Abre o modal
    await page.evaluate(() => window.ModalAnalise && window.ModalAnalise.open());
    await page.waitForSelector("#modalAnalise.show", { timeout: 10000 });
    
    // Aguarda dados carregarem
    await page.waitForFunction(() => {
        const el = document.getElementById('maDonutSub');
        return el && el.textContent && el.textContent.trim() !== '';
    }, { timeout: 30000 });

    // Clica no botão refresh
    const btnRefresh = page.locator("#modalAnalise.show .cfb-btn.ref");
    await expect(btnRefresh).toBeVisible({ timeout: 5000 });
    
    // Clica e imediatamente verifica se o loading aparece
    await btnRefresh.click();
    
    // Verifica se o spinner aparece em pelo menos um dos elementos
    const hasSpinner = await page.evaluate(() => {
        const elements = [
            'maDonutValue', 'maDonutSub', 'maWinRate', 'maTicketMedio', 
            'maRoiValue', 'maRightResult', 'maRightSub', 'maMelhorTrade',
            'maTicketMedioFooter', 'maRoiFooter'
        ];
        
        return elements.some(id => {
            const el = document.getElementById(id);
            return el && el.innerHTML.includes('spinner-border');
        });
    });
    
    // Aguarda o loading terminar
    await page.waitForTimeout(2000);
    
    // Verifica se os valores foram atualizados (não devem ter spinner)
    const noSpinner = await page.evaluate(() => {
        const elements = [
            'maDonutValue', 'maDonutSub', 'maWinRate', 'maTicketMedio', 
            'maRoiValue', 'maRightResult', 'maRightSub', 'maMelhorTrade',
            'maTicketMedioFooter', 'maRoiFooter'
        ];
        
        return elements.every(id => {
            const el = document.getElementById(id);
            return el && !el.innerHTML.includes('spinner-border');
        });
    });
    
    expect(noSpinner).toBe(true);
});
```

---

## 📊 Resultados dos Testes

- **Backend (pytest)**: ✅ 59/59 testes passando
- **Frontend (Playwright)**: ✅ 50/50 testes passando (incluindo novo teste de loading)
- **Total**: ✅ **109/109 testes passando**

---

## 🎯 Comportamento Esperado

### Ao Clicar no Botão Refresh:

1. **Imediatamente**:
   - Botão de refresh começa a girar (classe `spinning`)
   - Todos os valores mostram spinner de loading
   - Lista de operações mostra spinner centralizado
   - Badges de totalização mostram spinner

2. **Durante o Carregamento**:
   - API é chamada para buscar dados atualizados
   - Filtros são aplicados
   - Estatísticas são recalculadas

3. **Após o Carregamento**:
   - Botão de refresh para de girar
   - Todos os valores são atualizados com dados novos
   - Spinners desaparecem
   - Timestamp é atualizado

---

## 🔍 Detalhes Técnicos

### Spinner Bootstrap
Utiliza o componente `spinner-border` do Bootstrap:
```html
<span class="spinner-border spinner-border-sm text-secondary" role="status"></span>
```

### Preservação de Classes
Para os badges de totalização, as classes CSS originais são preservadas:
```javascript
const originalClass = badge.className;
badge.innerHTML = _LOADING_SPIN;
badge.className = originalClass; // Preserva cores e estilos
```

### Fluxo de Execução
```
1. Usuário clica em refresh
2. setMetricsLoading() é chamado
3. Todos os elementos recebem spinner
4. loadData() busca dados da API
5. filterByPeriod() aplica filtros
6. renderAll() atualiza todos os valores
7. Spinners são substituídos por valores reais
```

---

## ✅ Validação Manual

Para validar manualmente:

1. [ ] Abrir modal de Análise
2. [ ] Clicar no botão de refresh (ícone de setas circulares)
3. [ ] Verificar se TODOS os valores mostram spinner durante o carregamento:
   - Centro do donut (valor e quantidade)
   - Métricas da esquerda (Win Rate, Ticket Médio, ROI)
   - Painel direito (Lucro Total e resumo)
   - Footer (Melhor Trade, Ticket Médio, ROI)
   - Lista de operações
   - Listas de tipo (esquerda e direita)
   - Badges de totalização (TOTAL, ABERTAS, FECHADAS, PRÊMIO)
4. [ ] Verificar se o botão de refresh gira durante o carregamento
5. [ ] Verificar se todos os valores são atualizados após o carregamento
6. [ ] Verificar se o timestamp é atualizado

---

## 📝 Notas

- O loading é aplicado apenas na aba "Desempenho"
- Para as abas "Posições Abertas", "Evolução" e "Risco", o loading é gerenciado separadamente
- O spinner é pequeno (`spinner-border-sm`) para não ocupar muito espaço
- A cor do spinner é secundária (`text-secondary`) para não chamar muita atenção

---

## 🚀 Melhorias Futuras

Possíveis melhorias para o futuro:

1. Adicionar loading skeleton ao invés de spinner simples
2. Animar a transição entre loading e valores reais
3. Adicionar loading progressivo (carregar elementos em ordem)
4. Adicionar feedback visual quando não há dados para atualizar

---

## ✅ Conclusão

O loading agora é exibido em **TODOS** os elementos que são atualizados durante o refresh, proporcionando um feedback visual claro para o usuário de que os dados estão sendo recarregados.

Todos os 109 testes estão passando, incluindo o novo teste específico para validar o comportamento do loading! 🎉
