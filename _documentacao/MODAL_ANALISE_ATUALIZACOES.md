# Modal de Análise de Performance - Atualizações

## 🎯 Mudanças Implementadas

### 1. **Padronização do Cabeçalho**

#### Antes:
```html
<div class="modal-header ma-header">
    <h5 class="modal-title">Análise de Performance</h5>
    <button class="ma-refresh-btn">...</button>
    <button class="btn-close">...</button>
</div>
<div class="ma-filter-bar">
    <button data-period="all">Todos</button>
    <button data-period="today">Hoje</button>
    <!-- ... mais botões ... -->
</div>
```

#### Depois:
```html
<!-- Header padrão — gerenciado por CryptoModalHeader -->
<div id="maModalHeader" style="flex-shrink:0;"></div>
```

**Benefícios:**
- ✅ Consistência visual com outros modais (Dashboard Analítico)
- ✅ Filtros padronizados e reutilizáveis
- ✅ Totalizadores automáticos
- ✅ Relógio de atualização
- ✅ Menos código duplicado

### 2. **Validação de Dados**

Adicionada validação automática para detectar valores suspeitos:

```javascript
function getNumber(op, fields) {
    for (let i = 0; i < fields.length; i++) {
        const v = parseFloat(op[fields[i]]);
        if (!Number.isNaN(v)) {
            // ⚠️ Validação: alertar sobre valores suspeitos em crypto
            if (state.apiEndpoint.includes('/crypto') && fields[0] === 'premio_us') {
                if (v > 0 && v < 0.5) {
                    console.warn('[modal-analise] ⚠️ Valor suspeito detectado:', {
                        id: op.id,
                        ativo: op.ativo_base || op.ativo,
                        tipo: op.tipo,
                        campo: fields[i],
                        valor: v,
                        premio_us: op.premio_us,
                        resultado: op.resultado,
                        cotacao_atual: op.cotacao_atual,
                        sugestao: 'Verificar se o campo correto está sendo usado'
                    });
                }
            }
            return v;
        }
    }
    return 0;
}
```

**O que detecta:**
- Valores de prêmio muito baixos (< US$ 0,50)
- Possível uso de campo errado (cotacao_atual vs premio_us)
- Logs detalhados no console para debug

### 3. **Tooltips Explicativos**

Adicionados tooltips em todas as métricas principais:

| Métrica | Tooltip | Ícone |
|---------|---------|-------|
| **Win Rate** | "Percentual de operações que resultaram em lucro" | ✓ Check |
| **Ticket Médio** | "Resultado médio por operação (Lucro Total ÷ Número de Operações)" | $ Dólar |
| **ROI Total** | "Retorno sobre Investimento: (Lucro Total ÷ Saldo Configurado) × 100" | ↓ Seta |
| **Data** | "Ordenar por data da operação (mais recente primeiro)" | 📅 Calendário |
| **Resultado** | "Ordenar por resultado (maior lucro primeiro)" | 💰 Dinheiro |
| **%** | "Ordenar por percentual de retorno (maior % primeiro)" | % Percentual |

### 4. **Ícones Visuais**

Adicionados ícones SVG em todas as métricas para melhor identificação visual:

```html
<!-- Exemplo: Win Rate -->
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
</svg>
Win Rate
```

## 🔧 Como Usar o Novo Modal

### Integração Básica

```javascript
// 1. Incluir dependências no HTML
<script src="../js/core/crypto-filter-bar.js"></script>
<script src="../js/core/modal-header.js"></script>
<script src="../js/shared/modal-analise.js"></script>

// 2. Configurar o modal (opcional)
ModalAnalise.configure({
    apiEndpoint: '/api/crypto',  // ou '/api/opcoes'
    containerSelector: '#modalAnaliseContainer',
    modalId: 'modalAnalise'
});

// 3. Abrir o modal
ModalAnalise.open();
```

### Configuração para Crypto

```javascript
// Para usar com operações de crypto
ModalAnalise.configure({
    apiEndpoint: '/api/crypto'
});

// O modal automaticamente:
// - Usa formatação em US$ (USD)
// - Calcula ROI baseado em cryptoConfig.saldoCrypto
// - Valida valores suspeitos
// - Mostra "Análise de Performance · Crypto" no título
```

### Configuração para Opções

```javascript
// Para usar com opções tradicionais
ModalAnalise.configure({
    apiEndpoint: '/api/opcoes'
});

// O modal automaticamente:
// - Usa formatação em R$ (BRL)
// - Calcula ROI baseado em appConfig.saldoAcoes
// - Mostra "Análise de Performance · Opções" no título
```

## 📊 Estrutura de Dados Esperada

### Formato de Operação Crypto

```json
{
    "id": 123,
    "ativo_base": "BTC",
    "ativo": "BTC/USDT",
    "tipo": "PUT",
    "status": "ABERTA",
    "premio_us": 12.50,           // ✅ Resultado principal
    "resultado": 12.50,            // ✅ Fallback
    "cotacao_atual": 45000.00,     // ❌ NÃO usar como resultado
    "preco_entrada": 11.80,
    "abertura": 44500.00,
    "strike": 44000.00,
    "quantidade": 1,
    "exercicio": "2024-05-15",
    "vencimento": "2024-05-15",
    "data_operacao": "2024-05-01",
    "exercicio_automatico": false
}
```

