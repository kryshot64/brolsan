window.CAE = window.CAE || {};

window.CAE.Store = (function () {
  'use strict';

  var STORAGE_KEY = 'cae_bench_v1';
  var VALID_THEMES = ['cobalt', 'emerald', 'amber', 'crimson', 'violet'];
  var VALID_MODULES = ['uoe', 'reading', 'writing'];
  var RECENCY_DECAY = 0.75;

  var MODULE_LABELS = {
    uoe: 'Use of English',
    reading: 'Reading',
    writing: 'Writing'
  };

  var PART_CATALOG = {
    uoe: {
      part1: 'Part 1 · Multiple-Choice Cloze',
      part2: 'Part 2 · Open Cloze',
      part3: 'Part 3 · Word Formation',
      part4: 'Part 4 · Key Word Transformations'
    },
    reading: {
      part5: 'Part 5 · Multiple Choice',
      part6: 'Part 6 · Cross-Text Matching',
      part7: 'Part 7 · Gapped Text',
      part8: 'Part 8 · Multiple Matching'
    },
    writing: {
      part1: 'Part 1 · Compulsory Essay',
      part2: 'Part 2 · Situational Task'
    }
  };

  var WRITING_CRITERIA_LABELS = {
    content: 'Content',
    communicative: 'Communicative Achievement',
    organisation: 'Organisation',
    language: 'Language'
  };

  function defaultState() {
    return {
      settings: { dark: false, theme: 'cobalt' },
      attempts: [],
      completedTests: {}
    };
  }

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function generateId() {
    return 'att_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function cleanOneLine(str, maxLen) {
    var cleaned = String(str == null ? '' : str).replace(/\s+/g, ' ').trim();
    if (maxLen && cleaned.length > maxLen) {
      return cleaned.slice(0, maxLen - 1).trim() + '…';
    }
    return cleaned;
  }

  function notify(action, payload) {
    try {
      window.dispatchEvent(new CustomEvent('cae:store-updated', {
        detail: { action: action, payload: payload || null }
      }));
    } catch (_) {}
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      return sanitizeState(parsed);
    } catch (_) {
      return defaultState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function sanitizeSettings(raw) {
    var s = (raw && typeof raw === 'object') ? raw : {};
    return {
      dark: s.dark === true,
      theme: VALID_THEMES.indexOf(s.theme) !== -1 ? s.theme : 'cobalt'
    };
  }

  function sanitizeCompletedTests(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    var out = {};
    Object.keys(raw).forEach(function (k) {
      var id = String(k || '').trim();
      if (!id) return;
      var entry = raw[k];
      if (!entry || typeof entry !== 'object' || entry.done !== true) return;
      var bestScore = null;
      if (entry.bestScore !== null && entry.bestScore !== undefined && Number.isFinite(Number(entry.bestScore))) {
        bestScore = clamp(Math.round(Number(entry.bestScore)), 142, 210);
      }
      var lastDate = (typeof entry.lastDate === 'string' && !isNaN(Date.parse(entry.lastDate)))
        ? entry.lastDate
        : new Date().toISOString();
      out[id] = {
        done: true,
        bestScore: bestScore,
        lastDate: lastDate
      };
    });
    return out;
  }

  function normalizePartKey(rawPart) {
    if (!rawPart) return '';
    var str = String(rawPart).trim().toLowerCase();
    var m = str.match(/part\s*([1-8])/) || str.match(/^p?([1-8])$/);
    return m ? ('part' + m[1]) : str;
  }

  function sanitizeMistake(m) {
    if (!m || typeof m !== 'object') return null;
    return {
      part: String(m.part || 'General').trim(),
      context: String(m.context || '').trim(),
      userAnswer: String(m.userAnswer != null ? m.userAnswer : '').trim(),
      correctAnswer: String(m.correctAnswer != null ? m.correctAnswer : '').trim()
    };
  }

  function sanitizeWritingCriteria(wc) {
    if (!wc || typeof wc !== 'object') return undefined;
    var keys = ['content', 'communicative', 'organisation', 'language'];
    var out = {};
    var validCount = 0;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var n = Number(wc[k]);
      if (Number.isFinite(n) && n >= 0) {
        out[k] = Math.round(n * 10) / 10;
        validCount++;
      }
    }
    return validCount === 4 ? out : undefined;
  }

  function sanitizePartBreakdown(pb, moduleName) {
    if (!pb || typeof pb !== 'object') return undefined;
    var catalog = PART_CATALOG[moduleName] || {};
    var out = {};
    var count = 0;
    Object.keys(pb).forEach(function (k) {
      var normKey = normalizePartKey(k);
      if (!catalog[normKey]) return;
      var entry = pb[k];
      if (!entry || typeof entry !== 'object') return;
      var earned = Number(entry.earned);
      var possible = Number(entry.possible);
      if (Number.isFinite(earned) && Number.isFinite(possible) && possible > 0) {
        out[normKey] = {
          earned: clamp(earned, 0, possible),
          possible: possible
        };
        count++;
      }
    });
    return count > 0 ? out : undefined;
  }

  function sanitizeAttempt(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (VALID_MODULES.indexOf(raw.module) === -1) return null;

    var possible = Number(raw.possible);
    var earned = Number(raw.earned);
    if (!Number.isFinite(possible) || possible <= 0) return null;
    if (!Number.isFinite(earned) || earned < 0) return null;

    earned = clamp(Math.round(earned * 100) / 100, 0, possible);
    var pct = (earned / possible) * 100;
    var cambridgeScore = Number.isFinite(Number(raw.cambridgeScore))
      ? clamp(Math.round(Number(raw.cambridgeScore)), 142, 210)
      : percentToCambridge(pct);

    var mistakes = Array.isArray(raw.mistakes)
      ? raw.mistakes.map(sanitizeMistake).filter(Boolean)
      : [];

    var attempt = {
      id: (typeof raw.id === 'string' && raw.id.trim()) ? raw.id.trim() : generateId(),
      date: (typeof raw.date === 'string' && !isNaN(Date.parse(raw.date)))
        ? raw.date
        : new Date().toISOString(),
      module: raw.module,
      scope: (typeof raw.scope === 'string' && raw.scope.trim()) ? raw.scope.trim() : 'full',
      earned: earned,
      possible: possible,
      cambridgeScore: cambridgeScore,
      mistakes: mistakes
    };

    var pb = sanitizePartBreakdown(raw.partBreakdown, raw.module);
    if (pb) attempt.partBreakdown = pb;

    var wc = sanitizeWritingCriteria(raw.writingCriteria);
    if (wc) attempt.writingCriteria = wc;

    return attempt;
  }

  function sanitizeState(raw) {
    if (!raw || typeof raw !== 'object') return defaultState();
    var attempts = Array.isArray(raw.attempts)
      ? raw.attempts.map(sanitizeAttempt).filter(Boolean)
      : [];
    return {
      settings: sanitizeSettings(raw.settings),
      attempts: attempts,
      completedTests: sanitizeCompletedTests(raw.completedTests)
    };
  }

  /* ================= CAMBRIDGE SCALE MATH ================= */
  /**
   * Piecewise-linear mapping to the Cambridge C1 Advanced scale:
   * 0% -> 142 | 40% -> 160 (B2) | 60% -> 180 (C1 Grade C)
   * 75% -> 193 (C1 Grade B) | 80% -> 200 (C2 Grade A) | 100% -> 210
   */
  function percentToCambridge(pct) {
    var p = Number(pct);
    if (!Number.isFinite(p)) return 142;
    p = clamp(p, 0, 100);

    var anchors = [
      [0, 142],
      [40, 160],
      [60, 180],
      [75, 193],
      [80, 200],
      [100, 210]
    ];

    for (var i = 0; i < anchors.length - 1; i++) {
      var x0 = anchors[i][0], y0 = anchors[i][1];
      var x1 = anchors[i + 1][0], y1 = anchors[i + 1][1];
      if (p <= x1) {
        var t = (p - x0) / (x1 - x0);
        return Math.round(y0 + t * (y1 - y0));
      }
    }
    return 210;
  }

  function getGradeLabel(score) {
    if (score === null || score === undefined || !Number.isFinite(Number(score))) {
      return 'No Data';
    }
    var s = Number(score);
    if (s >= 200) return 'Grade A (C2)';
    if (s >= 193) return 'Grade B (C1)';
    if (s >= 180) return 'Grade C (C1)';
    if (s >= 160) return 'Level B2';
    return 'Below B2';
  }

  /* ================= SETTINGS ================= */
  function applyThemeSettings(settings) {
    var s = settings || loadState().settings;
    var root = document.documentElement;
    root.setAttribute('data-dark', s.dark ? 'true' : 'false');
    root.setAttribute('data-theme', s.theme);
  }

  function getSettings() {
    return clone(loadState().settings);
  }

  function setDarkMode(isDark) {
    var state = loadState();
    state.settings.dark = Boolean(isDark);
    saveState(state);
    applyThemeSettings(state.settings);
    notify('settings', state.settings);
    return state.settings.dark;
  }

  function setTheme(themeName) {
    if (VALID_THEMES.indexOf(themeName) === -1) return null;
    var state = loadState();
    state.settings.theme = themeName;
    saveState(state);
    applyThemeSettings(state.settings);
    notify('settings', state.settings);
    return state.settings.theme;
  }

  /* ================= BANK TEST COMPLETION TRACKING ================= */
  function isTestCompleted(testId) {
    var id = String(testId || '').trim();
    if (!id) return false;
    var state = loadState();
    return Boolean(state.completedTests[id] && state.completedTests[id].done === true);
  }

  function getTestStatus(testId) {
    var id = String(testId || '').trim();
    if (!id) return null;
    var state = loadState();
    var entry = state.completedTests[id];
    return entry ? clone(entry) : null;
  }

  function markTestCompleted(testId, cambridgeScore) {
    var id = String(testId || '').trim();
    if (!id) return null;

    var state = loadState();
    var prev = state.completedTests[id];
    var score = (cambridgeScore !== undefined && cambridgeScore !== null && Number.isFinite(Number(cambridgeScore)))
      ? clamp(Math.round(Number(cambridgeScore)), 142, 210)
      : null;

    var bestScore = null;
    if (score !== null && prev && prev.bestScore !== null) {
      bestScore = Math.max(prev.bestScore, score);
    } else if (score !== null) {
      bestScore = score;
    } else if (prev && prev.bestScore !== null) {
      bestScore = prev.bestScore;
    }

    var nextEntry = {
      done: true,
      bestScore: bestScore,
      lastDate: new Date().toISOString()
    };

    state.completedTests[id] = nextEntry;
    saveState(state);
    notify('completedTests', { testId: id, status: nextEntry });
    return clone(nextEntry);
  }

  function toggleTestCompleted(testId) {
    var id = String(testId || '').trim();
    if (!id) return false;

    var state = loadState();
    if (state.completedTests[id] && state.completedTests[id].done === true) {
      delete state.completedTests[id];
      saveState(state);
      notify('completedTests', { testId: id, status: null });
      return false;
    }

    markTestCompleted(id, null);
    return true;
  }

  /* ================= ATTEMPTS CRUD ================= */
  function getAttempts(moduleFilter) {
    var attempts = loadState().attempts;
    if (moduleFilter && VALID_MODULES.indexOf(moduleFilter) !== -1) {
      attempts = attempts.filter(function (a) { return a.module === moduleFilter; });
    }
    return attempts.sort(function (a, b) {
      return Date.parse(b.date) - Date.parse(a.date);
    });
  }

  function recordAttempt(rawAttempt) {
    var clean = sanitizeAttempt(rawAttempt);
    if (!clean) {
      throw new Error('Invalid attempt payload: requires valid module, earned, and possible > 0.');
    }
    var state = loadState();
    state.attempts.push(clean);
    saveState(state);

    var activeId = window.CAE.Core && window.CAE.Core.activeBankTestId;
    if (typeof activeId === 'string' && activeId.indexOf(clean.module + '_') === 0) {
      var scopeLower = String(clean.scope || '').toLowerCase();
      if (clean.module === 'writing' || scopeLower.indexOf('full') !== -1) {
        markTestCompleted(activeId, clean.cambridgeScore);
      }
    }

    notify('record', clean);
    return clone(clean);
  }

  function deleteAttempt(id) {
    var state = loadState();
    var before = state.attempts.length;
    state.attempts = state.attempts.filter(function (a) { return a.id !== id; });
    if (state.attempts.length === before) return false;
    saveState(state);
    notify('delete', { id: id });
    return true;
  }

  /* ================= PROJECTION & DIAGNOSTICS ================= */
  function getProjection() {
    var allAttempts = getAttempts();
    var modules = {};
    var attemptedScores = [];
    var weakestAreas = [];
    var totalMistakes = 0;

    VALID_MODULES.forEach(function (mod) {
      var modAttempts = allAttempts.filter(function (a) { return a.module === mod; });
      var catalog = PART_CATALOG[mod];
      var parts = {};

      Object.keys(catalog).forEach(function (partKey) {
        parts[partKey] = {
          key: partKey,
          label: catalog[partKey],
          earned: 0,
          possible: 0,
          attempts: 0,
          mistakeCount: 0,
          pct: null,
          errorRate: null
        };
      });

      var weightedSum = 0;
      var totalWeight = 0;

      var critTotals = { content: 0, communicative: 0, organisation: 0, language: 0 };
      var critCount = 0;
      var critMaxSeen = 0;

      modAttempts.forEach(function (att, idx) {
        var pct = (att.earned / att.possible) * 100;
        var recencyWeight = Math.pow(RECENCY_DECAY, idx);
        var scopeConfidence = Math.sqrt(att.possible);
        var weight = recencyWeight * scopeConfidence;

        weightedSum += pct * weight;
        totalWeight += weight;

        if (att.partBreakdown) {
          Object.keys(att.partBreakdown).forEach(function (pk) {
            if (!parts[pk]) return;
            parts[pk].earned += att.partBreakdown[pk].earned;
            parts[pk].possible += att.partBreakdown[pk].possible;
            parts[pk].attempts += 1;
          });
        } else {
          var scopeKey = normalizePartKey(att.scope);
          if (parts[scopeKey]) {
            parts[scopeKey].earned += att.earned;
            parts[scopeKey].possible += att.possible;
            parts[scopeKey].attempts += 1;
          }
        }

        if (Array.isArray(att.mistakes)) {
          totalMistakes += att.mistakes.length;
          att.mistakes.forEach(function (m) {
            var mk = normalizePartKey(m.part);
            if (parts[mk]) parts[mk].mistakeCount += 1;
          });
        }

        if (mod === 'writing' && att.writingCriteria) {
          critCount += 1;
          ['content', 'communicative', 'organisation', 'language'].forEach(function (ck) {
            var val = att.writingCriteria[ck];
            critTotals[ck] += val;
            if (val > critMaxSeen) critMaxSeen = val;
          });
        }
      });

      var weightedPercent = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
      var cambridgeScore = weightedPercent !== null ? percentToCambridge(weightedPercent) : null;
      if (cambridgeScore !== null) attemptedScores.push(cambridgeScore);

      Object.keys(parts).forEach(function (pk) {
        var p = parts[pk];
        if (p.possible > 0) {
          p.pct = Math.round((p.earned / p.possible) * 1000) / 10;
          p.errorRate = Math.round((100 - p.pct) * 10) / 10;
        }
        if (mod !== 'writing' && (p.possible > 0 || p.mistakeCount > 0)) {
          weakestAreas.push({
            key: mod + ':' + pk,
            module: mod,
            part: pk,
            label: MODULE_LABELS[mod] + ' · ' + p.label,
            errorRate: p.errorRate !== null ? p.errorRate : 100,
            accuracy: p.pct,
            earned: p.earned,
            possible: p.possible,
            mistakeCount: p.mistakeCount
          });
        }
      });

      var modEntry = {
        attempted: modAttempts.length > 0,
        attemptCount: modAttempts.length,
        latestAttempt: modAttempts[0] || null,
        weightedPercent: weightedPercent,
        cambridgeScore: cambridgeScore,
        gradeLabel: getGradeLabel(cambridgeScore),
        parts: parts
      };

      if (mod === 'writing') {
        var scaleMax = critMaxSeen > 5 ? 10 : 5;
        var criteriaAverages = {
          content: critCount ? Math.round((critTotals.content / critCount) * 10) / 10 : null,
          communicative: critCount ? Math.round((critTotals.communicative / critCount) * 10) / 10 : null,
          organisation: critCount ? Math.round((critTotals.organisation / critCount) * 10) / 10 : null,
          language: critCount ? Math.round((critTotals.language / critCount) * 10) / 10 : null,
          scaleMax: scaleMax,
          sampleCount: critCount
        };
        modEntry.criteriaAverages = criteriaAverages;

        if (critCount > 0) {
          ['content', 'communicative', 'organisation', 'language'].forEach(function (ck) {
            var avg = criteriaAverages[ck];
            var pct = clamp((avg / scaleMax) * 100, 0, 100);
            var errRate = Math.round((100 - pct) * 10) / 10;
            weakestAreas.push({
              key: 'writing:' + ck,
              module: 'writing',
              part: ck,
              label: 'Writing · ' + WRITING_CRITERIA_LABELS[ck],
              errorRate: errRate,
              accuracy: Math.round(pct * 10) / 10,
              earned: avg,
              possible: scaleMax,
              mistakeCount: 0
            });
          });
        }
      }

      modules[mod] = modEntry;
    });

    var overallScore = attemptedScores.length > 0
      ? Math.round(attemptedScores.reduce(function (acc, n) { return acc + n; }, 0) / attemptedScores.length)
      : null;

    weakestAreas.sort(function (a, b) {
      if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate;
      return b.mistakeCount - a.mistakeCount;
    });

    return {
      overallScore: overallScore,
      overallGrade: getGradeLabel(overallScore),
      attemptedModuleCount: attemptedScores.length,
      totalAttempts: allAttempts.length,
      totalMistakes: totalMistakes,
      modules: modules,
      weakestAreas: weakestAreas
    };
  }

  /* ================= MODULE MISTAKE CONTEXT (TARGETED GENERATION) ================= */
  function getModuleMistakeContext(moduleKey, limit) {
    if (VALID_MODULES.indexOf(moduleKey) === -1) {
      return { count: 0, text: '' };
    }

    var maxItems = (typeof limit === 'number' && Number.isFinite(limit) && limit > 0)
      ? Math.floor(limit)
      : 18;

    var modAttempts = getAttempts(moduleKey);
    if (!modAttempts.length) {
      return { count: 0, text: '' };
    }

    if (moduleKey === 'uoe' || moduleKey === 'reading') {
      var formattedLines = [];

      for (var i = 0; i < modAttempts.length && formattedLines.length < maxItems; i++) {
        var att = modAttempts[i];
        if (!Array.isArray(att.mistakes) || !att.mistakes.length) continue;

        for (var j = 0; j < att.mistakes.length && formattedLines.length < maxItems; j++) {
          var m = att.mistakes[j];
          var partTag = cleanOneLine(m.part || 'General', 40);
          var userAns = cleanOneLine(m.userAnswer || '(blank)', 90);
          var correctAns = cleanOneLine(m.correctAnswer || '(none)', 110);
          var ctx = cleanOneLine(m.context || '', 140);

          var line = '- [' + partTag + '] Wrote "' + userAns + '" instead of "' + correctAns + '"';
          if (ctx) line += ' (Context: "' + ctx + '")';
          formattedLines.push(line);
        }
      }

      if (!formattedLines.length) {
        return { count: 0, text: '' };
      }

      var targetFocus = moduleKey === 'uoe'
        ? 'exact grammar traps, collocations, dependent prepositions, word-formation derivations, and key word transformation structures'
        : 'exact reading comprehension pitfalls, distractor types, cross-text comparison traps, cohesion links, and paraphrase mismatches';

      var lines = [
        '=== TARGETED PRACTICE: SHARPEN MY MISTAKES ===',
        'Below are my ' + formattedLines.length + ' most recent ' + MODULE_LABELS[moduleKey] + ' mistakes (newest first):',
        ''
      ].concat(formattedLines).concat([
        '',
        'TARGETING INSTRUCTIONS:',
        '- Design this new C1 Advanced test so that at least 50–60% of the questions specifically drill those ' + targetFocus + ' listed above.',
        '- Use completely fresh topics, passages, and sentences — NEVER copy or lightly reword the old sentences verbatim.',
        '- STILL strictly obey the exact .txt section headers, token syntax, and explanation tags specified above.'
      ]);

      return {
        count: formattedLines.length,
        text: lines.join('\n')
      };
    }

    var critKeys = ['content', 'communicative', 'organisation', 'language'];
    var critTotals = { content: 0, communicative: 0, organisation: 0, language: 0 };
    var critCount = 0;
    var writingMistakeLines = [];

    for (var w = 0; w < modAttempts.length; w++) {
      var wAtt = modAttempts[w];

      if (wAtt.writingCriteria) {
        critCount += 1;
        for (var c = 0; c < critKeys.length; c++) {
          var ck = critKeys[c];
          critTotals[ck] += Number(wAtt.writingCriteria[ck]) || 0;
        }
      }

      if (Array.isArray(wAtt.mistakes) && writingMistakeLines.length < maxItems) {
        for (var k = 0; k < wAtt.mistakes.length && writingMistakeLines.length < maxItems; k++) {
          var wm = wAtt.mistakes[k];
          var wPart = cleanOneLine(wm.part || 'Writing', 40);
          var wUser = cleanOneLine(wm.userAnswer || '', 110);
          var wCorr = cleanOneLine(wm.correctAnswer || '', 160);
          var wCtx = cleanOneLine(wm.context || '', 80);

          if (!wUser && !wCorr) continue;

          var wLine;
          if (wUser && wUser.toLowerCase() !== '(writing error)' && wUser.toLowerCase() !== '(blank)' && wCorr) {
            wLine = '- [' + wPart + '] "' + wUser + '" -> "' + wCorr + '"';
          } else {
            wLine = '- [' + wPart + '] ' + (wCorr || wUser);
          }
          if (wCtx) wLine += ' (Task: "' + wCtx + '")';
          writingMistakeLines.push(wLine);
        }
      }
    }

    var outLines = [
      '=== TARGETED PRACTICE: SHARPEN MY MISTAKES ===',
      'Candidate Writing history (' + modAttempts.length + (modAttempts.length === 1 ? ' logged attempt' : ' logged attempts') + '):'
    ];

    var priorityWeaknesses = [];

    if (critCount > 0) {
      outLines.push('');
      outLines.push('Average C1 Writing Rubric Scores (0–5 scale across ' + critCount + (critCount === 1 ? ' graded entry' : ' graded entries') + '):');
      for (var ci = 0; ci < critKeys.length; ci++) {
        var key = critKeys[ci];
        var avg = Math.round((critTotals[key] / critCount) * 10) / 10;
        var isWeak = avg < 4.0;
        if (isWeak) {
          priorityWeaknesses.push(WRITING_CRITERIA_LABELS[key] + ' (' + avg.toFixed(1) + '/5)');
        }
        outLines.push(
          '- ' + WRITING_CRITERIA_LABELS[key] + ': ' + avg.toFixed(1) + ' / 5' +
          (isWeak ? '  [PRIORITY WEAKNESS — below 4.0]' : '')
        );
      }
    }

    if (writingMistakeLines.length > 0) {
      outLines.push('');
      outLines.push('Most recent logged writing mistakes & examiner notes (' + writingMistakeLines.length + '):');
      outLines = outLines.concat(writingMistakeLines);
    }

    outLines.push('');
    outLines.push('TARGETING INSTRUCTIONS:');
    if (priorityWeaknesses.length > 0) {
      outLines.push('- Prioritise challenging these flagged rubric weaknesses (< 4.0/5): ' + priorityWeaknesses.join(', ') + '.');
    }
    outLines.push('- Design this new C1 Writing exam so that at least 50–60% of the task constraints, registers, and evaluative requirements specifically drill the writing weaknesses and recurring language traps listed above.');
    outLines.push('- Use completely fresh themes, scenarios, and target readers — NEVER reuse or copy previous prompts verbatim.');
    outLines.push('- STILL strictly obey the exact .txt section headers and field tags specified above.');

    var reportedCount = writingMistakeLines.length > 0
      ? writingMistakeLines.length
      : (priorityWeaknesses.length > 0 ? priorityWeaknesses.length : modAttempts.length);

    return {
      count: reportedCount,
      text: outLines.join('\n')
    };
  }

  /* ================= JSON IMPORT / EXPORT ================= */
  function exportJSON() {
    var state = loadState();
    var payload = {
      app: 'CAE Bench',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      attempts: state.attempts,
      completedTests: state.completedTests
    };
    var json = JSON.stringify(payload, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var stamp = new Date().toISOString().slice(0, 10);

    var a = document.createElement('a');
    a.href = url;
    a.download = 'cae-bench-backup-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    return json;
  }

  function validateImportPayload(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 'Backup file must contain a JSON object.';
    }
    if (!Array.isArray(parsed.attempts)) {
      return 'Invalid schema: missing "attempts" array.';
    }
    for (var i = 0; i < parsed.attempts.length; i++) {
      var a = parsed.attempts[i];
      if (!a || typeof a !== 'object') {
        return 'Invalid attempt at index ' + i + '.';
      }
      if (VALID_MODULES.indexOf(a.module) === -1) {
        return 'Invalid module "' + a.module + '" at attempt index ' + i + '.';
      }
      if (!Number.isFinite(Number(a.earned)) || Number(a.earned) < 0) {
        return 'Invalid "earned" score at attempt index ' + i + '.';
      }
      if (!Number.isFinite(Number(a.possible)) || Number(a.possible) <= 0) {
        return 'Invalid "possible" score at attempt index ' + i + '.';
      }
      if (a.mistakes !== undefined && !Array.isArray(a.mistakes)) {
        return 'Invalid "mistakes" field at attempt index ' + i + ' (must be an array).';
      }
    }
    if (parsed.settings !== undefined && (typeof parsed.settings !== 'object' || parsed.settings === null)) {
      return 'Invalid "settings" object.';
    }
    if (parsed.completedTests !== undefined && (typeof parsed.completedTests !== 'object' || parsed.completedTests === null || Array.isArray(parsed.completedTests))) {
      return 'Invalid "completedTests" object.';
    }
    return null;
  }

  function importJSON(fileOrString) {
    return new Promise(function (resolve, reject) {
      function handleRawText(text) {
        var parsed;
        try {
          parsed = JSON.parse(text);
        } catch (err) {
          reject(new Error('Could not parse JSON file: ' + err.message));
          return;
        }

        var errorMsg = validateImportPayload(parsed);
        if (errorMsg) {
          reject(new Error(errorMsg));
          return;
        }

        var nextState = sanitizeState(parsed);
        saveState(nextState);
        applyThemeSettings(nextState.settings);
        notify('import', { count: nextState.attempts.length });
        resolve({ ok: true, count: nextState.attempts.length });
      }

      if (typeof fileOrString === 'string') {
        handleRawText(fileOrString);
        return;
      }

      if (fileOrString && typeof fileOrString === 'object' && typeof FileReader !== 'undefined') {
        var reader = new FileReader();
        reader.onload = function (e) { handleRawText(String(e.target.result || '')); };
        reader.onerror = function () { reject(new Error('Failed to read the selected file.')); };
        reader.readAsText(fileOrString);
        return;
      }

      reject(new Error('No valid JSON file provided.'));
    });
  }

  /* ================= LLM DIAGNOSTIC PROMPT BUILDER ================= */
  function buildAnalysisPrompt() {
    var proj = getProjection();
    var attempts = getAttempts();
    var lines = [];

    lines.push('# CAMBRIDGE C1 ADVANCED (CAE) DIAGNOSTIC ANALYSIS REQUEST');
    lines.push('');
    lines.push('Act as a senior Cambridge C1 Advanced (CAE) examiner and diagnostic linguistics coach.');
    lines.push('Analyze my exam telemetry and complete mistake log below. Be direct, specific, and evidence-driven—do not give generic study advice.');
    lines.push('');

    lines.push('## 1. CANDIDATE SCORE PROFILE');
    lines.push('- Projected Overall Cambridge Scale: ' + (proj.overallScore !== null ? proj.overallScore + ' (' + proj.overallGrade + ')' : 'N/A'));
    lines.push('- Total Logged Attempts: ' + proj.totalAttempts + ' | Total Logged Mistakes: ' + proj.totalMistakes);

    VALID_MODULES.forEach(function (mod) {
      var m = proj.modules[mod];
      var summary = m.attempted
        ? m.cambridgeScore + ' (' + m.gradeLabel + ', weighted ' + m.weightedPercent + '% across ' + m.attemptCount + ' attempts)'
        : 'Not yet attempted';
      lines.push('- ' + MODULE_LABELS[mod] + ': ' + summary);
    });
    lines.push('');

    lines.push('## 2. SECTION & CRITERIA BREAKDOWN');
    ['uoe', 'reading'].forEach(function (mod) {
      var parts = proj.modules[mod].parts;
      Object.keys(parts).forEach(function (pk) {
        var p = parts[pk];
        if (p.possible > 0 || p.mistakeCount > 0) {
          var stat = p.possible > 0
            ? p.earned + '/' + p.possible + ' (' + p.pct + '% accuracy, ' + p.errorRate + '% error rate, ' + p.mistakeCount + ' logged mistakes)'
            : p.mistakeCount + ' logged mistakes (from full-paper attempts)';
          lines.push('- ' + MODULE_LABELS[mod] + ' ' + p.label + ': ' + stat);
        }
      });
    });

    var wCrit = proj.modules.writing.criteriaAverages;
    if (wCrit && wCrit.sampleCount > 0) {
      lines.push('- Writing 4-Criteria Averages (n=' + wCrit.sampleCount + ', scale 0–' + wCrit.scaleMax + '): '
        + 'Content ' + wCrit.content + ', '
        + 'Communicative Achievement ' + wCrit.communicative + ', '
        + 'Organisation ' + wCrit.organisation + ', '
        + 'Language ' + wCrit.language);
    }

    if (proj.weakestAreas.length > 0) {
      lines.push('');
      lines.push('### Weakest Areas (Ranked by Error Rate)');
      proj.weakestAreas.slice(0, 6).forEach(function (w, i) {
        lines.push((i + 1) + '. ' + w.label + ' — ' + w.errorRate + '% error rate');
      });
    }
    lines.push('');

    lines.push('## 3. COMPLETE MISTAKE LOG');
    var hasAnyMistake = false;

    VALID_MODULES.forEach(function (mod) {
      var modAttempts = attempts.filter(function (a) {
        return a.module === mod && Array.isArray(a.mistakes) && a.mistakes.length > 0;
      });
      if (!modAttempts.length) return;

      hasAnyMistake = true;
      lines.push('');
      lines.push('### ' + MODULE_LABELS[mod].toUpperCase());

      modAttempts.forEach(function (att) {
        var dateStr = att.date.slice(0, 10);
        lines.push('#### [' + dateStr + ' | Scope: ' + att.scope + ' | Score: ' + att.earned + '/' + att.possible + ' -> ' + att.cambridgeScore + ']');
        att.mistakes.forEach(function (m, idx) {
          lines.push(
            (idx + 1) + '. [' + m.part + '] '
            + 'Context: "' + m.context + '" | '
            + 'My Answer: "' + (m.userAnswer || '(blank)') + '" | '
            + 'Correct / Note: "' + (m.correctAnswer || '(none)') + '"'
          );
        });
      });
    });

    if (!hasAnyMistake) {
      lines.push('(No individual item mistakes have been logged yet; base your initial recommendations on the score profile above.)');
    }

    lines.push('');
    lines.push('## 4. REQUIRED OUTPUT FROM YOU');
    lines.push('1. **Error Pattern Taxonomy**: Group my mistakes by underlying linguistic or exam-technique cause (e.g., fixed collocations, dependent prepositions, word-family morphology, inversion/cleft syntax in Part 4, distractor traps in Reading Parts 5/7, register/cohesion gaps in Writing). Cite specific items from my log.');
    lines.push('2. **Highest-Leverage Bottlenecks**: Identify the top 3 recurring flaws costing me the most Cambridge Scale points toward the next grade boundary (180 Grade C -> 193 Grade B -> 200 Grade A / C2).');
    lines.push('3. **Targeted 14-Day Drill Plan**: Provide concrete, daily 30-minute exercises tailored strictly to my weak spots, including 5 custom C1 practice items modeled directly on my error patterns.');

    return lines.join('\n');
  }

  /* Apply persisted theme immediately when script executes */
  applyThemeSettings();

  return {
    STORAGE_KEY: STORAGE_KEY,
    VALID_THEMES: VALID_THEMES,
    PART_CATALOG: PART_CATALOG,
    MODULE_LABELS: MODULE_LABELS,
    WRITING_CRITERIA_LABELS: WRITING_CRITERIA_LABELS,
    getSettings: getSettings,
    setDarkMode: setDarkMode,
    setTheme: setTheme,
    applyThemeSettings: applyThemeSettings,
    isTestCompleted: isTestCompleted,
    getTestStatus: getTestStatus,
    markTestCompleted: markTestCompleted,
    toggleTestCompleted: toggleTestCompleted,
    getAttempts: getAttempts,
    recordAttempt: recordAttempt,
    deleteAttempt: deleteAttempt,
    percentToCambridge: percentToCambridge,
    getGradeLabel: getGradeLabel,
    getProjection: getProjection,
    getModuleMistakeContext: getModuleMistakeContext,
    exportJSON: exportJSON,
    importJSON: importJSON,
    buildAnalysisPrompt: buildAnalysisPrompt
  };
})();