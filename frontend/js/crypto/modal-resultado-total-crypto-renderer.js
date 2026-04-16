/** modal-resultado-total-crypto-renderer.js v2.0.0
 *  Renderizador de UI para o novo design do Modal Resultado Total Crypto
 *  Implementa o layout "Atual + Melhorado" do Claude8.html
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════
    // DATA & STATE
    // ═══════════════════════════════════════════════════════════════════════

    const mockData = {
        cycles: [
            {
                id: '0804', date: '08/04/2026', dow: 'Terça', dot: 'orange',
                exercidas: 2, ops: 4, total: 55.58, rec: 72, desconto: -4.84,
                status: 'fechado', venc: null,
                operations: [
                    { asset: 'BTC', type: 'CALL', strike: 71500, status: 'fechada', exercised: false, premium: 14.26, pct: 0.020 },
                    { asset: 'ETH', type: 'CALL', strike: 2225, status: 'fechada', exercised: false, premium: 13.53, pct: 0.608 },
                    { asset: 'BTC', type: 'PUT', strike: 71500, status: 'fechada', exercised: true, premium: 14.26, pct: 0.020 },
                    { asset: 'ETH', type: 'PUT', strike: 2225, status: 'fechada', exercised: true, premium: 13.53, pct: 0.608 },
                ]
            },
            {
                id: '1304', date: '13/04/2026', dow: 'Segunda', dot: 'orange',
                exercidas: 2, ops: 2, total: 48.55, rec: 58, desconto: -2.21,
                status: 'fechado', venc: null,
                operations: [
                    { asset: 'BTC', type: 'CALL', strike: 72000, status: 'exercida', exercised: true, premium: 26.18, pct: 0.036 },
                    { asset: 'ETH', type: 'CALL', strike: 2225, status: 'exercida', exercised: true, premium: 22.37, pct: 1.005 },
                ]
            },
            {
                id: '1504', date: '15/04/2026', dow: 'Quarta', dot: 'green',
                exercidas: 0, ops: 2, total: 0, rec: 0, desconto: 0,
                status: 'aberto', venc: '22/04',
                operations: [
                    { asset: 'BTC', type: 'CALL', strike: 73500, status: 'aberta', exercised: false, premium: 0, pct: 0 },
                    { asset: 'ETH', type: 'CALL', strike: 2275, status: 'aberta', exercised: false, premium: 0, pct: 0 },
                ]
            }
        ],
        analysis: {
            BTC: { putC: 71500, callV: 71500, varAtivo: 0, premCiclo: 107.69, cm: 71392.31, desc: -4.84 },
            ETH: { putC: 2225, callV: 2225, varAtivo: 0, premCiclo: 107.69, cm: 2117.31, desc: -4.84 }
        },
        performance: { total: 104.13, roi: 1.67, ops: 8, ex: 4, wr: 75, btcP: 40.44, ethP: 27.06, cap: 6234.37 }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // FORMATTERS
    // ═══════════════════════════════════════════════════════════════════════

    const fmt = {
        currency: (n) => 'US$ ' + Math.abs(n).toFixed(2).replace('.', ','),
        currencyK: (n) => n >= 1000 ? 'US$ ' + (n / 1000).toFixed(1) + 'K' : 'US$ ' + n.toFixed(2).replace('.', ','),
        percent: (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%',
        signed: (n) => (n >= 0 ? '+' : '-') + ' US$ ' + Math.abs(n).toFixed(2).replace('.', ','),
        assetColor: (asset) => asset === 'BTC' ? 'var(--btc)' : 'var(--eth)',
        assetClass: (asset) => asset === 'BTC' ? 'btc' : 'eth',
        assetIcon: (asset) => asset === 'BTC' ? '₿' : 'Ξ'
    };

    // ═══════════════════════════════════════════════════════════════════════
    // RENDER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function renderOperationRow(op, asset) {
        const strikeDisplay = asset === 'BTC' ? '$' + (op.strike / 1000).toFixed(1) + 'K' : '$' + op.strike.toLocaleString('pt-BR');
        const statusClass = op.status === 'fechada' ? 'st-fe' : op.status === 'aberta' ? 'st-ab' : 'st-ex';
        const statusText = op.status === 'fechada' ? 'Fechada' : op.status === 'aberta' ? 'Aberta' : 'Exercida';
        const isPremium = op.premium > 0;
        const typeClass = op.type.toLowerCase();
            const colorStyle = isPremium ? 'var(--grn)' : 'var(--tx2)';
            const exercisedBadge = op.exercised ? '<span class="or-t exbdg">exercida</span>' : '';

        return `
            <div class="op-row${op.exercised ? ' ex' : ''}">
                <span class="or-a ${fmt.assetClass(asset)}">${asset}</span>
                <span class="or-t ${typeClass}">${op.type}</span>
                    ${exercisedBadge}
                <span class="or-str">${op.type} Strike ${strikeDisplay}</span>
                <span class="or-st ${statusClass}">${statusText}</span>
                    <span class="or-val" style="color: ${colorStyle}">${isPremium ? '+' + fmt.currency(op.premium) : '—'}</span>
                <span class="or-pct">${op.pct ? op.pct.toFixed(3) + '%' : ''}</span>
            </div>
        `;
    }

    function renderCycleBlock(cycle, isOpen = false) {
        const dotColor = cycle.dot === 'green' ? 'var(--grn)' : cycle.dot === 'orange' ? 'var(--org)' : 'var(--tx3)';
        const hasData = cycle.status === 'fechado' && cycle.total > 0;
        const totalDisplay = hasData ? `<span class="pos">+${fmt.currency(cycle.total)}</span>` : `<span style="color: var(--tx2)">+US$ —</span>`;
            const dotShadow = cycle.dot === 'green' ? '; box-shadow: 0 0 5px var(--grn)' : '';
            const dotStyle = 'background: ' + dotColor + dotShadow;

        let opsHtml = '';
        if (cycle.operations && cycle.operations.length > 0) {
            cycle.operations.forEach((op, idx) => {
                    const marginBottom = idx === cycle.operations.length - 1 ? '0' : '10px';
                opsHtml += `
                        <div style="margin-bottom: ${marginBottom}">
                        ${renderOperationRow(op, op.asset)}
                    </div>
                `;
            });
        }

        return `
            <div class="ciclo">
                <div class="ciclo-head${isOpen ? ' open' : ''}" data-cycle-head>
                        <div><span class="ch-dot" style="${dotStyle}"></span></div>
                    <div>
                        <div class="ch-date">${cycle.date}</div>
                        <div class="ch-dow">${cycle.dow}</div>
                    </div>
                    <span class="badge ${cycle.exercidas > 0 ? 'ex' : 'ab'}">Exercidas ${cycle.exercidas}</span>
                    <span class="badge ops">${cycle.ops} ops</span>
                    <div class="ch-right">
                        <span class="ch-total">${totalDisplay}</span>
                        <span class="ch-arr">▼</span>
                    </div>
                </div>
                <div class="ciclo-body${isOpen ? ' open' : ''}">
                    <div style="padding: 10px 16px">
                        ${opsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    function renderRightPanel() {
        const perf = mockData.performance;
        const totalOps = perf.total;

        return `
            <div class="rp">
                <div class="rp-card">
                    <div class="rp-head open" data-rp-head>
                        <span class="rp-head-title">📊 Resumo do Período</span>
                        <span class="rp-arr">▼</span>
                    </div>
                    <div class="kpi-grid" id="rp-kpi">
                        <div class="kpi-i">
                            <div class="kpi-v pos">+${fmt.currency(perf.total)}</div>
                            <div class="kpi-l">Resultado Total</div>
                        </div>
                        <div class="kpi-i">
                            <div class="kpi-v" style="color: var(--cya)">${perf.roi.toFixed(2)}%</div>
                            <div class="kpi-l">ROI</div>
                        </div>
                        <div class="kpi-i">
                            <div class="kpi-v">${perf.ops}</div>
                            <div class="kpi-l">Total de Ops</div>
                        </div>
                        <div class="kpi-i">
                            <div class="kpi-v" style="color: var(--grn)">${perf.wr}%</div>
                            <div class="kpi-l">Win Rate</div>
                        </div>
                    </div>
                    <div style="padding: 12px 13px; border-bottom: 1px solid var(--bdr)">
                        <div style="font-size: 0.6rem; color: var(--tx2); text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 8px">Contribuição por Ativo</div>
                        <div class="rp-row">
                            <span class="rp-row-k"><span class="dot" style="background: var(--btc)"></span>BTC</span>
                            <span class="rp-row-v pos">+${fmt.currency(perf.btcP)}</span>
                        </div>
                        <div class="rp-row">
                            <span class="rp-row-k"><span class="dot" style="background: var(--eth)"></span>ETH</span>
                            <span class="rp-row-v pos">+${fmt.currency(perf.ethP)}</span>
                        </div>
                    </div>
                </div>

                <div class="rp-card">
                    <div class="rp-head open" data-rp-head>
                        <span class="rp-head-title">₿ Análise BTC</span>
                        <span class="rp-arr">▼</span>
                    </div>
                    <div class="rp-body" id="rp-btc">
                        <div class="rp-row">
                            <span class="rp-row-k">Custo Médio</span>
                            <span class="rp-row-v">$${mockData.analysis.BTC.cm.toLocaleString('pt-BR')}</span>
                        </div>
                        <div class="rp-row">
                            <span class="rp-row-k">Strike PUT</span>
                            <span class="rp-row-v">$${mockData.analysis.BTC.putC.toLocaleString('pt-BR')}</span>
                        </div>
                        <div class="rp-row">
                            <span class="rp-row-k">Strike CALL</span>
                            <span class="rp-row-v">$${mockData.analysis.BTC.callV.toLocaleString('pt-BR')}</span>
                        </div>
                    </div>
                </div>

                <div class="rp-card">
                    <div class="rp-head open" data-rp-head>
                        <span class="rp-head-title">Ξ Análise ETH</span>
                        <span class="rp-arr">▼</span>
                    </div>
                    <div class="rp-body" id="rp-eth">
                        <div class="rp-row">
                            <span class="rp-row-k">Custo Médio</span>
                            <span class="rp-row-v">$${mockData.analysis.ETH.cm.toLocaleString('pt-BR')}</span>
                        </div>
                        <div class="rp-row">
                            <span class="rp-row-k">Strike PUT</span>
                            <span class="rp-row-v">$${mockData.analysis.ETH.putC.toLocaleString('pt-BR')}</span>
                        </div>
                        <div class="rp-row">
                            <span class="rp-row-k">Strike CALL</span>
                            <span class="rp-row-v">$${mockData.analysis.ETH.callV.toLocaleString('pt-BR')}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderModal() {
        const cyclesHtml = mockData.cycles.map((c, i) => renderCycleBlock(c, i === 0)).join('');
        const summaryHtml = renderRightPanel();

        const container = document.getElementById('rtCyclesContainer');
        const summaryPanel = document.getElementById('rtSummaryPanel');

        if (container) container.innerHTML = cyclesHtml;
        if (summaryPanel) summaryPanel.innerHTML = summaryHtml;

        attachEventListeners();
    }

    function attachEventListeners() {
        // Ciclo heads
        const cycloHeads = document.querySelectorAll('#modalResultadoTotalCrypto [data-cycle-head]');
        cycloHeads.forEach(head => {
            head.addEventListener('click', function() {
                this.classList.toggle('open');
                this.nextElementSibling.classList.toggle('open');
            });
        });

        // Right panel heads
        const rpHeads = document.querySelectorAll('#modalResultadoTotalCrypto [data-rp-head]');
        rpHeads.forEach(head => {
            head.addEventListener('click', function() {
                this.classList.toggle('open');
                this.nextElementSibling.classList.toggle('hide');
            });
        });

        // Filtros
        const filterChips = document.querySelectorAll('#modalResultadoTotalCrypto .chip[data-filter]');
        filterChips.forEach(chip => {
            chip.addEventListener('click', function() {
                const filter = this.getAttribute('data-filter');
                const value = this.getAttribute('data-value');
                    const siblings = document.querySelectorAll('#modalResultadoTotalCrypto .chip[data-filter="' + filter + '"]');
                siblings.forEach(s => s.classList.remove('on'));
                this.classList.add('on');
                    console.log('Filtro aplicado: ' + filter + ' = ' + value);
            });
        });

        // Refresh button
        const refreshBtn = document.getElementById('rtCryptoRefreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('Modal atualizada');
                renderModal();
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════

    window.ModalResultadoTotalCryptoRenderer = {
        render: renderModal,
        mockData: mockData
    };

    // Auto-init quando DOM estiver pronto
    document.addEventListener('DOMContentLoaded', function() {
        const modal = document.getElementById('modalResultadoTotalCrypto');
        if (modal) {
            renderModal();
        }
    });

})();
