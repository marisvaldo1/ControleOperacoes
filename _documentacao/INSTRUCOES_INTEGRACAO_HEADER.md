# 🔧 Instruções de Integração - CryptoModalHeader

## ⚠️ IMPORTANTE: Scripts Necessários

Para que o modal funcione corretamente com o novo cabeçalho padronizado, você **DEVE** incluir os seguintes scripts **ANTES** do script `modal-analise.js`:

### Ordem Correta de Carregamento

```html
<!-- 1. Crypto Filter Bar (componente de filtros) -->
<script src="../js/core/crypto-filter-bar.js"></script>

<!-- 2. Modal Header (componente de cabeçalho) -->
<script src="../js/core/modal-header.js"></script>

<!-- 3. Modal Analise (seu modal) -->
<script src="../js/shared/modal-analise.js"></script>
```

## 📁 Localização dos Arquivos

Verifique se os seguintes arquivos existem no projeto:

```
frontend/
├── js/
│   ├── core/
│   │   ├── crypto-filter-bar.js    ← Componente de filtros
│   │   └── modal-header.js         ← Componente de cabeçalho
│   └── shared/
│       └── modal-analise.js        ← Modal de análise
└── components/
    └── modals/
        └── opcoes/
            └── modal-analise.html  ← Template HTML
```

## 🔍 Como Verificar se Está Funcionando

### 1. Abrir o Console do Navegador (F12)

### 2. Verificar se os Scripts Foram Carregados

```javascript
// No console, digite:
typeof CryptoModalHeader
// Deve retornar: "object" ou "function"

typeof CryptoFilterBar
// Deve retornar: "object" ou "function"

typeof ModalAnalise
// Deve retornar: "object"
```

### 3. Verificar Erros

Se você ver erros como:
```
CryptoModalHeader is not defined
```

**Solução:** Verifique se os scripts estão sendo carregados na ordem correta.

## 🎨 Resultado Esperado

Após a integração correta, o modal deve exibir:

### Cabeçalho (Linha 1)
```
⚡ Análise de Performance · Crypto          Atualizado: 17:03  🔄  ✕
```

### Filtros de Período (Linha 2)
```
[Todos] [Hoje] [Semana] [Mês] [Período] STATUS: [A F ▼] TIPO: [C, P ▼] MOEDA: [Todas ▼] CORRETORA: [Todas ▼]
```

### Badges de Totais (Linha 3)
```
[TOTAL 5] [ABERTAS 3] [FECHADAS 2] [PRÊMIO US$ 27,04]
```

### Abas (Linha 4)
```
[📊 Desempenho] [📦 Posições Abertas] [📈 Evolução] [⚠️ Risco]
```

## 🐛 Troubleshooting

### Problema 1: Header não aparece

**Sintoma:** O espaço do header fica vazio

**Causa:** Scripts não carregados ou carregados na ordem errada

**Solução:**
1. Verificar se os arquivos existem
2. Verificar a ordem de carregamento
3. Verificar erros no console

### Problema 2: Filtros não funcionam

**Sintoma:** Clicar nos filtros não atualiza os dados

**Causa:** Callback `onFilter` não está sendo chamado

**Solução:**
```javascript
// Adicionar log no callback para debug
onFilter: (filterState) => {
    console.log('[DEBUG] Filtro alterado:', filterState);
    // ... resto do código
}
```

### Problema 3: Totais não aparecem

**Sintoma:** Badges de totais ficam vazios

**Causa:** Método `setOps()` não foi chamado

**Solução:**
```javascript
// Após carregar as operações, chamar:
if (state.header) {
    state.header.setOps(todasOps, opsFiltradas);
    state.header.tick();
}
```

### Problema 4: Relógio não atualiza

**Sintoma:** Horário de atualização não muda

**Causa:** Método `tick()` não está sendo chamado

**Solução:**
```javascript
// Após cada refresh, chamar:
if (state.header && typeof state.header.tick === 'function') {
    state.header.tick();
}
```

## 📝 Exemplo Completo de Integração

### HTML (index.html ou página principal)

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Sistema de Opções</title>
    
    <!-- CSS -->
    <link rel="stylesheet" href="../css/modal-header.css">
    <link rel="stylesheet" href="../css/modal-analise.css">
