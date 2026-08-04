# 🔍 Localização dos Links Clicáveis do Preço Médio (PM)

## 📍 IMAGEM 1 - Termômetro (Visão-Geral Crypto)

### ✅ Link 1: PM na Linha "Diferença / PoP / PM" (PAINEL INFERIOR)

```
┌─────────────────────────────────────────────────────────────┐
│ STRIKE VS COTAÇÃO                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Termômetro SVG            Círculo Status (SEGURA -3.89%)  │
│                                                             │
│  Strike: US$ 1,950.00                                       │
│  Cotação: US$ 1,872.29                                      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Diferença: -77.71    PoP: 66%    PM: US$ 1,796.37 ← 🔗 CLICÁVEL
└─────────────────────────────────────────────────────────────┘
```

**Localização no código:**
- Arquivo: `frontend/js/crypto/visao-geral-crypto.js`
- Linhas: **519-525**
- Elemento HTML: `<span class="crypto-pm-link">` renderizado via `CryptoUtils.renderPmLink(par || 'BTC', pm)`
- Container: `#vgThermoDiff` (painel de diferenças)

**O que acontece ao clicar:**
1. Abre modal **"Raio-X do Preço Médio"**
2. Mostra: entrada, prêmios acumulados, PM atual, evolução em gráfico
3. Para o ativo correto (BTC ou ETH)

**Visual do link:**
- Cor: Dourada (#f2a900)
- Sublinhado pontilhado
- Cursor: pointer
- Hover: muda para sublinhado sólido + opacidade 0.85

---

## 📍 IMAGEM 2 - Modal de Análise (Detalhes Operação)

### ✅ Link 2: PM no Card "PREÇO MÉDIO ETH" (SEÇÃO INFERIOR)

```
┌─────────────────────────────────────────────────────────────┐
│ ≡ PREÇO MÉDIO ETH                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PREÇO MÉDIO                    RISCO DA OPERAÇÃO           │
│  ┌──────────────────────┐     ┌─────────────────────────┐  │
│  │ US$ 1,796.37 ← 🔗 CLICÁVEL │ • Cotação     $1,871.28│  │
│  │                      │     │ • Strike      $1,950.00│  │
│  │ • Entrada (PUT)      │     │ • Distância     +4.21%│  │
│  │   $1,925.00          │     │ • Operação OTM       │  │
│  │ • Prêmios            │     │   Baixa prob. exercício│  │
│  │   $1,871.16          │     │                      │  │
│  │                      │     │                      │  │
│  └──────────────────────┘     └─────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Localização no código:**
- Arquivo: `frontend/js/crypto/modal-preco-medio-crypto.js`
- Linhas: **112-127**
- Elemento HTML: `<div class="pm-kpi" id="pmKpiPrecoMedio">` com `<span class="crypto-pm-link">`
- Container: Modal com id `#modalPrecoMedioCrypto`

**O que acontece ao clicar:**
1. Modal "Preco Medio Crypto" **fecha automaticamente**
2. Modal **"Raio-X do Preço Médio"** abre
3. Mostra: entrada, prêmios acumulados, PM atual, evolução em gráfico
4. Para o ativo selecionado (ETH)

**Visual do link:**
- Cor: Azul (#4da6ff) para ETH
- Sublinhado pontilhado
- Cursor: pointer
- Hover: muda para sublinhado sólido + opacidade 0.85
- Card completo também é clicável como fallback

---

## 🎯 RESUMO DOS LINKS

| Localização | Imagem | Arquivo | Linha | Classe CSS | Função |
|---|---|---|---|---|---|
| Painel "Diferença / PoP / PM" | 1 | visao-geral-crypto.js | 519-525 | .crypto-pm-link | renderPmLink() |
| Card "PREÇO MÉDIO" | 2 | modal-preco-medio-crypto.js | 112-127 | .crypto-pm-link | renderPmLink() |

---

## 🔗 COMO FUNCIONAM OS LINKS

### Renderização:
```javascript
// Em crypto-utils.js:
function renderPmLink(ativo, pmValue, opts) {
    return '<span class="crypto-pm-link" ' +
        'onclick="if (window.ModalPrecoMedioAtivo && typeof window.ModalPrecoMedioAtivo.openModal === \'function\') { event.preventDefault(); event.stopPropagation(); ModalPrecoMedioAtivo.openModal(\'' + par + '\'); }" ' +
        'title="Clique para ver detalhes do cálculo do preço médio e evolução de prêmios">' +
        formatted + '</span>';
}
```

### Click Handler:
- **onclick**: `ModalPrecoMedioAtivo.openModal('BTC' ou 'ETH')`
- **Fallback**: Card também tem `onclick` se o link não for clicado
- **Keyboard**: Enter/Espaço também funcionam (role="button" + onkeydown)

### Modal que Abre:
- **Arquivo**: `modal-preco-medio-ativo.js`
- **Container HTML**: `modal-preco-medio-ativo.html`
- **Overlay**: `#pmOverlay`
- **Conteúdo**: `#pmBody` com detalhes do PM

---

## 🎨 CSS DO LINK

```css
.crypto-pm-link {
    cursor: pointer;
    font-weight: 700;
    text-decoration: underline dotted;
    text-underline-offset: 4px;
    transition: all 0.15s ease-out;
    display: inline-block;
    padding: 2px 4px;
    border-radius: 4px;
    user-select: none;
}

.crypto-pm-link:hover {
    opacity: 0.85;
    text-decoration: underline solid !important;
    transform: scale(1.04);
    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}
```

---

## ✅ CHECKLIST DE TESTE

- [ ] **Imagem 1**: Clicar em "PM: US$ 1,796.37" na linha Diferença/PoP/PM
- [ ] **Imagem 2**: Clicar em "US$ 1,796.37" no card PREÇO MÉDIO
- [ ] Modal "Raio-X do Preço Médio" abre corretamente
- [ ] Dados exibidos correspondem ao ativo (BTC/ETH)
- [ ] Hover funciona: cor muda, underline fica sólido
- [ ] Tema claro/escuro funciona
- [ ] Teclado funciona: Tab + Enter/Espaço

---

## 📝 MUDANÇAS REALIZADAS

**Removido:**
- PM abaixo de "CALL vendida" no selo (imagem 1)
- Linha de renderização do PM no `buildSeal()` (linhas 580-586)

**Mantido:**
- Link 1: PM no painel Diferença/PoP/PM ✅ (principal)
- Link 2: PM no card PREÇO MÉDIO do modal ✅ (secundário)

