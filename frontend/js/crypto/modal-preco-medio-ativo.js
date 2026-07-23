;(function () {
    'use strict';

    var usd = function (n) {
        return 'US$ ' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    var modalData = null;
    var closeHandler = null;
    var activeYear = '';

    function getOps(par) {
        return (window.cryptoOperacoes || []).filter(function (o) {
            var a = (o.ativo || '').toUpperCase().replace('USDT', '').replace('/', '').trim();
            return a === par.toUpperCase();
        });
    }

    function isExercisedCall(op) {
        if ((op.status || '').toUpperCase() === 'ABERTA') return false;
        if ((op.tipo || '').toUpperCase() !== 'CALL') return false;
        var st = window.CryptoExerciseStatus
            ? window.CryptoExerciseStatus.resolveDisplayStatus(op)
            : (op.exercicio_status || '').toUpperCase();
        return st === 'SIM';
    }

    function computeData(par, cotacaoOverride) {
        var ops = getOps(par);
        var callsExercidas = ops.filter(isExercisedCall);
        var ultimoExercicio = callsExercidas.length
            ? callsExercidas.sort(function (a, b) {
                var aTime = window.CryptoExerciseStatus?.getOperationDate?.(a)?.getTime?.() || 0;
                var bTime = window.CryptoExerciseStatus?.getOperationDate?.(b)?.getTime?.() || 0;
                return bTime - aTime;
            })[0]
            : null;

        var strikeBase = ultimoExercicio
            ? parseFloat(ultimoExercicio.strike || 0)
            : parseFloat(ops.reduce(function (max, o) {
                return parseFloat(o.strike || 0) > parseFloat(max.strike || 0) ? o : max;
            }, ops[0])?.strike || 0);

        var premios = ops.map(function (o) {
            return {
                rot: (o.tipo || '') + ' ' + (o.ativo || '') + ' — ' + (o.status || ''),
                v: parseFloat(o.premio_us || 0),
                data: o.exercicio || o.data_operacao || '',
            };
        }).filter(function (p) { return p.v > 0; }).sort(function (a, b) {
            return (b.data || '').localeCompare(a.data || '');
        });

        var totalPremios = premios.reduce(function (s, p) { return s + p.v; }, 0);
        var pm = strikeBase - totalPremios;

        var cotacao = cotacaoOverride || parseFloat(ops.find(function (o) {
            return parseFloat(o.cotacao_atual || 0) > 0;
        })?.cotacao_atual || 0);

        return {
            ativo: par,
            ultimoExercicio: strikeBase,
            premios: premios,
            totalPremios: totalPremios,
            pm: pm,
            cotacao: cotacao,
        };
    }

    function openModal(par, cotacaoOverride) {
        if (!par) return;
        modalData = computeData(par, cotacaoOverride);
        var overlay = document.getElementById('pmOverlay');
        if (!overlay) return;
        build();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        var overlay = document.getElementById('pmOverlay');
        if (overlay) overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    function ensureBind() {
        if (closeHandler) return;
        closeHandler = true;
        var overlay = document.getElementById('pmOverlay');
        if (!overlay) return;
        var closeBtn = document.getElementById('pmClose');
        if (closeBtn) closeBtn.onclick = closeModal;
        overlay.onclick = function (e) { if (e.target === overlay) closeModal(); };
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    }

    function buildSteps(d, filterYear) {
        var run = d.ultimoExercicio;
        var steps = [{
            rot: 'Preço de entrada (PUT exercida)',
            v: d.ultimoExercicio,
            type: 'in',
            before: 0,
            after: d.ultimoExercicio,
            data: '',
        }];
        d.premios.forEach(function (p) {
            var b = run;
            run -= p.v;
            steps.push({
                rot: p.rot,
                v: p.v,
                type: 'down',
                before: b,
                after: run,
                data: p.data,
            });
        });
        steps.push({ rot: 'PREÇO MÉDIO ATUAL', v: d.pm, type: 'out', before: 0, after: d.pm, data: '' });

        if (filterYear) {
            steps = steps.filter(function (s) {
                if (s.type === 'in' || s.type === 'out') return true;
                return s.data && s.data.substring(0, 4) === filterYear;
            });
        }
        return steps;
    }

    function getYears(d) {
        var years = {};
        d.premios.forEach(function (p) {
            var y = (p.data || '').substring(0, 4);
            if (y) years[y] = true;
        });
        return Object.keys(years).sort();
    }

    function drawWaterfall(steps) {
        var AXIS = steps.length > 0
            ? Math.max.apply(null, steps.map(function (s) { return Math.max(s.before, s.after); })) * 1.15
            : 2000;
        var H = 240;
        var y = function (v) { return H * (1 - v / AXIS); };
        var tickCount = 5;
        var tickStep = AXIS / tickCount;
        var grid = '';
        for (var i = 0; i <= tickCount; i++) {
            var val = tickStep * i;
            grid += '<div class="pm-wf-gl" style="top:' + y(val) + 'px"><span>' + Math.round(val) + '</span></div>';
        }

        var cols = '';
        steps.forEach(function (s, idx) {
            var top, h, cls, vtxt, vtop, color;
            if (s.type === 'in') {
                cls = 'total-in';
                top = y(s.after);
                h = H - y(s.after);
                vtxt = usd(s.v);
                vtop = top - 12;
                color = 'var(--pm-blue)';
            } else if (s.type === 'down') {
                cls = 'down';
                top = y(s.before);
                h = Math.max(y(s.after) - y(s.before), 2);
                vtxt = '−' + usd(s.v);
                vtop = top - 12;
                color = 'var(--pm-green)';
            } else {
                cls = 'total-out';
                top = y(s.after);
                h = H - y(s.after);
                vtxt = usd(s.v);
                vtop = top - 12;
                color = 'var(--pm-amber)';
            }
            var short = s.type === 'in' ? 'entrada'
                : s.type === 'out' ? 'PM final'
                : '#' + (idx);
            var dateHtml = s.data ? '<div class="pm-wf-dt">' + s.data.substring(0, 7) + '</div>' : '';
            cols += '<div class="pm-wf-col">' +
                '<div class="pm-wf-bar ' + cls + '" style="top:' + top + 'px;height:' + h + 'px"></div>' +
                '<div class="pm-wf-v" style="top:' + vtop + 'px;color:' + color + '">' + vtxt + '</div>' +
                '<div class="pm-wf-lbl" title="' + s.rot.replace(/"/g, '&quot;') + '">' + short + '</div>' +
                dateHtml +
                '</div>';
        });

        var wrap = document.getElementById('pmWfWrap');
        if (wrap) {
            wrap.innerHTML = '<div class="pm-wf" id="pmWf">' +
                '<div class="pm-wf-grid">' + grid + '</div>' +
                '<div class="pm-wf-cols">' + cols + '</div></div>';
        }
    }

    function drawSteps(steps) {
        var html = '';
        steps.forEach(function (s) {
            var vv, cls = '';
            if (s.type === 'in') {
                vv = '<span class="vv pos">' + usd(s.v) + '</span>';
            } else if (s.type === 'down') {
                vv = '<span class="vv neg">−' + usd(s.v) + '</span>';
            } else {
                vv = '<span class="vv fin">' + usd(s.v) + '</span>';
                cls = 'fin';
            }
            var dateHtml = s.data ? '<span class="dt">' + s.data.substring(0, 10) + '</span>' : '';
            html += '<li class="' + cls + '">' + dateHtml + '<span class="nm">' + s.rot + '</span>' + vv + '</li>';
        });
        var el = document.getElementById('pmSteps');
        if (el) el.innerHTML = html;
    }

    function handleFilterChange() {
        var sel = document.getElementById('pmYearFilter');
        activeYear = sel ? sel.value : '';
        rebuild();
    }

    function rebuild() {
        var d = modalData;
        if (!d) return;
        var steps = buildSteps(d, activeYear);
        drawWaterfall(steps);
        drawSteps(steps);
    }

    function build() {
        var d = modalData;
        if (!d) return;
        ensureBind();

        var hdPm = document.getElementById('hdPm');
        if (hdPm) hdPm.textContent = usd(d.pm);

        var years = getYears(d);
        var filterOpts = '<option value="">Todos os anos</option>';
        years.forEach(function (y) {
            filterOpts += '<option value="' + y + '"' + (activeYear === y ? ' selected' : '') + '>' + y + '</option>';
        });

        var body = document.getElementById('pmBody');
        if (!body) return;

        body.innerHTML =
            '<div class="pm-formula">' +
                '<span class="r">' + usd(d.pm) + '</span><span class="op"> = </span>' +
                '<span class="pos">' + usd(d.ultimoExercicio) + '</span><span class="op"> − </span>' +
                '<span class="neg">(' + usd(d.totalPremios) + ')</span>' +
                '<span class="op" style="margin-left:auto;font-family:var(--pm-sans);font-size:.66rem;color:var(--pm-mut)">entrada − prêmios acumulados</span>' +
            '</div>' +
            '<div class="pm-grid2">' +
                '<div class="pm-card">' +
                    '<div class="pm-card-t">Evolução do custo (waterfall)</div>' +
                    '<div class="pm-wf-scroll" id="pmWfWrap"></div>' +
                '</div>' +
                '<div class="pm-card pm-steps-card">' +
                    '<div class="pm-card-t">' +
                        'Passo a passo do cálculo' +
                        '<select class="pm-filter" id="pmYearFilter">' + filterOpts + '</select>' +
                    '</div>' +
                    '<div class="pm-steps-scroll">' +
                        '<ol class="pm-steps" id="pmSteps"></ol>' +
                    '</div>' +
                '</div>' +
            '</div>';

        var sel = document.getElementById('pmYearFilter');
        if (sel) sel.onchange = handleFilterChange;

        var steps = buildSteps(d, activeYear);
        drawWaterfall(steps);
        drawSteps(steps);
    }

    function init() {
        var container = document.getElementById('modalPrecoMedioAtivoContainer');
        if (!container) return;
        fetch('modal-preco-medio-ativo.html', { cache: 'no-store' })
            .then(function (r) { return r.text(); })
            .then(function (html) {
                container.innerHTML = html;
            })
            .catch(function () {});
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.ModalPrecoMedioAtivo = { openModal: openModal };
})();
