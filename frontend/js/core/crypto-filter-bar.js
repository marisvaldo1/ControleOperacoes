/**
 * CryptoFilterBar - shared header/filter for crypto modals.
 */
;(function (global) {
    'use strict';

    const SHARED_CSS = `
.cfb-hdr {
  background: #1a2436;
  border-bottom: 1px solid #263347;
  padding: .50rem 1rem;
  display: flex;
  align-items: center;
  gap: .6rem;
  flex-shrink: 0;
}
.cfb-icon { color: #6b82a0; font-size: .95rem; }
.cfb-title {
  font-family: 'Inter', sans-serif;
  font-size: .90rem;
  font-weight: 600;
  color: #e8f0f8;
  flex: 1;
  display: flex;
  align-items: center;
  gap: .4rem;
}
.cfb-live {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #3dd68c;
  flex-shrink: 0;
  animation: cfbBlink 2.5s infinite;
}
@keyframes cfbBlink { 0%,100%{opacity:1} 60%{opacity:.3} }
.cfb-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: .66rem;
  color: #6b82a0;
  white-space: nowrap;
}
.cfb-act-btn {
  padding: .22rem .65rem;
  border-radius: 5px;
  font-size: .70rem;
  font-weight: 600;
  background: rgba(66,153,225,.15);
  color: #63b3ed;
  border: 1px solid rgba(66,153,225,.30);
  cursor: pointer;
  white-space: nowrap;
  font-family: 'Inter', sans-serif;
  display: flex;
  align-items: center;
  gap: .3rem;
  transition: background .15s, border-color .15s;
}
.cfb-act-btn:hover { background: rgba(66,153,225,.25); border-color: rgba(66,153,225,.5); }
.cfb-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #334560;
  background: #1e2a3d;
  color: #6b82a0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .15s;
  flex-shrink: 0;
}
.cfb-btn.ref { background: #1e2a3d; color: #4db8d4; }
.cfb-btn.ref:hover { border-color: #4db8d4; }
.cfb-btn.ref.spin svg, .cfb-btn.ref.spinning svg { animation: cfbSpin .8s linear infinite; }
@keyframes cfbSpin { to { transform: rotate(360deg); } }
.cfb-btn.cls:hover { border-color: #e85555; color: #e85555; background: #2d1a1a; }

.cfb-bar {
  background: #1a2436;
  border-bottom: 1px solid #263347;
  padding: .30rem .8rem;
  display: flex;
  align-items: center;
  gap: .22rem;
  flex-wrap: wrap;
  overflow-x: auto;
  scrollbar-width: none;
}
.cfb-bar::-webkit-scrollbar { display: none; }
.cfb-bar-lbl {
  font-family: 'Inter', sans-serif;
  font-size: .62rem;
  font-weight: 600;
  color: #6b82a0;
  letter-spacing: .04em;
  text-transform: uppercase;
  white-space: nowrap;
  padding: 0 .2rem;
}
.cfb-sep { width: 1px; height: 16px; background: #263347; margin: 0 .25rem; flex-shrink: 0; }
.cfb-pill {
  padding: .22rem .55rem;
  border-radius: 20px;
  border: 1px solid #263347;
  background: transparent;
  color: #6b82a0;
  font-family: 'Inter', sans-serif;
  font-size: .72rem;
  font-weight: 500;
  cursor: pointer;
  transition: all .15s;
  white-space: nowrap;
}
.cfb-pill:hover { border-color: #334560; color: #e8f0f8; }
.cfb-pill.p-on { background: rgba(77,184,212,.15); border-color: rgba(77,184,212,.4); color: #4db8d4; }
.cfb-pill.s-ab  { background: rgba(61,214,140,.12); border-color: rgba(61,214,140,.35); color: #3dd68c; }
.cfb-pill.s-fe  { background: rgba(107,130,160,.12); border-color: rgba(107,130,160,.35); color: #a0b0c8; }
.cfb-pill.s-ex  { background: rgba(232,168,48,.12); border-color: rgba(232,168,48,.35); color: #e8a830; }
.cfb-pill.s-nex { background: rgba(232,85,85,.10); border-color: rgba(232,85,85,.30); color: #e85555; }
.cfb-pill.t-call { background: rgba(77,184,212,.12); border-color: rgba(77,184,212,.35); color: #4db8d4; }
.cfb-pill.t-put  { background: rgba(155,114,212,.12); border-color: rgba(155,114,212,.35); color: #9b72d4; }
.cfb-pill.a-on   { background: rgba(232,168,48,.15); border-color: rgba(232,168,48,.45); color: #e8a830; }

.cfb-sel {
  background: #1e2a3d;
  border: 1px solid #263347;
  border-radius: 5px;
  color: #6b82a0;
  font-family: 'JetBrains Mono', monospace;
  font-size: .67rem;
  padding: .22rem .5rem;
  cursor: pointer;
  outline: none;
  min-width: 100px;
  transition: border-color .15s, color .15s;
}
.cfb-sel:hover, .cfb-sel:focus { border-color: #334560; color: #e8f0f8; }

.cfb-totals {
  background: #141b28;
  border-bottom: 1px solid #263347;
  padding: .28rem .9rem;
  display: flex;
  align-items: center;
  gap: .35rem;
  flex-wrap: wrap;
}
.cfb-tag {
  padding: .18rem .52rem;
  border-radius: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: .68rem;
  font-weight: 600;
  white-space: nowrap;
}
.cfb-tag-b { background: #162430; color: #4db8d4; border: 1px solid #254050; }
.cfb-tag-g { background: #1a3028; color: #3dd68c; border: 1px solid #2a5040; }
.cfb-tag-r { background: #1e1e28; color: #6b82a0; border: 1px solid #263347; }
.cfb-tag-a { background: #2d2010; color: #e8a830; border: 1px solid #4a3820; }
`;

    let cssInjected = false;
    function injectCSS() {
        if (cssInjected || document.getElementById('cfb-shared-css')) return;
        const style = document.createElement('style');
        style.id = 'cfb-shared-css';
        style.textContent = SHARED_CSS;
        document.head.appendChild(style);
        cssInjected = true;
    }

    function createState(overrides) {
        return Object.assign({
            period: '7d',
            status: null,
            tipo: null,
            asset: null,
            corretora: null,
            dateFrom: null,
            dateTo: null,
        }, overrides || {});
    }

    function getAsset(ativo) {
        const a = (ativo || '').toUpperCase();
        return a.split('/')[0].replace(/USDT$/, '').trim() || '?';
    }

    function inPeriod(op, period, state) {
        if (!period || period === 'all') return true;
        const raw = op.data_operacao || op.criado_em || '';
        if (!raw) return true;
        const dt = new Date(raw.split('T')[0] + 'T00:00:00');
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (period === 'today') return dt >= now;
        if (period === '7d')  { const t = new Date(now); t.setDate(t.getDate() - 7); return dt >= t; }
        if (period === '15d') { const t = new Date(now); t.setDate(t.getDate() - 15); return dt >= t; }
        if (period === '30d') { const t = new Date(now); t.setDate(t.getDate() - 30); return dt >= t; }
        if (period === '60d') { const t = new Date(now); t.setDate(t.getDate() - 60); return dt >= t; }
        if (period === '90d') { const t = new Date(now); t.setDate(t.getDate() - 90); return dt >= t; }
        if (period === 'mes') { const t = new Date(now.getFullYear(), now.getMonth(), 1); return dt >= t; }
        if (period === 'ano') { const t = new Date(now.getFullYear(), 0, 1); return dt >= t; }
        if (period === 'year') { const t = new Date(now.getFullYear(), 0, 1); return dt >= t; }
        if (period === 'custom') {
            const s = state && state.dateFrom ? new Date(state.dateFrom + 'T00:00:00') : null;
            const e = state && state.dateTo   ? new Date(state.dateTo   + 'T23:59:59') : null;
            if (!s && !e) return true;
            if (s && dt < s) return false;
            if (e && dt > e) return false;
            return true;
        }
        return true;
    }

    function filter(ops, state) {
        if (!Array.isArray(ops)) return [];
        return ops.filter(function (op) {
            if (!inPeriod(op, state.period, state)) return false;

            if (state.corretora) {
                const c = (op.corretora || 'BINANCE').toUpperCase();
                if (c !== state.corretora.toUpperCase()) return false;
            }

            if (state.status) {
                const s = (op.status || '').toLowerCase();
                if (state.status === 'exercida') {
                    const isEx = global.CryptoExerciseStatus
                        ? global.CryptoExerciseStatus.isActuallyExercised(op)
                        : (s === 'fechada' && (op.exercicio_status || '').toUpperCase() === 'SIM');
                    if (!isEx) return false;
                } else if (state.status === 'nao_exercida') {
                    const isEx = global.CryptoExerciseStatus
                        ? global.CryptoExerciseStatus.isActuallyExercised(op)
                        : (s === 'fechada' && (op.exercicio_status || '').toUpperCase() === 'SIM');
                    if (s === 'aberta') return false;
                    if (isEx) return false;
                } else if (s !== state.status.toLowerCase()) {
                    return false;
                }
            }

            if (state.tipo && (op.tipo || '').toUpperCase() !== state.tipo.toUpperCase()) return false;
            if (state.asset && getAsset(op.ativo) !== state.asset) return false;
            return true;
        });
    }

    const SVG_REFRESH = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M3 12a9 9 0 0 1 15.74-6.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.74 6.74L3 16"/><path d="M3 21v-5h5"/></svg>';
    const SVG_CLOSE = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    const SVG_ACTION = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>';
    const SVG_CALENDAR_SMALL = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:3px;vertical-align:middle"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

    function renderHeader(config) {
        injectCSS();
        const cfg = config || {};
        const idTime = cfg.id_time || 'cfbHdrTime';
        const idRefresh = cfg.id_refresh || 'cfbHdrRefresh';
        const live = cfg.live !== false;

        const actionBtn = cfg.actionLabel
            ? `<button class="cfb-act-btn" id="${cfg.id_action || 'cfbActBtn'}" type="button">${SVG_ACTION}${cfg.actionLabel}</button>`
            : '';

        const closeAttr = cfg.modal_id
            ? 'data-bs-dismiss="modal" aria-label="Fechar"'
            : 'type="button"';

        return `<div class="cfb-hdr">
  <span class="cfb-icon">${cfg.icon || '⚡'}</span>
  <span class="cfb-title">${cfg.title || 'Crypto'}${live ? '<span class="cfb-live"></span>' : ''}</span>
  <span class="cfb-time" id="${idTime}">-</span>
  ${actionBtn}
  <button class="cfb-btn ref" id="${idRefresh}" title="Atualizar">${SVG_REFRESH}</button>
  <button class="cfb-btn cls" ${closeAttr}>${SVG_CLOSE}</button>
</div>`;
    }

    function renderFilterBar(config) {
        injectCSS();
        const cfg = config || {};
        const state = cfg.state || createState();
        const openAs = Array.isArray(cfg.openAssets) ? cfg.openAssets : [];
        const allAs = Array.isArray(cfg.allAssets) ? cfg.allAssets : [];
        const barId = cfg.id || 'cfbFilterBar';

        const periods = [
            { v: 'all', l: 'Todos' },
            { v: 'today', l: 'Hoje' },
            { v: '7d', l: '7d' },
            { v: '30d', l: '30d' },
        ];

        const statuses = [
            { v: 'aberta', l: 'Abertas', cls: 's-ab' },
            { v: 'fechada', l: 'Fechadas', cls: 's-fe' },
            { v: 'exercida', l: 'Exercidas', cls: 's-ex' },
            { v: 'nao_exercida', l: 'Não Exercidas', cls: 's-nex' },
        ];

        let html = `<div class="cfb-bar" id="${barId}">`;

        if (cfg.showPeriods !== false) {
            periods.forEach(function (p) {
                html += `<button class="cfb-pill${state.period === p.v ? ' p-on' : ''}" data-cfb-p="${p.v}">${p.l}</button>`;
            });
            var customBtnLabel = 'Período';
            if (state.period === 'custom' && (state.dateFrom || state.dateTo)) {
                var fmt = function(d) { return d ? d.split('-').reverse().join('/') : ''; };
                customBtnLabel = (state.dateFrom ? fmt(state.dateFrom) : '') + (state.dateTo ? ' → ' + fmt(state.dateTo) : '');
            }
            html += `<button class="cfb-pill${state.period === 'custom' ? ' p-on' : ''}" data-cfb-p="custom">${SVG_CALENDAR_SMALL}${customBtnLabel}</button>`;
            html += '<div class="cfb-sep"></div>';
        }

        if (cfg.showStatus !== false) {
            html += '<span class="cfb-bar-lbl">STATUS:</span>';
            statuses.forEach(function (s) {
                const selected = state.status === s.v;
                html += `<button class="cfb-pill${selected ? ' ' + s.cls : ''}" data-cfb-s="${s.v}">${s.l}</button>`;
            });
            html += '<div class="cfb-sep"></div>';
        }

        if (cfg.showTipo !== false) {
            html += '<span class="cfb-bar-lbl">TIPO:</span>';
            html += `<button class="cfb-pill${state.tipo === 'CALL' ? ' t-call' : ''}" data-cfb-t="CALL">CALL</button>`;
            html += `<button class="cfb-pill${state.tipo === 'PUT' ? ' t-put' : ''}" data-cfb-t="PUT">PUT</button>`;
            html += '<div class="cfb-sep"></div>';
        }

        if (cfg.showMoeda !== false) {
            html += '<span class="cfb-bar-lbl">MOEDA:</span>';
            html += '<select class="cfb-sel" data-cfb-a-sel>';
            html += `<option value=""${!state.asset ? ' selected' : ''}>Todas</option>`;
            allAs.forEach(function (a) {
                html += `<option value="${a}"${state.asset === a ? ' selected' : ''}>${a}</option>`;
            });
            html += '</select>';
            html += '<div class="cfb-sep"></div>';
        }

        if (cfg.showCorretora !== false) {
            html += '<span class="cfb-bar-lbl">CORRETORA:</span>';
            html += '<select class="cfb-sel" data-cfb-c>';
            html += `<option value=""${!state.corretora ? ' selected' : ''}>Todas</option>`;
            html += `<option value="BINANCE"${state.corretora === 'BINANCE' ? ' selected' : ''}>Binance</option>`;
            html += `<option value="BYBIT"${state.corretora === 'BYBIT' ? ' selected' : ''}>Bybit</option>`;
            html += '</select>';
        }

        html += '</div>';
        return html;
    }

    function renderTotals(ops, id) {
        injectCSS();
        const list = Array.isArray(ops) ? ops : [];
        const fmtUsd = global.CryptoExerciseStatus && global.CryptoExerciseStatus.formatUsd
            ? global.CryptoExerciseStatus.formatUsd
            : function (v) { return 'US$ ' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

        const total = list.length;
        const abertas = list.filter(function (o) { return (o.status || '').toUpperCase() === 'ABERTA'; }).length;
        const fechadas = list.filter(function (o) { return (o.status || '').toUpperCase() !== 'ABERTA'; }).length;
        const premio = list.reduce(function (acc, o) { return acc + (parseFloat(o.premio_us) || 0); }, 0);

        return `<div class="cfb-totals"${id ? ` id="${id}"` : ''}>
  <span class="cfb-tag cfb-tag-b">TOTAL ${total}</span>
  <span class="cfb-tag cfb-tag-g">ABERTAS ${abertas}</span>
  <span class="cfb-tag cfb-tag-r">FECHADAS ${fechadas}</span>
  <span class="cfb-tag cfb-tag-a">PRÊMIO ${fmtUsd(premio)}</span>
</div>`;
    }

    function _openCustomPeriodSwal(state, barEl, emit) {
        if (typeof window.Swal === 'undefined') {
            console.warn('[CryptoFilterBar] SweetAlert2 não carregado');
            return;
        }
        var fmtInput = function(d) { return d || ''; };
        window.Swal.fire({
            title: 'Defina o período',
            icon: 'warning',
            iconColor: '#e8a830',
            showCancelButton: true,
            confirmButtonText: 'Aplicar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true,
            html: '<div style="text-align:left;margin-top:.5rem;">' +
                    '<label style="display:block;font-size:.78rem;color:#a0b0c8;margin-bottom:.3rem;">Data início</label>' +
                    '<input id="cfb-swal-from" type="date" value="' + fmtInput(state.dateFrom) + '" ' +
                    'style="width:100%;background:#1e2a3d;border:1px solid #334560;border-radius:6px;' +
                    'color:#e8f0f8;padding:.4rem .7rem;font-size:.82rem;font-family:Inter,sans-serif;outline:none;box-sizing:border-box;">' +
                  '</div>' +
                  '<div style="text-align:left;margin-top:.75rem;">' +
                    '<label style="display:block;font-size:.78rem;color:#a0b0c8;margin-bottom:.3rem;">Data Fim</label>' +
                    '<input id="cfb-swal-to" type="date" value="' + fmtInput(state.dateTo) + '" ' +
                    'style="width:100%;background:#1e2a3d;border:1px solid #334560;border-radius:6px;' +
                    'color:#e8f0f8;padding:.4rem .7rem;font-size:.82rem;font-family:Inter,sans-serif;outline:none;box-sizing:border-box;">' +
                  '</div>',
            preConfirm: function() {
                var from = document.getElementById('cfb-swal-from').value || null;
                var to   = document.getElementById('cfb-swal-to').value   || null;
                if (from && to && from > to) {
                    window.Swal.showValidationMessage('Data início deve ser anterior à Data Fim.');
                    return false;
                }
                return { from: from, to: to };
            }
        }).then(function(result) {
            if (!result.isConfirmed) return;
            state.period   = 'custom';
            state.dateFrom = result.value.from;
            state.dateTo   = result.value.to;
            barEl.querySelectorAll('[data-cfb-p]').forEach(function(b) { b.classList.remove('p-on'); });
            var customBtn = barEl.querySelector('[data-cfb-p="custom"]');
            if (customBtn) {
                customBtn.classList.add('p-on');
                var fmt = function(d) { return d ? d.split('-').reverse().join('/') : ''; };
                var lbl = (state.dateFrom || state.dateTo)
                    ? (state.dateFrom ? fmt(state.dateFrom) : '') + (state.dateTo ? ' → ' + fmt(state.dateTo) : '')
                    : 'Período';
                customBtn.innerHTML = SVG_CALENDAR_SMALL + lbl;
            }
            emit();
        });
    }

    function bind(barEl, state, onChange) {
        const el = typeof barEl === 'string' ? document.querySelector(barEl) : barEl;
        if (!el) return;

        const emit = function () {
            if (typeof onChange === 'function') onChange(state);
        };

        el.addEventListener('click', function (e) {
            const btn = e.target.closest('[data-cfb-p],[data-cfb-s],[data-cfb-t],[data-cfb-a]');
            if (!btn) return;

            if (btn.hasAttribute('data-cfb-p')) {
                const pv = btn.getAttribute('data-cfb-p');
                if (pv === 'custom') {
                    _openCustomPeriodSwal(state, el, emit);
                    return;
                }
                state.period = pv;
                state.dateFrom = null;
                state.dateTo = null;
                el.querySelectorAll('[data-cfb-p]').forEach(function (b) { b.classList.remove('p-on'); });
                btn.classList.add('p-on');
                emit();
                return;
            }

            if (btn.hasAttribute('data-cfb-s')) {
                const v = btn.getAttribute('data-cfb-s');
                const same = state.status === v;
                state.status = same ? null : v;
                el.querySelectorAll('[data-cfb-s]').forEach(function (b) { b.classList.remove('s-ab', 's-fe', 's-ex', 's-nex'); });
                if (!same) {
                    const map = { aberta: 's-ab', fechada: 's-fe', exercida: 's-ex', nao_exercida: 's-nex' };
                    btn.classList.add(map[v] || '');
                }
                emit();
                return;
            }

            if (btn.hasAttribute('data-cfb-t')) {
                const v = btn.getAttribute('data-cfb-t');
                const same = state.tipo === v;
                state.tipo = same ? null : v;
                el.querySelectorAll('[data-cfb-t]').forEach(function (b) { b.classList.remove('t-call', 't-put'); });
                if (!same) btn.classList.add(v === 'CALL' ? 't-call' : 't-put');
                emit();
                return;
            }

            if (btn.hasAttribute('data-cfb-a')) {
                const v = btn.getAttribute('data-cfb-a');
                const same = state.asset === v;
                state.asset = same ? null : v;
                el.querySelectorAll('[data-cfb-a]').forEach(function (b) { b.classList.remove('a-on'); });
                const sel = el.querySelector('[data-cfb-a-sel]');
                if (sel) sel.value = '';
                if (!same) btn.classList.add('a-on');
                emit();
            }
        });

        el.addEventListener('change', function (e) {
            const target = e.target;
            if (!target) return;

            if (target.hasAttribute('data-cfb-a-sel')) {
                state.asset = target.value || null;
                el.querySelectorAll('[data-cfb-a]').forEach(function (b) {
                    b.classList.toggle('a-on', b.getAttribute('data-cfb-a') === state.asset);
                });
                emit();
                return;
            }

            if (target.hasAttribute('data-cfb-c')) {
                state.corretora = target.value || null;
                emit();
            }
        });
    }

    function updateTime(id) {
        const el = document.getElementById(id);
        if (!el) return;
        const n = new Date();
        const h = String(n.getHours()).padStart(2, '0');
        const m = String(n.getMinutes()).padStart(2, '0');
        el.textContent = 'Atualizado: ' + h + ':' + m;
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectCSS);
    else injectCSS();

    global.CryptoFilterBar = {
        injectCSS,
        createState,
        filter,
        renderHeader,
        renderFilterBar,
        renderTotals,
        bind,
        updateTime,
        getAsset,
        inPeriod,
    };
})(window);
