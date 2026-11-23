window.CAE = window.CAE || {};
window.CAE.Modules = window.CAE.Modules || {};

window.CAE.Core = (function () {
  'use strict';

  /* ================= INTERNAL STATE ================= */
  var state = {
    initialized: false,
    currentView: 'hub',
    currentModule: null,
    drawerOpen: false
  };

  /* Timer state */
  var timer = {
    intervalId: null,
    durationSec: 0,
    elapsedSec: 0,
    running: false,
    paused: false
  };

  /* Highlighter state */
  var hl = {
    rootEl: null,
    activeRange: null,
    activeMark: null,
    onMouseUp: null,
    onKeyUp: null,
    onClick: null,
    onDocMouseDown: null,
    onScrollHide: null
  };

  /* Explanation popover state */
  var expDataMap = typeof WeakMap === 'function' ? new WeakMap() : null;
  var exp = {
    popoverEl: null,
    anchorEl: null,
    pinned: false,
    visible: false,
    hideTimer: null,
    globalBound: false
  };

  /* Top-action handler reference */
  var topActionHandler = null;

  /* ================= DOM HELPERS ================= */
  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return months[d.getMonth()] + ' ' + String(d.getDate()).padStart(2, '0') + ', ' + hh + ':' + mm;
  }

  function formatScope(scope) {
    if (!scope || scope === 'full') return 'Full Paper';
    var m = String(scope).match(/^part(\d)$/i);
    if (m) return 'Part ' + m[1];
    return String(scope).replace(/[_-]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function scorePillClass(score) {
    if (score >= 180) return 'pill-ok';
    if (score >= 160) return 'pill-warn';
    return 'pill-err';
  }

  function formatClock(totalSeconds) {
    var abs = Math.max(0, Math.floor(Math.abs(totalSeconds)));
    var mins = Math.floor(abs / 60);
    var secs = abs % 60;
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  /* ================= UTILITIES ================= */
  function toast(message, durationMs) {
    var root = $('toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = String(message || '');
    root.appendChild(el);

    var ttl = typeof durationMs === 'number' ? durationMs : 3000;
    setTimeout(function () {
      el.style.transition = 'opacity 180ms ease, transform 180ms ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 200);
    }, ttl);
  }

  function copyToClipboard(text) {
    var payload = String(text == null ? '' : text);

    function fallbackCopy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = payload;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.left = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, payload.length);
        var ok = false;
        try {
          ok = document.execCommand('copy');
        } catch (_) {
          ok = false;
        }
        document.body.removeChild(ta);
        return ok;
      } catch (_) {
        return false;
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
      return navigator.clipboard.writeText(payload).then(
        function () { return true; },
        function () { return fallbackCopy(); }
      );
    }
    return Promise.resolve(fallbackCopy());
  }

  function closeModal() {
    var root = $('modal-root');
    if (!root) return;
    root.hidden = true;
    root.innerHTML = '';
    document.body.style.overflow = '';
  }

  function showModal(title, htmlContent, actionsArray) {
    var root = $('modal-root');
    if (!root) return null;

    hideHighlightPopover();
    hideExpPopover();

    var actions = Array.isArray(actionsArray) ? actionsArray : [];
    root.innerHTML =
      '<div class="modal-card" role="document">' +
        '<div class="modal-head">' +
          '<h3 class="modal-title">' + escapeHtml(title || '') + '</h3>' +
          '<button type="button" class="btn btn-icon" data-modal-close aria-label="Close modal" title="Close">' +
            '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="modal-body">' + (htmlContent || '') + '</div>' +
        (actions.length ? '<div class="modal-foot"></div>' : '') +
      '</div>';

    var card = root.querySelector('.modal-card');
    var foot = root.querySelector('.modal-foot');

    if (foot) {
      actions.forEach(function (act) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = act.className || (act.variant === 'primary' ? 'btn btn-primary' : act.variant === 'ghost' ? 'btn btn-ghost' : 'btn');
        if (act.id) btn.id = act.id;
        btn.textContent = act.label || 'OK';
        btn.addEventListener('click', function (e) {
          var shouldClose = act.closeOnClick !== false;
          if (typeof act.onClick === 'function') {
            var res = act.onClick(e, card);
            if (res === false) shouldClose = false;
          }
          if (shouldClose) closeModal();
        });
        foot.appendChild(btn);
      });
    }

    var closeBtn = root.querySelector('[data-modal-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    root.hidden = false;
    document.body.style.overflow = 'hidden';
    return card;
  }

  /* ================= MISTAKE EXPLANATION POPOVER ================= */
  function cancelExpHideTimer() {
    if (exp.hideTimer !== null) {
      clearTimeout(exp.hideTimer);
      exp.hideTimer = null;
    }
  }

  function scheduleExpHide() {
    cancelExpHideTimer();
    if (exp.pinned) return;
    exp.hideTimer = setTimeout(function () {
      if (!exp.pinned) hideExpPopover();
    }, 140);
  }

  function hideExpPopover() {
    cancelExpHideTimer();
    if (exp.anchorEl) {
      exp.anchorEl.classList.remove('is-pinned');
      exp.anchorEl.setAttribute('aria-expanded', 'false');
    }
    if (exp.popoverEl) {
      exp.popoverEl.hidden = true;
    }
    exp.anchorEl = null;
    exp.pinned = false;
    exp.visible = false;
  }

  function ensureExpPopover() {
    var existing = $('cae-exp-popover');
    if (existing) {
      exp.popoverEl = existing;
    } else {
      var el = document.createElement('div');
      el.id = 'cae-exp-popover';
      el.setAttribute('role', 'tooltip');
      el.hidden = true;
      document.body.appendChild(el);
      exp.popoverEl = el;

      el.addEventListener('mouseenter', function () {
        cancelExpHideTimer();
      });

      el.addEventListener('mouseleave', function () {
        scheduleExpHide();
      });

      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-exp-close]')) {
          e.stopPropagation();
          hideExpPopover();
        }
      });
    }

    if (!exp.globalBound) {
      exp.globalBound = true;

      document.addEventListener('mousedown', function (e) {
        if (!exp.visible || !exp.popoverEl) return;
        if (exp.popoverEl.contains(e.target)) return;
        if (exp.anchorEl && exp.anchorEl.contains(e.target)) return;
        hideExpPopover();
      });

      window.addEventListener('scroll', function () {
        if (!exp.visible) return;
        if (!exp.pinned || !exp.anchorEl || !document.body.contains(exp.anchorEl)) {
          hideExpPopover();
          return;
        }
        var r = exp.anchorEl.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) {
          hideExpPopover();
        } else {
          positionExpPopover(exp.anchorEl);
        }
      }, true);

      window.addEventListener('resize', function () {
        if (exp.visible && exp.anchorEl && document.body.contains(exp.anchorEl)) {
          positionExpPopover(exp.anchorEl);
        }
      });
    }

    return exp.popoverEl;
  }

  function positionExpPopover(anchorEl) {
    var pop = exp.popoverEl;
    if (!pop || !anchorEl) return;

    var rect = anchorEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hideExpPopover();
      return;
    }

    pop.hidden = false;
    pop.style.visibility = 'hidden';
    pop.style.left = '0px';
    pop.style.top = '0px';

    var pad = 12;
    var gap = 8;
    var popW = pop.offsetWidth || 320;
    var popH = pop.offsetHeight || 160;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    var left = rect.left + (rect.width / 2) - (popW / 2);
    left = Math.max(pad, Math.min(vw - popW - pad, left));

    var top;
    if (rect.top - popH - gap >= pad) {
      top = rect.top - popH - gap;
    } else if (rect.bottom + popH + gap <= vh - pad) {
      top = rect.bottom + gap;
    } else {
      top = Math.max(pad, Math.min(vh - popH - pad, rect.bottom + gap));
    }

    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';
    pop.style.visibility = '';
  }

  function renderExpPopover(data, isPinned) {
    var pop = ensureExpPopover();
    var d = data || {};
    var isCorrect = Boolean(d.isCorrect);
    var isPartial = !isCorrect && Boolean(d.isPartial);

    var badgeClass = isCorrect ? 'is-ok' : (isPartial ? 'is-warn' : 'is-err');
    var badgeLabel = isCorrect ? 'Correct' : (isPartial ? 'Partial Credit' : 'Incorrect');

    var userAns = String(d.userAnswer != null ? d.userAnswer : '').trim();
    var correctAns = String(d.correctAnswer != null ? d.correctAnswer : '').trim();
    var wrongReason = String(d.wrongReason != null ? d.wrongReason : '').trim();
    var rule = String(d.rule != null ? d.rule : '').trim();
    var trap = String(d.trap != null ? d.trap : '').trim();

    var parts = [];

    parts.push(
      '<div class="cae-exp-head">' +
        '<span class="cae-exp-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
        (isPinned
          ? '<button type="button" class="cae-exp-close" data-exp-close aria-label="Close explanation" title="Close">×</button>'
          : '<span class="cae-exp-pin-hint">Click ? to pin</span>') +
      '</div>'
    );

    if ((!isCorrect && (userAns || correctAns)) || (isCorrect && correctAns)) {
      var ansRows = '';
      if (!isCorrect) {
        ansRows +=
          '<div class="cae-exp-ans-row">' +
            '<span class="cae-exp-ans-key">Yours:</span>' +
            '<span class="cae-exp-ans-user">' + escapeHtml(userAns || '(blank)') + '</span>' +
          '</div>';
      }
      if (correctAns) {
        ansRows +=
          '<div class="cae-exp-ans-row">' +
            '<span class="cae-exp-ans-key">Key:</span>' +
            '<span class="cae-exp-ans-correct">' + escapeHtml(correctAns) + '</span>' +
          '</div>';
      }
      parts.push('<div class="cae-exp-answers">' + ansRows + '</div>');
    }

    if (wrongReason) {
      parts.push(
        '<div class="cae-exp-block cae-exp-block-wrong">' +
          '<span class="cae-exp-label">Why your answer doesn\'t fit</span>' +
          '<p class="cae-exp-text">' + escapeHtml(wrongReason) + '</p>' +
        '</div>'
      );
    }

    if (rule) {
      parts.push(
        '<div class="cae-exp-block cae-exp-block-rule">' +
          '<span class="cae-exp-label">Grammar / Rule</span>' +
          '<p class="cae-exp-text">' + escapeHtml(rule) + '</p>' +
        '</div>'
      );
    }

    if (trap) {
      parts.push(
        '<div class="cae-exp-block cae-exp-block-trap">' +
          '<span class="cae-exp-label">Exam Trap</span>' +
          '<p class="cae-exp-text">' + escapeHtml(trap) + '</p>' +
        '</div>'
      );
    }

    if (!wrongReason && !rule && !trap) {
      parts.push('<p class="cae-exp-text" style="color:var(--text-muted);">No detailed explanation provided for this item.</p>');
    }

    pop.innerHTML = parts.join('');
    pop.setAttribute('role', isPinned ? 'dialog' : 'tooltip');
  }

  function showExpForButton(btnEl, data, pin) {
    cancelExpHideTimer();
    if (exp.anchorEl && exp.anchorEl !== btnEl) {
      exp.anchorEl.classList.remove('is-pinned');
      exp.anchorEl.setAttribute('aria-expanded', 'false');
    }

    exp.anchorEl = btnEl;
    exp.pinned = Boolean(pin);
    exp.visible = true;

    btnEl.classList.toggle('is-pinned', exp.pinned);
    btnEl.setAttribute('aria-expanded', 'true');

    renderExpPopover(data, exp.pinned);
    positionExpPopover(btnEl);
  }

  function getExpData(btnEl) {
    if (expDataMap) return expDataMap.get(btnEl) || null;
    return btnEl._caeExpData || null;
  }

  function setExpData(btnEl, data) {
    if (expDataMap) expDataMap.set(btnEl, data);
    else btnEl._caeExpData = data;
  }

  function registerExplanation(btnEl, data) {
    if (!btnEl) return;
    ensureExpPopover();

    var payload = data || {};
    var isAlreadyBound = Boolean(getExpData(btnEl));
    setExpData(btnEl, payload);

    btnEl.classList.add('cae-exp-btn');
    btnEl.classList.toggle('is-correct', Boolean(payload.isCorrect));
    btnEl.classList.toggle('is-partial', !payload.isCorrect && Boolean(payload.isPartial));
    btnEl.classList.toggle('is-wrong', !payload.isCorrect && !payload.isPartial);

    if (!btnEl.textContent || !btnEl.textContent.trim()) {
      btnEl.textContent = '?';
    }
    if (btnEl.tagName === 'BUTTON' && !btnEl.getAttribute('type')) {
      btnEl.setAttribute('type', 'button');
    }
    btnEl.setAttribute('aria-haspopup', 'dialog');
    btnEl.setAttribute('aria-expanded', (exp.visible && exp.anchorEl === btnEl) ? 'true' : 'false');
    btnEl.setAttribute('aria-label', payload.isCorrect ? 'Show answer explanation' : 'Show mistake explanation');

    if (exp.visible && exp.anchorEl === btnEl) {
      renderExpPopover(payload, exp.pinned);
      positionExpPopover(btnEl);
    }

    if (isAlreadyBound) return;

    btnEl.addEventListener('mouseenter', function () {
      if (exp.pinned && exp.anchorEl !== btnEl) return;
      var latest = getExpData(btnEl);
      if (!latest) return;
      showExpForButton(btnEl, latest, exp.pinned && exp.anchorEl === btnEl);
    });

    btnEl.addEventListener('mouseleave', function () {
      if (exp.anchorEl === btnEl && !exp.pinned) {
        scheduleExpHide();
      }
    });

    btnEl.addEventListener('focus', function () {
      if (exp.pinned && exp.anchorEl !== btnEl) return;
      var latest = getExpData(btnEl);
      if (!latest) return;
      showExpForButton(btnEl, latest, exp.pinned && exp.anchorEl === btnEl);
    });

    btnEl.addEventListener('blur', function () {
      if (exp.anchorEl === btnEl && !exp.pinned) {
        scheduleExpHide();
      }
    });

    btnEl.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var latest = getExpData(btnEl);
      if (!latest) return;

      if (exp.visible && exp.anchorEl === btnEl && exp.pinned) {
        hideExpPopover();
      } else {
        showExpForButton(btnEl, latest, true);
      }
    });
  }

  /* ================= THEME & SETTINGS SYNC ================= */
  function syncThemeControls() {
    var settings = window.CAE.Store.getSettings();

    var darkBtn = $('btn-dark-toggle');
    if (darkBtn) {
      darkBtn.setAttribute('aria-pressed', settings.dark ? 'true' : 'false');
    }

    var dots = document.querySelectorAll('#theme-selector .theme-dot');
    dots.forEach(function (dot) {
      var pick = dot.getAttribute('data-theme-pick');
      dot.setAttribute('aria-checked', pick === settings.theme ? 'true' : 'false');
    });
  }

  /* ================= HUB RENDERING ================= */
  function renderPartList(containerId, partsObj) {
    var el = $(containerId);
    if (!el) return;

    var keys = Object.keys(partsObj || {});
    if (!keys.length) {
      el.innerHTML = '<p class="muted-note">No parts tracked.</p>';
      return;
    }

    el.innerHTML = keys.map(function (k) {
      var p = partsObj[k];
      var hasData = p.possible > 0;
      var stat = hasData
        ? (p.earned + '/' + p.possible + ' · ' + Math.round(p.pct) + '%')
        : (p.mistakeCount > 0 ? (p.mistakeCount + ' err') : '—');
      var width = hasData ? Math.max(4, Math.min(100, p.pct)) : 0;

      return (
        '<div class="part-row">' +
          '<span class="part-row-name" title="' + escapeHtml(p.label) + '">' + escapeHtml(p.label) + '</span>' +
          '<span class="part-row-stat">' + escapeHtml(stat) + '</span>' +
          '<div class="part-bar-track"><div class="part-bar-fill" style="width:' + width + '%"></div></div>' +
        '</div>'
      );
    }).join('');
  }

  function renderWritingBreakdown(critAvg) {
    var el = $('breakdown-writing');
    if (!el) return;

    var labels = window.CAE.Store.WRITING_CRITERIA_LABELS;
    var keys = ['content', 'communicative', 'organisation', 'language'];
    var scaleMax = (critAvg && critAvg.scaleMax) ? critAvg.scaleMax : 5;

    el.innerHTML = keys.map(function (k) {
      var val = critAvg ? critAvg[k] : null;
      var hasData = val !== null && val !== undefined;
      var stat = hasData ? (val + ' / ' + scaleMax) : '—';
      var pct = hasData ? Math.max(4, Math.min(100, (val / scaleMax) * 100)) : 0;

      return (
        '<div class="part-row">' +
          '<span class="part-row-name">' + escapeHtml(labels[k]) + '</span>' +
          '<span class="part-row-stat">' + escapeHtml(stat) + '</span>' +
          '<div class="part-bar-track"><div class="part-bar-fill" style="width:' + pct + '%"></div></div>' +
        '</div>'
      );
    }).join('');
  }

  function renderHub() {
    var Store = window.CAE.Store;
    if (!Store) return;

    var proj = Store.getProjection();
    var attempts = Store.getAttempts();

    /* 1. Top 3 Module Cards */
    ['uoe', 'reading', 'writing'].forEach(function (mod) {
      var m = proj.modules[mod];
      var badge = $('badge-' + mod);
      var countEl = $('count-' + mod);

      if (badge) {
        if (m.latestAttempt) {
          badge.textContent = String(m.latestAttempt.cambridgeScore);
          badge.classList.add('has-score');
          badge.title = 'Latest: ' + m.latestAttempt.earned + '/' + m.latestAttempt.possible +
            ' (' + Store.getGradeLabel(m.latestAttempt.cambridgeScore) + ')';
        } else {
          badge.textContent = '—';
          badge.classList.remove('has-score');
          badge.title = 'No attempts yet';
        }
      }

      if (countEl) {
        countEl.textContent = m.attemptCount + (m.attemptCount === 1 ? ' attempt' : ' attempts');
      }
    });

    /* 2. Middle Recent Activity Table */
    var actCount = $('activity-count');
    if (actCount) {
      actCount.textContent = attempts.length + (attempts.length === 1 ? ' record' : ' records');
    }

    var tbody = $('recent-activity-body');
    if (tbody) {
      if (!attempts.length) {
        tbody.innerHTML =
          '<tr class="empty-row">' +
            '<td colspan="6">No attempts recorded yet. Select a module above to load a test or demo.</td>' +
          '</tr>';
      } else {
        tbody.innerHTML = attempts.slice(0, 25).map(function (att) {
          var pct = Math.round((att.earned / att.possible) * 100);
          var grade = Store.getGradeLabel(att.cambridgeScore);
          return (
            '<tr>' +
              '<td class="mono">' + escapeHtml(formatDate(att.date)) + '</td>' +
              '<td><strong>' + escapeHtml(Store.MODULE_LABELS[att.module] || att.module) + '</strong></td>' +
              '<td><span class="pill">' + escapeHtml(formatScope(att.scope)) + '</span></td>' +
              '<td class="num">' + escapeHtml(att.earned + ' / ' + att.possible + ' (' + pct + '%)') + '</td>' +
              '<td class="num"><span class="pill ' + scorePillClass(att.cambridgeScore) + '">' +
                escapeHtml(att.cambridgeScore + ' · ' + grade) +
              '</span></td>' +
              '<td class="col-action">' +
                '<button type="button" class="btn btn-danger-ghost" data-delete-attempt="' + escapeHtml(att.id) + '" aria-label="Delete attempt" title="Delete attempt">' +
                  '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>' +
                '</button>' +
              '</td>' +
            '</tr>'
          );
        }).join('');
      }
    }

    /* 3. Bottom Grade Projection Bar */
    var readout = $('grade-projection-readout');
    if (readout) {
      if (proj.overallScore !== null) {
        readout.innerHTML =
          '<span class="grade-score">' + escapeHtml(proj.overallScore) + '</span>' +
          '<span class="grade-sep">·</span>' +
          '<span class="grade-label">' + escapeHtml(proj.overallGrade) + '</span>';
      } else {
        readout.innerHTML =
          '<span class="grade-score">—</span>' +
          '<span class="grade-sep">·</span>' +
          '<span class="grade-label">No Data Yet</span>';
      }
    }

    ['uoe', 'reading', 'writing'].forEach(function (mod) {
      var m = proj.modules[mod];
      var valEl = $('mini-val-' + mod);
      var fillEl = $('mini-fill-' + mod);
      if (valEl) valEl.textContent = m.cambridgeScore !== null ? String(m.cambridgeScore) : '—';
      if (fillEl) {
        var width = m.weightedPercent !== null ? Math.max(4, Math.min(100, m.weightedPercent)) : 0;
        fillEl.style.width = width + '%';
      }
    });

    /* 4. Expandable Analysis Drawer */
    var summaryEl = $('drawer-summary-text');
    if (summaryEl) {
      if (proj.totalAttempts > 0) {
        summaryEl.textContent =
          'Weighted recency projection across ' + proj.attemptedModuleCount + '/3 modules · ' +
          proj.totalAttempts + (proj.totalAttempts === 1 ? ' attempt' : ' attempts') + ' · ' +
          proj.totalMistakes + (proj.totalMistakes === 1 ? ' logged mistake.' : ' logged mistakes.');
      } else {
        summaryEl.textContent = 'Weighted recency projection across attempted modules.';
      }
    }

    renderPartList('breakdown-uoe', proj.modules.uoe.parts);
    renderPartList('breakdown-reading', proj.modules.reading.parts);
    renderWritingBreakdown(proj.modules.writing.criteriaAverages);

    var weakEl = $('weakest-areas-list');
    if (weakEl) {
      if (!proj.weakestAreas.length) {
        weakEl.innerHTML = '<p class="muted-note">Complete at least one section to compute error-rate rankings.</p>';
      } else {
        weakEl.innerHTML = proj.weakestAreas.slice(0, 6).map(function (w, idx) {
          var meta = w.possible > 0 ? (w.errorRate + '% err') : (w.mistakeCount + ' err');
          return (
            '<div class="weakness-item">' +
              '<span class="weakness-label">' + (idx + 1) + '. ' + escapeHtml(w.label) + '</span>' +
              '<span class="weakness-rate">' + escapeHtml(meta) + '</span>' +
            '</div>'
          );
        }).join('');
      }
    }
  }

  function setDrawerOpen(isOpen) {
    state.drawerOpen = Boolean(isOpen);
    var drawer = $('analysis-drawer');
    var dock = $('grade-dock');
    var toggle = $('grade-bar-toggle');
    if (drawer) drawer.hidden = !state.drawerOpen;
    if (dock) dock.classList.toggle('is-open', state.drawerOpen);
    if (toggle) toggle.setAttribute('aria-expanded', state.drawerOpen ? 'true' : 'false');
  }

  function handleAdvancedAnalysis() {
    var promptText = window.CAE.Store.buildAnalysisPrompt();
    copyToClipboard(promptText).then(function (copied) {
      var statusNote = copied
        ? 'Copied to your clipboard automatically. A copyable backup is provided below.'
        : 'Clipboard access was blocked by the browser. Use Select & Copy below.';

      var bodyHtml =
        '<p style="margin:0;line-height:1.55;">' +
          '<strong>You have copied your analysis into an LLM-recognisable format. Paste it into a language model to receive analysis.</strong>' +
        '</p>' +
        '<p class="muted-note" style="margin:0;">' + escapeHtml(statusNote) + '</p>' +
        '<textarea class="modal-fallback-textarea" id="analysis-fallback-ta" readonly>' + escapeHtml(promptText) + '</textarea>';

      var card = showModal('ADVANCED ANALYSIS PROMPT', bodyHtml, [
        {
          label: 'Copy Again',
          variant: 'ghost',
          closeOnClick: false,
          onClick: function () {
            var ta = $('analysis-fallback-ta');
            if (ta) {
              ta.focus();
              ta.select();
            }
            copyToClipboard(promptText).then(function (ok) {
              toast(ok ? 'Analysis prompt copied to clipboard.' : 'Press Ctrl+C / Cmd+C to copy.');
            });
          }
        },
        {
          label: 'Done',
          variant: 'primary'
        }
      ]);

      if (card && !copied) {
        var ta = card.querySelector('#analysis-fallback-ta');
        if (ta) {
          ta.focus();
          ta.select();
        }
      }
    });
  }

  /* ================= ROUTER & WORKSPACE SHELL ================= */
  function showHub() {
    stopTimer();
    disableHighlighter();
    hideExpPopover();
    closeModal();

    state.currentView = 'hub';
    state.currentModule = null;

    var hub = $('view-hub');
    var ws = $('view-workspace');
    if (ws) ws.hidden = true;
    if (hub) hub.hidden = false;

    var wsBody = $('ws-body');
    if (wsBody) wsBody.innerHTML = '';

    setTopAction(null);
    setBottomNav([]);
    setScopePill('');

    renderHub();
    window.scrollTo(0, 0);
  }

  function setScopePill(text) {
    var pill = $('ws-scope-pill');
    if (!pill) return;
    if (text) {
      pill.textContent = text;
      pill.hidden = false;
    } else {
      pill.textContent = '';
      pill.hidden = true;
    }
  }

  function setTopAction(label, onClick, opts) {
    var btn = $('ws-top-action');
    if (!btn) return;

    if (topActionHandler) {
      btn.removeEventListener('click', topActionHandler);
      topActionHandler = null;
    }

    if (!label) {
      btn.hidden = true;
      btn.textContent = '';
      btn.disabled = false;
      return;
    }

    btn.textContent = label;
    btn.hidden = false;
    btn.disabled = Boolean(opts && opts.disabled);
    btn.className = (opts && opts.className) ? opts.className : 'btn btn-primary btn-sm';

    if (typeof onClick === 'function') {
      topActionHandler = onClick;
      btn.addEventListener('click', topActionHandler);
    }
  }

  function setBottomNav(items, activeId, onSelect) {
    var nav = $('ws-bottom-nav');
    if (!nav) return;

    nav.innerHTML = '';
    if (!Array.isArray(items) || !items.length) {
      nav.hidden = true;
      return;
    }

    items.forEach(function (item) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ws-part-tab' +
        (item.id === activeId ? ' is-active' : '') +
        (item.done ? ' is-done' : '');
      btn.setAttribute('data-part-id', item.id);
      btn.textContent = item.label;
      btn.addEventListener('click', function () {
        hideExpPopover();
        nav.querySelectorAll('.ws-part-tab').forEach(function (t) {
          t.classList.toggle('is-active', t === btn);
        });
        if (typeof onSelect === 'function') onSelect(item.id);
      });
      nav.appendChild(btn);
    });

    nav.hidden = false;
  }

  function openModule(moduleKey, rawTxt) {
    if (rawTxt === undefined || rawTxt === null) {
      openUploadGate(moduleKey);
      return;
    }

    var modApi = window.CAE.Modules && window.CAE.Modules[moduleKey];
    if (!modApi || typeof modApi.mount !== 'function') {
      toast('Module "' + moduleKey + '" is not loaded yet.');
      return;
    }

    stopTimer();
    disableHighlighter();
    hideExpPopover();
    closeModal();
    setDrawerOpen(false);

    state.currentView = 'workspace';
    state.currentModule = moduleKey;

    var hub = $('view-hub');
    var ws = $('view-workspace');
    if (hub) hub.hidden = true;
    if (ws) ws.hidden = false;

    var titleEl = $('ws-title');
    var label = (window.CAE.Store && window.CAE.Store.MODULE_LABELS[moduleKey]) || moduleKey;
    if (titleEl) titleEl.textContent = label.toUpperCase();

    setScopePill('');
    setTopAction(null);
    setBottomNav([]);
    resetTimerDisplay();

    var wsBody = $('ws-body');
    if (wsBody) {
      wsBody.innerHTML = '';
      wsBody.scrollTop = 0;
    }

    try {
      modApi.mount(wsBody, String(rawTxt));
    } catch (err) {
      console.error(err);
      toast('Failed to parse test file: ' + (err && err.message ? err.message : 'Invalid format'), 4500);
      showHub();
    }
  }

  /* ================= AI UPLOAD GATE ================= */
  function openUploadGate(moduleKey) {
    var Store = window.CAE.Store;
    var label = (Store && Store.MODULE_LABELS[moduleKey]) || moduleKey.toUpperCase();

    var html =
      '<div style="display:flex;flex-direction:column;gap:14px;">' +
        '<div class="dropzone" id="gate-dropzone" role="button" tabindex="0" aria-label="Upload .txt exam file">' +
          '<input type="file" id="gate-file-input" accept=".txt,text/plain" hidden>' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">' +
            '<svg class="icon" style="width:24px;height:24px;color:var(--accent);" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M8 10.5V2.5M5 5.5L8 2.5l3 3M2.5 11v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2"/>' +
            '</svg>' +
            '<div class="mono" style="font-size:13.5px;font-weight:700;letter-spacing:0.06em;">AI UPLOAD (.txt)</div>' +
            '<div class="muted-note">Drop a generated .txt test file here, or click to browse</div>' +
          '</div>' +
        '</div>' +

        '<div style="text-align:center;">' +
          '<button type="button" class="btn btn-ghost btn-sm" id="gate-paste-toggle">or paste raw .txt</button>' +
        '</div>' +

        '<div id="gate-paste-box" hidden style="display:flex;flex-direction:column;gap:8px;">' +
          '<textarea class="field-textarea mono" id="gate-paste-ta" style="min-height:130px;font-size:12px;" placeholder="Paste raw CAE Bench .txt test content here..."></textarea>' +
          '<div style="display:flex;justify-content:flex-end;">' +
            '<button type="button" class="btn btn-primary btn-sm" id="gate-paste-load">Load Pasted Test</button>' +
          '</div>' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:4px;">' +
          '<button type="button" class="btn" id="gate-copy-prompt" style="height:40px;font-weight:600;">' +
            '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M5.5 3.5h-2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2"/>' +
              '<rect x="6" y="2" width="7.5" height="8" rx="1"/>' +
            '</svg>' +
            '<span>COPY PROMPT</span>' +
          '</button>' +
          '<button type="button" class="btn btn-primary" id="gate-launch-demo" style="height:40px;font-weight:600;">' +
            '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<polygon points="4.5,3 12.5,8 4.5,13"/>' +
            '</svg>' +
            '<span>LAUNCH DEMO</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    var card = showModal(label.toUpperCase() + ' · LOAD TEST', html, []);
    if (!card) return;

    var dropzone = card.querySelector('#gate-dropzone');
    var fileInput = card.querySelector('#gate-file-input');
    var pasteToggle = card.querySelector('#gate-paste-toggle');
    var pasteBox = card.querySelector('#gate-paste-box');
    var pasteTa = card.querySelector('#gate-paste-ta');
    var pasteLoadBtn = card.querySelector('#gate-paste-load');
    var copyPromptBtn = card.querySelector('#gate-copy-prompt');
    var launchDemoBtn = card.querySelector('#gate-launch-demo');

    function handleFile(file) {
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        var text = String(ev.target.result || '');
        if (!text.trim()) {
          toast('Selected file is empty.');
          return;
        }
        openModule(moduleKey, text);
      };
      reader.onerror = function () {
        toast('Could not read the selected .txt file.');
      };
      reader.readAsText(file);
    }

    dropzone.addEventListener('click', function () { fileInput.click(); });
    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) {
        handleFile(fileInput.files[0]);
      }
    });

    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    });

    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('is-dragover');
    });

    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    pasteToggle.addEventListener('click', function () {
      var opening = pasteBox.hidden;
      pasteBox.hidden = !opening;
      pasteToggle.textContent = opening ? 'hide paste box' : 'or paste raw .txt';
      if (opening && pasteTa) pasteTa.focus();
    });

    pasteLoadBtn.addEventListener('click', function () {
      var raw = pasteTa ? pasteTa.value : '';
      if (!raw.trim()) {
        toast('Paste test content before loading.');
        return;
      }
      openModule(moduleKey, raw);
    });

    copyPromptBtn.addEventListener('click', function () {
      var demoEntry = window.CAE.Demos && window.CAE.Demos[moduleKey];
      if (!demoEntry || !demoEntry.prompt) {
        toast('Prompt for ' + label + ' is not loaded yet.');
        return;
      }
      copyToClipboard(demoEntry.prompt).then(function (ok) {
        if (ok) {
          toast(label + ' AI generation prompt copied to clipboard.');
        } else {
          toast('Clipboard blocked on file:// — unable to auto-copy.');
        }
      });
    });

    launchDemoBtn.addEventListener('click', function () {
      var demoEntry = window.CAE.Demos && window.CAE.Demos[moduleKey];
      if (!demoEntry || !demoEntry.demoTxt) {
        toast('Demo test for ' + label + ' is not loaded yet.');
        return;
      }
      openModule(moduleKey, demoEntry.demoTxt);
    });
  }

  /* ================= AUTO-START EXAM TIMER ================= */
  function resetTimerDisplay() {
    var el = $('ws-timer');
    if (!el) return;
    el.textContent = '00:00';
    el.classList.remove('is-paused');
    el.style.color = '';
    el.style.borderColor = '';
    el.style.background = '';
  }

  function renderTimer() {
    var el = $('ws-timer');
    if (!el) return;

    el.classList.toggle('is-paused', timer.paused);

    if (timer.durationSec > 0) {
      var remaining = timer.durationSec - timer.elapsedSec;
      if (remaining >= 0) {
        el.textContent = formatClock(remaining);
        if (timer.paused) {
          el.style.color = '';
          el.style.borderColor = '';
          el.style.background = '';
        } else if (remaining < 300) {
          el.style.color = 'var(--warn)';
          el.style.borderColor = 'var(--warn)';
          el.style.background = 'var(--warn-soft)';
        } else {
          el.style.color = '';
          el.style.borderColor = '';
          el.style.background = '';
        }
      } else {
        el.textContent = '+' + formatClock(Math.abs(remaining));
        el.style.color = 'var(--err)';
        el.style.borderColor = 'var(--err)';
        el.style.background = 'var(--err-soft)';
      }
    } else {
      el.textContent = formatClock(timer.elapsedSec);
      el.style.color = '';
      el.style.borderColor = '';
      el.style.background = '';
    }
  }

  function stopTimer() {
    if (timer.intervalId !== null) {
      clearInterval(timer.intervalId);
      timer.intervalId = null;
    }
    timer.running = false;
    timer.paused = false;
    var el = $('ws-timer');
    if (el) el.classList.remove('is-paused');
  }

  function startTimer(durationMinutes) {
    stopTimer();
    var mins = Number(durationMinutes);
    timer.durationSec = (Number.isFinite(mins) && mins > 0) ? Math.round(mins * 60) : 0;
    timer.elapsedSec = 0;
    timer.running = true;
    timer.paused = false;

    renderTimer();
    timer.intervalId = setInterval(function () {
      if (!timer.running || timer.paused) return;
      timer.elapsedSec += 1;
      renderTimer();
    }, 1000);
  }

  function toggleTimerPause() {
    if (!timer.running) return;
    timer.paused = !timer.paused;
    renderTimer();
  }

  function getElapsedSeconds() {
    return timer.elapsedSec;
  }

  /* ================= ZERO-REFLOW TEXT HIGHLIGHTER ================= */
  var IGNORED_TAGS = {
    INPUT: true,
    TEXTAREA: true,
    SELECT: true,
    OPTION: true,
    BUTTON: true,
    SCRIPT: true,
    STYLE: true
  };

  function isIgnoredElement(node) {
    var cur = (node && node.nodeType === Node.TEXT_NODE) ? node.parentElement : node;
    while (cur && cur !== document.body) {
      if (IGNORED_TAGS[cur.tagName]) return true;
      if (cur.isContentEditable) return true;
      if (cur.id === 'hl-popover' || cur.id === 'cae-exp-popover') return true;
      cur = cur.parentElement;
    }
    return false;
  }

  function closestMark(node, rootEl) {
    var cur = (node && node.nodeType === Node.TEXT_NODE) ? node.parentElement : node;
    while (cur && cur !== rootEl && cur !== document.body) {
      if (cur.tagName === 'MARK' && cur.classList.contains('cae-hl')) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function getIntersectingMarks(range, rootEl) {
    if (!range || !rootEl) return [];
    var marks = rootEl.querySelectorAll('mark.cae-hl');
    var hits = [];
    for (var i = 0; i < marks.length; i++) {
      try {
        if (range.intersectsNode(marks[i])) hits.push(marks[i]);
      } catch (_) {}
    }
    return hits;
  }

  function hideHighlightPopover() {
    var pop = $('hl-popover');
    if (pop) pop.hidden = true;
    hl.activeRange = null;
    hl.activeMark = null;
  }

  function positionHighlightPopover(rect, showApply, showRemove) {
    var pop = $('hl-popover');
    if (!pop || !rect || (rect.width === 0 && rect.height === 0)) {
      hideHighlightPopover();
      return;
    }

    var applyBtn = pop.querySelector('[data-hl-action="apply"]');
    var removeBtn = pop.querySelector('[data-hl-action="remove"]');
    if (applyBtn) applyBtn.hidden = !showApply;
    if (removeBtn) removeBtn.hidden = !showRemove;

    var centerX = rect.left + (rect.width / 2);
    var clampedX = Math.max(72, Math.min(window.innerWidth - 72, centerX));
    var topY = rect.top;

    if (topY < 56) {
      pop.style.transform = 'translate(-50%, 8px)';
      topY = rect.bottom;
    } else {
      pop.style.transform = 'translate(-50%, calc(-100% - 8px))';
    }

    pop.style.left = clampedX + 'px';
    pop.style.top = topY + 'px';
    pop.hidden = false;
  }

  function getRangeRect(range) {
    var rect = range.getBoundingClientRect();
    if (rect && (rect.width > 0 || rect.height > 0)) return rect;
    var rects = range.getClientRects();
    for (var i = 0; i < rects.length; i++) {
      if (rects[i].width > 0 || rects[i].height > 0) return rects[i];
    }
    return null;
  }

  function applyHighlightToRange(range, rootEl) {
    if (!range || range.collapsed || !rootEl) return;

    var textNodes = [];
    var common = range.commonAncestorContainer;

    if (common.nodeType === Node.TEXT_NODE) {
      if (rootEl.contains(common) && !isIgnoredElement(common) && !closestMark(common, rootEl)) {
        textNodes.push(common);
      }
    } else {
      var walker = document.createTreeWalker(
        common,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function (node) {
            if (!node.nodeValue || !node.nodeValue.length) return NodeFilter.FILTER_REJECT;
            if (!rootEl.contains(node)) return NodeFilter.FILTER_REJECT;
            if (isIgnoredElement(node)) return NodeFilter.FILTER_REJECT;
            if (closestMark(node, rootEl)) return NodeFilter.FILTER_REJECT;
            try {
              if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
            } catch (_) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        },
        false
      );

      var cur;
      while ((cur = walker.nextNode())) {
        textNodes.push(cur);
      }
    }

    textNodes.forEach(function (node) {
      var start = (node === range.startContainer) ? range.startOffset : 0;
      var end = (node === range.endContainer) ? range.endOffset : node.nodeValue.length;
      if (end <= start) return;

      var sliceText = node.nodeValue.slice(start, end);
      if (!sliceText) return;

      var target = node;
      if (end < target.nodeValue.length) {
        target.splitText(end);
      }
      if (start > 0) {
        target = target.splitText(start);
      }

      var mark = document.createElement('mark');
      mark.className = 'cae-hl';
      target.parentNode.insertBefore(mark, target);
      mark.appendChild(target);
    });
  }

  function unwrapMark(mark) {
    if (!mark || !mark.parentNode) return;
    var parent = mark.parentNode;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  }

  function handleSelectionEvaluation() {
    if (!hl.rootEl) return;
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    var text = sel.toString();
    if (!text || !text.trim()) return;

    var range = sel.getRangeAt(0);
    if (!hl.rootEl.contains(range.startContainer) || !hl.rootEl.contains(range.endContainer)) {
      hideHighlightPopover();
      return;
    }
    if (isIgnoredElement(range.startContainer) || isIgnoredElement(range.endContainer)) {
      hideHighlightPopover();
      return;
    }

    var intersecting = getIntersectingMarks(range, hl.rootEl);
    hl.activeRange = range.cloneRange();
    hl.activeMark = null;

    var rect = getRangeRect(range);
    positionHighlightPopover(rect, true, intersecting.length > 0);
  }

  function disableHighlighter() {
    hideHighlightPopover();
    if (hl.rootEl) {
      if (hl.onMouseUp) hl.rootEl.removeEventListener('mouseup', hl.onMouseUp);
      if (hl.onKeyUp) hl.rootEl.removeEventListener('keyup', hl.onKeyUp);
      if (hl.onClick) hl.rootEl.removeEventListener('click', hl.onClick);
    }
    if (hl.onDocMouseDown) document.removeEventListener('mousedown', hl.onDocMouseDown);
    if (hl.onScrollHide) window.removeEventListener('scroll', hl.onScrollHide, true);

    hl.rootEl = null;
    hl.onMouseUp = null;
    hl.onKeyUp = null;
    hl.onClick = null;
    hl.onDocMouseDown = null;
    hl.onScrollHide = null;
  }

  function enableHighlighter(rootEl) {
    disableHighlighter();
    if (!rootEl) return;

    hl.rootEl = rootEl;

    hl.onMouseUp = function (e) {
      if (isIgnoredElement(e.target)) return;
      setTimeout(handleSelectionEvaluation, 0);
    };

    hl.onKeyUp = function (e) {
      if (e.shiftKey || e.key === 'Shift') {
        handleSelectionEvaluation();
      }
    };

    hl.onClick = function (e) {
      if (isIgnoredElement(e.target)) return;
      var sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) return;

      var mark = closestMark(e.target, hl.rootEl);
      if (mark) {
        hl.activeRange = null;
        hl.activeMark = mark;
        positionHighlightPopover(mark.getBoundingClientRect(), false, true);
      } else {
        hideHighlightPopover();
      }
    };

    hl.onDocMouseDown = function (e) {
      var pop = $('hl-popover');
      if (pop && !pop.hidden && !pop.contains(e.target)) {
        hideHighlightPopover();
      }
    };

    hl.onScrollHide = function () {
      var pop = $('hl-popover');
      if (pop && !pop.hidden) hideHighlightPopover();
    };

    rootEl.addEventListener('mouseup', hl.onMouseUp);
    rootEl.addEventListener('keyup', hl.onKeyUp);
    rootEl.addEventListener('click', hl.onClick);
    document.addEventListener('mousedown', hl.onDocMouseDown);
    window.addEventListener('scroll', hl.onScrollHide, true);
  }

  function bindPopoverControls() {
    var pop = $('hl-popover');
    if (!pop) return;

    /* Preserve text selection when clicking popover buttons */
    pop.addEventListener('mousedown', function (e) {
      e.preventDefault();
    });

    pop.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-hl-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-hl-action');

      if (action === 'apply' && hl.activeRange && hl.rootEl) {
        applyHighlightToRange(hl.activeRange, hl.rootEl);
        var sel = window.getSelection();
        if (sel) sel.removeAllRanges();
        hideHighlightPopover();
      } else if (action === 'remove') {
        if (hl.activeMark) {
          unwrapMark(hl.activeMark);
        } else if (hl.activeRange && hl.rootEl) {
          var marks = getIntersectingMarks(hl.activeRange, hl.rootEl);
          marks.forEach(unwrapMark);
        }
        var s = window.getSelection();
        if (s) s.removeAllRanges();
        hideHighlightPopover();
      }
    });
  }

  /* ================= INITIALIZATION ================= */
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    var Store = window.CAE.Store;
    if (!Store) {
      console.error('CAE.Store must be loaded before CAE.Core.');
      return;
    }

    Store.applyThemeSettings();
    syncThemeControls();
    bindPopoverControls();

    /* Brand home */
    var brand = $('brand-home');
    if (brand) {
      brand.addEventListener('click', showHub);
      brand.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showHub();
        }
      });
    }

    /* Dark Mode Toggle */
    var darkBtn = $('btn-dark-toggle');
    if (darkBtn) {
      darkBtn.addEventListener('click', function () {
        var cur = Store.getSettings().dark;
        Store.setDarkMode(!cur);
        syncThemeControls();
      });
    }

    /* 5-Color Theme Selector */
    var themeSelector = $('theme-selector');
    if (themeSelector) {
      themeSelector.addEventListener('click', function (e) {
        var dot = e.target.closest('.theme-dot[data-theme-pick]');
        if (!dot) return;
        Store.setTheme(dot.getAttribute('data-theme-pick'));
        syncThemeControls();
      });
    }

    /* Export JSON */
    var exportBtn = $('btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        Store.exportJSON();
        toast('Backup exported (.json).');
      });
    }

    /* Import JSON */
    var importBtn = $('btn-import');
    var importInput = $('import-file-input');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', function () {
        importInput.value = '';
        importInput.click();
      });

      importInput.addEventListener('change', function () {
        var file = importInput.files && importInput.files[0];
        if (!file) return;
        Store.importJSON(file).then(
          function (res) {
            syncThemeControls();
            renderHub();
            toast('Imported ' + res.count + (res.count === 1 ? ' attempt.' : ' attempts.'));
          },
          function (err) {
            toast('Import failed: ' + (err && err.message ? err.message : 'Invalid file'), 4500);
          }
        );
      });
    }

    /* Hub Module Selection Cards -> Upload Gate */
    document.querySelectorAll('.module-card[data-open-module]').forEach(function (card) {
      card.addEventListener('click', function () {
        var modKey = card.getAttribute('data-open-module');
        openUploadGate(modKey);
      });
    });

    /* Recent Activity Delete Delegation */
    var actBody = $('recent-activity-body');
    if (actBody) {
      actBody.addEventListener('click', function (e) {
        var delBtn = e.target.closest('[data-delete-attempt]');
        if (!delBtn) return;
        var id = delBtn.getAttribute('data-delete-attempt');
        if (Store.deleteAttempt(id)) {
          renderHub();
          toast('Attempt deleted.');
        }
      });
    }

    /* Bottom Grade Projection Bar -> Expandable Analysis Drawer */
    var gradeToggle = $('grade-bar-toggle');
    if (gradeToggle) {
      gradeToggle.addEventListener('click', function () {
        setDrawerOpen(!state.drawerOpen);
      });
    }

    /* Advanced Analysis Prompt Button */
    var advBtn = $('btn-advanced-analysis');
    if (advBtn) {
      advBtn.addEventListener('click', handleAdvancedAnalysis);
    }

    /* Workspace Back Button & Timer Pause Toggle */
    var backBtn = $('ws-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', showHub);
    }

    var timerEl = $('ws-timer');
    if (timerEl) {
      timerEl.addEventListener('click', toggleTimerPause);
      timerEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleTimerPause();
        }
      });
    }

    /* Modal Backdrop Click & Escape Key */
    var modalRoot = $('modal-root');
    if (modalRoot) {
      modalRoot.addEventListener('click', function (e) {
        if (e.target === modalRoot) closeModal();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var mr = $('modal-root');
        if (mr && !mr.hidden) {
          closeModal();
        } else if (exp.visible) {
          hideExpPopover();
        } else {
          hideHighlightPopover();
        }
      }
    });

    /* Re-render Hub whenever store changes while Hub is visible */
    window.addEventListener('cae:store-updated', function () {
      syncThemeControls();
      if (state.currentView === 'hub') {
        renderHub();
      }
    });

    renderHub();
  }

  return {
    init: init,
    showHub: showHub,
    renderHub: renderHub,
    openModule: openModule,
    openUploadGate: openUploadGate,
    enableHighlighter: enableHighlighter,
    disableHighlighter: disableHighlighter,
    registerExplanation: registerExplanation,
    hideExplanation: hideExpPopover,
    startTimer: startTimer,
    stopTimer: stopTimer,
    toggleTimerPause: toggleTimerPause,
    getElapsedSeconds: getElapsedSeconds,
    setTopAction: setTopAction,
    setBottomNav: setBottomNav,
    setScopePill: setScopePill,
    showModal: showModal,
    closeModal: closeModal,
    copyToClipboard: copyToClipboard,
    toast: toast,
    escapeHtml: escapeHtml
  };
})();