### Campos Importantes

| Campo | Tipo | Descrição | Uso |
|-------|------|-----------|-----|
| `premio_us` | number | Prêmio da opção em USD | ✅ Resultado principal |
| `resultado` | number | Resultado alternativo | ✅ Fallback |
| `cotacao_atual` | number | Preço spot do ativo (BTC/ETH) | ❌ NÃO usar como resultado |
| `preco_entrada` | number | Preço de entrada da opção | ℹ️ Referência |
| `abertura` | number | Preço do ativo na abertura | ℹ️ Referência |
| `strike` | number | Preço de exercício | ℹ️ Cálculos |
| `quantidade` | number | Quantidade de contratos | ℹ️ Multiplicador |

## 🐛 Debug e Troubleshooting

### Verificar Valores Suspeitos

Abra o console do navegador (F12) e procure por:

```
[modal-analise] ⚠️ Valor suspeito detectado: {
    id: 123,
    ativo: "BTC",
    tipo: "PUT",
    campo: "premio_us",
    valor: 0.13,
    premio_us: 0.13,
    resultado: undefined,
    cotacao_atual: 45000,
    sugestao: "Verificar se o campo correto está sendo usado"
}
```

### Possíveis Problemas

#### Problema 1: Valores muito baixos (< US$ 0,50)

**Causa:** Campo errado sendo usado como resultado

**Solução:**
```javascript
// ❌ ERRADO
const resultado = op.cotacao_atual / 100000;

// ✅ CORRETO
const resultado = op.premio_us || op.resultado;
```

#### Problema 2: ROI não calcula

**Causa:** Saldo não configurado no localStorage

**Solução:**
```javascript
// Para crypto
localStorage.setItem('cryptoConfig', JSON.stringify({
    saldoCrypto: 10000  // US$ 10,000
}));

// Para opções
localStorage.setItem('appConfig', JSON.stringify({
    saldoAcoes: 50000  // R$ 50,000
}));
```

#### Problema 3: Header não aparece

**Causa:** Scripts não carregados na ordem correta

**Solução:**
```html
<!-- Ordem correta -->
<script src="../js/core/crypto-filter-bar.js"></script>
<script src="../js/core/modal-header.js"></script>
<script src="../js/shared/modal-analise.js"></script>
```

## 🎨 Customização de Estilos

### Cores Padrão

```css
/* Lucro */
.text-success { color: #2dc653; }

/* Prejuízo */
.text-danger { color: #fa5252; }

/* Neutro/Info */
.text-info { color: #4d9de0; }

/* Alerta */
.text-warning { color: #f59f00; }

/* CALL */
.ma-badge-call { 
    background: rgba(45, 198, 83, 0.18);
    color: #2dc653;
    border: 1px solid rgba(45, 198, 83, 0.35);
}

/* PUT */
.ma-badge-put { 
    background: rgba(77, 157, 224, 0.18);
    color: #4d9de0;
    border: 1px solid rgba(77, 157, 224, 0.35);
}
```

### Personalizar Tooltips

```javascript
// Adicionar tooltip customizado
document.getElementById('maWinRate').setAttribute('title', 
    'Meu tooltip personalizado'
);
```

## 📈 Próximas Melhorias

### Planejadas

- [ ] Exportação para CSV/Excel
- [ ] Gráficos de evolução temporal
- [ ] Comparação entre períodos
- [ ] Filtros por ativo específico
- [ ] Filtros por corretora
- [ ] Análise de correlação entre ativos
- [ ] Alertas de performance
- [ ] Metas e objetivos

### Em Consideração

- [ ] Integração com IA para insights
- [ ] Previsões baseadas em histórico
- [ ] Benchmarking com mercado
- [ ] Relatórios automáticos por email
- [ ] Dashboard mobile responsivo

## 📝 Changelog

### v1.6.0 (2024-05-05)
- ✨ Adicionado CryptoModalHeader padronizado
- ✨ Validação automática de valores suspeitos
- ✨ Tooltips explicativos em todas as métricas
- ✨ Ícones visuais para melhor UX
- 🐛 Corrigido cálculo de ROI para crypto
- 🐛 Melhorado mapeamento de campos crypto
- 📚 Documentação completa adicionada

### v1.5.0 (anterior)
- Versão base com funcionalidades principais

## 🤝 Contribuindo

Para reportar bugs ou sugerir melhorias:

1. Verifique o console para logs de debug
2. Documente o comportamento esperado vs atual
3. Inclua dados de exemplo (sem informações sensíveis)
4. Descreva os passos para reproduzir

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte a documentação em `ANALISE_PERFORMANCE_EXPLICACAO.md`
2. Verifique os logs do console (F12)
3. Revise os exemplos de integração acima
4. Entre em contato com a equipe de desenvolvimento
