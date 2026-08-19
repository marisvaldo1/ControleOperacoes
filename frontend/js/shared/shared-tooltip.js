/**
 * shared-tooltip.js — Tooltip compartilhado para todo o site
 * 
 * Uso:
 *   SharedTooltip.show(element, { type: 'put'|'call'|'default', title: '...', lines: [...] });
 *   SharedTooltip.hide();
 * 
 * Estrutura de lines:
 *   { key: '📅 Data', value: '10/07/2026' }
 *   { key: '💰 Resultado', value: '+US$ 5.22', className: 'tt-positive' }
 *   { key: '⚙️ Status', badge: 'EXERCIDA', badgeClass: 'tt-exercida' }
 */
;(function () {
  'use strict';

  var tooltipEl = null;
  var headEl = null;
  var bodyEl = null;

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;

    tooltipEl = document.createElement('div');
    tooltipEl.className = 'shared-tooltip';
    tooltipEl.innerHTML = '<div class="tt-head tt-default" id="sharedTtHead"></div>' +
      '<div class="tt-body" id="sharedTtBody"></div>';
    document.body.appendChild(tooltipEl);

    headEl = tooltipEl.querySelector('#sharedTtHead');
    bodyEl = tooltipEl.querySelector('#sharedTtBody');

    return tooltipEl;
  }

  function getHeadClass(type) {
    switch ((type || '').toLowerCase()) {
      case 'put': return 'tt-put';
      case 'call': return 'tt-call';
      default: return 'tt-default';
    }
  }

  function getHeadIcon(type) {
    switch ((type || '').toLowerCase()) {
      case 'put': return '🔵';
      case 'call': return '🔷';
      default: return '📊';
    }
  }

  /**
   * Mostra o tooltip
   * @param {HTMLElement} element - Elemento de referência
   * @param {Object} config - Configuração do tooltip
   * @param {string} config.type - 'put', 'call' ou 'default'
   * @param {string} config.title - Título do tooltip
   * @param {Array} config.lines - Linhas de informação
   * @param {string} [config.note] - Nota explicativa
   */
  function show(element, config) {
    if (!element || !config) return;

    var tt = ensureTooltip();

    // Cabeçalho
    headEl.className = 'tt-head ' + getHeadClass(config.type);
    headEl.innerHTML = getHeadIcon(config.type) + ' ' + escapeHtml(config.title || '');

    // Corpo
    var html = '';
    if (config.lines && config.lines.length > 0) {
      config.lines.forEach(function (line) {
        html += '<div class="tt-line">';
        html += '<span class="tt-key">' + escapeHtml(line.key || '') + '</span>';
        if (line.badge) {
          html += '<span class="tt-badge ' + escapeHtml(line.badgeClass || '') + '">' + escapeHtml(line.badge) + '</span>';
        } else {
          html += '<span class="tt-value ' + escapeHtml(line.className || '') + '">' + escapeHtml(line.value || '') + '</span>';
        }
        html += '</div>';
      });
    }

    if (config.formula) {
      html += '<div class="tt-formula">' + config.formula + '</div>';
    }

    if (config.note) {
      html += '<div class="tt-note">' + escapeHtml(config.note) + '</div>';
    }

    bodyEl.innerHTML = html;

    // Posicionamento
    tt.classList.add('visible');
    positionTooltip(element);
  }

  function positionTooltip(element) {
    var tt = tooltipEl;
    if (!tt || !element) return;

    var rect = element.getBoundingClientRect();
    var ttWidth = tt.offsetWidth || 240;
    var ttHeight = tt.offsetHeight || 200;

    var x = rect.right + 12;
    var y = rect.top;

    // Verifica se cabe à direita
    if (x + ttWidth > window.innerWidth - 16) {
      x = rect.left - ttWidth - 12;
    }

    // Verifica se cabe à esquerda
    if (x < 16) {
      x = rect.left + (rect.width - ttWidth) / 2;
    }

    // Verifica se cabe embaixo
    if (y + ttHeight > window.innerHeight - 16) {
      y = window.innerHeight - ttHeight - 16;
    }

    // Verifica se cabe em cima
    if (y < 16) {
      y = 16;
    }

    tt.style.left = x + 'px';
    tt.style.top = y + 'px';
  }

  function hide() {
    if (tooltipEl) {
      tooltipEl.classList.remove('visible');
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Vincula eventos de mouse a um elemento
   * @param {HTMLElement} element - Elemento
   * @param {Function} configFn - Função que retorna a configuração do tooltip
   */
  function bind(element, configFn) {
    if (!element || typeof configFn !== 'function') return;

    element.addEventListener('mouseenter', function () {
      var config = configFn();
      if (config) show(element, config);
    });

    element.addEventListener('mouseleave', function () {
      hide();
    });
  }

  // Exporta globalmente
  window.SharedTooltip = {
    show: show,
    hide: hide,
    bind: bind,
  };
})();