</head>
<body>

    <!-- Container para o modal -->
    <div id="modalAnaliseContainer"></div>
    
    <!-- Botão para abrir o modal -->
    <button id="btnAnalise">Análise de Performance</button>

    <!-- Scripts na ordem correta -->
    <script src="../js/core/crypto-filter-bar.js"></script>
    <script src="../js/core/modal-header.js"></script>
    <script src="../js/shared/modal-analise.js"></script>
    
    <script>
        // Configurar para crypto
        ModalAnalise.configure({
            apiEndpoint: '/api/crypto'
        });
    </script>
</body>
</html>
```

### JavaScript (uso básico)

```javascript
// Abrir o modal
document.getElementById('btnAnalise').addEventListener('click', () => {
    ModalAnalise.open();
});

// Ou via código
ModalAnalise.open();
```

## 🎯 Checklist de Integração

- [ ] Arquivo `crypto-filter-bar.js` existe em `frontend/js/core/`
- [ ] Arquivo `modal-header.js` existe em `frontend/js/core/`
- [ ] Arquivo `modal-analise.js` existe em `frontend/js/shared/`
- [ ] Scripts carregados na ordem correta no HTML
- [ ] Console não mostra erros de "undefined"
- [ ] Header aparece corretamente
- [ ] Filtros de período funcionam
- [ ] Dropdowns de STATUS, TIPO, etc. aparecem
- [ ] Badges de totais são exibidos
- [ ] Relógio de atualização funciona
- [ ] Botão de refresh funciona
- [ ] Filtros permanecem visíveis em todas as abas

## 📞 Suporte

Se após seguir estas instruções o problema persistir:

1. **Verificar console** (F12) para erros
2. **Verificar Network** (aba Network no DevTools) se os scripts estão sendo carregados
3. **Verificar versão** dos arquivos (podem estar desatualizados)
4. **Limpar cache** do navegador (Ctrl+Shift+Delete)

## 🔄 Atualização de Arquivos Existentes

Se você já tinha uma versão antiga do modal, siga estes passos:

### 1. Backup dos Arquivos Antigos

```bash
cp frontend/js/shared/modal-analise.js frontend/js/shared/modal-analise.js.backup
cp frontend/components/modals/opcoes/modal-analise.html frontend/components/modals/opcoes/modal-analise.html.backup
```

### 2. Substituir pelos Novos Arquivos

Os arquivos já foram atualizados com as mudanças necessárias.

### 3. Verificar Customizações

Se você tinha customizações no código antigo, será necessário replicá-las no novo código.

### 4. Testar

Abra o modal e verifique se tudo funciona conforme esperado.

## 🎨 Customização de Estilos

Se você quiser customizar as cores ou estilos do header:

### CSS Customizado

```css
/* Customizar cor do header */
.cfb-header {
    background: #1a2332 !important;
}

/* Customizar cor dos filtros ativos */
.cfb-period-btn.active {
    background: #2dc653 !important;
    color: #fff !important;
}

/* Customizar badges de totais */
.cfb-total-badge {
    background: rgba(45, 198, 83, 0.18) !important;
    color: #2dc653 !important;
}
```

## 📚 Documentação Adicional

Para mais informações, consulte:

- `ANALISE_PERFORMANCE_EXPLICACAO.md` - Explicação dos valores
- `MODAL_ANALISE_ATUALIZACOES.md` - Guia completo de uso
- `RESUMO_MUDANCAS.md` - Resumo das mudanças
- `frontend/components/shared/modal-header.html` - Documentação do componente

## ✅ Conclusão

Seguindo estas instruções, o modal de Análise de Performance ficará com o mesmo padrão visual do Dashboard Analítico, com:

- ✅ Cabeçalho padronizado
- ✅ Filtros consistentes
- ✅ Badges de totais
- ✅ Relógio de atualização
- ✅ Botão de refresh integrado
- ✅ Filtros visíveis em todas as abas

**Importante:** Os filtros agora permanecem visíveis em TODAS as abas (Desempenho, Posições Abertas, Evolução e Risco), conforme solicitado.
