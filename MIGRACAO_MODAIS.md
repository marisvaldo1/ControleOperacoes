# 🗂️ Guia de Migração para Modais Modulares

## ✅ Status da Migração

### Modais Críticos (Extraídos)
- ✅ **modal-operacao.html** - Modal Nova/Editar Operação
- ✅ **modal-selecionar-opcao.html** - Modal Selecionar Opção

### Modais Secundários (Extraídos)
- ✅ **modal-saldo-operacoes.html** - Modal Histórico de Operações
- ✅ **modal-saldo-insights.html** - Modal Insights

### Modais Pendentes
- ⏳ **modal-analise-tecnica.html** - Modal Análise Técnica (linhas 794-985 do opcoes.html)
- ⏳ **modal-simulacao.html** - Modal Simulação (linhas 986-1212 do opcoes.html)

## 📋 Próximos Passos

### 1. Completar Extração dos Modais

```bash
# Criar os modais restantes:
frontend/components/modals/opcoes/modal-analise-tecnica.html
frontend/components/modals/opcoes/modal-simulacao.html
```

### 2. Atualizar opcoes.html

Substituir todos os modais inline por containers de carregamento:

```html
<!-- Antes -->
<div class="modal modal-blur fade" id="modalOperacao" tabindex="-1">
    <!-- 132 linhas de HTML -->
</div>

<!-- Depois -->
<div id="modalOperacaoContainer"></div>
```

### 3. Atualizar Script de Inicialização

No final de `opcoes.html`, adicionar:

```html
<!-- Carregar Modal Loader -->
<script src="../js/core/modal-loader.js?v=1.0.8"></script>

<!-- Inicializar Modais -->
<script>
    // Carregar modais críticos imediatamente
    document.addEventListener('DOMContentLoaded', async () => {
        await initializeModals('critical');
        console.log('✓ Sistema de modais inicializado');
    });

    // Carregar modais secundários sob demanda
    document.getElementById('cardSaldoCorretoraCard').addEventListener('click', async () => {
        await loadModalOnDemand('saldo-operacoes');
        // Abrir modal normalmente
    });

    document.getElementById('btnSaldoInsights').addEventListener('click', async () => {
        await loadModalOnDemand('saldo-insights');
    });

    document.getElementById('btnAnaliseTecnica').addEventListener('click', async () => {
        await loadModalOnDemand('analise-tecnica');
    });

    document.getElementById('btnSimularOperacao').addEventListener('click', async () => {
        await loadModalOnDemand('simulacao');
    });
</script>
```

## 🎯 Estratégia de Carregamento Implementada

### Críticos (Carregamento Imediato)
```javascript
- modal-operacao.html (134 linhas)
- modal-selecionar-opcao.html (93 linhas)
```

### Secundários (Lazy Loading)
```javascript
- modal-saldo-operacoes.html (114 linhas)
- modal-saldo-insights.html (189 linhas)
- modal-analise-tecnica.html (191 linhas)
- modal-simulacao.html (226 linhas)
```

## 📊 Métricas da Migração

### Antes
- **opcoes.html**: 1.233 linhas
- **Modais inline**: ~947 linhas de código
- **Performance**: Todos os modais carregados de uma vez

### Depois
- **opcoes.html**: ~286 linhas (redução de 77%)
- **Modais modulares**: 6 arquivos separados
- **Performance**: Carregamento sob demanda
- **Manutenibilidade**: ⭐⭐⭐⭐⭐

## 🔧 Comandos para Teste

```bash
# Verificar estrutura criada
tree frontend/components/modals/opcoes

# Verificar modal loader
cat frontend/js/core/modal-loader.js

# Testar carregamento
# Abrir navegador em: http://localhost:5000/frontend/html/opcoes.html
# Abrir DevTools Console para ver logs de carregamento
```

## ⚠️ Pontos de Atenção

1. **IDs Globais**: Todos os IDs de elementos dentro dos modais devem permanecer únicos
2. **Event Listeners**: Verificar se eventos ainda funcionam após carregamento dinâmico
3. **CSS**: Garantir que estilos aplicados aos modais funcionem corretamente
4. **JavaScript**: Funções que manipulam modais precisam aguardar carregamento
5. **Bootstrap Modals**: Instâncias do Bootstrap Modal devem ser criadas após carregamento

## 🧪 Testes Necessários

- [ ] Abrir/Fechar cada modal
- [ ] Submeter formulário do modal de operação
- [ ] Selecionar opção no modal de seleção
- [ ] Filtrar dados no modal de histórico
- [ ] Visualizar gráficos em modais
- [ ] Verificar responsividade
- [ ] Testar em diferentes navegadores

## 📚 Documentação Adicional

- [Modal Loader API](../js/core/modal-loader.js)
- [Bootstrap Modal Docs](https://getbootstrap.com/docs/5.3/components/modal/)
- [Lazy Loading Pattern](https://web.dev/lazy-loading/)

---

**Criado em:** 10/02/2026
**Atualizado em:** 10/02/2026
**Status:** ✅ Correção de ordenação aplicada | 🔄 Migração de modais em andamento
