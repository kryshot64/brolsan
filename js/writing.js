window.CAE = window.CAE || {};
window.CAE.Modules = window.CAE.Modules || {};

window.CAE.Modules.writing = (function () {
  'use strict';

  var STYLE_ID = 'cae-writing-styles';
  var TASK_KEYS = ['part1', 'part2'];

  var CRITERIA_META = [
    { key: 'content', label: 'Content', hint: 'All prompt points addressed & reader fully informed' },
    { key: 'communicative', label: 'Communicative Achievement', hint: 'Register, tone & genre conventions for target reader' },
    { key: 'organisation', label: 'Organisation', hint: 'Logical structure, paragraphing & cohesive devices' },
    { key: 'language', label: 'Language', hint: 'C1 lexical range, complex grammar & accuracy' }
  ];

  /* Active session state */
  var session = null;

  /* ================= SCOPED STYLES (INJECTED ONCE) ================= */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* Lock workspace body to viewport height for clean 40/60 split */
      '#ws-body:has(.wrt-shell) { overflow: hidden; padding: 12px 16px; }',

      '.wrt-shell { height: 100%; min-height: 0; display: flex; flex-direction: column; }',
      '.wrt-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; }',

      /* Split Layout: 40% Prompt / 60% Exam Editor */
      '.wrt-split { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 40fr) minmax(0, 60fr); gap: 14px; }',
      '.wrt-pane { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); min-height: 0; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; }',

      /* Left Prompt Pane */
      '.wrt-left { overflow-y: auto; padding: 20px 22px 28px; gap: 14px; }',
      '.wrt-opt-prompt-view { display: flex; flex-direction: column; gap: 14px; flex: 1; }',
      '.wrt-task-eyebrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }',
      '.wrt-type-pill { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-sm); background: var(--accent-soft); border: 1px solid var(--accent-border); color: var(--accent); font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }',
      '.wrt-limit-tag { font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; color: var(--text-muted); }',
      '.wrt-task-title { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -0.015em; color: var(--text); padding-bottom: 12px; border-bottom: 1px solid var(--border); line-height: 1.35; }',
      '.wrt-prompt-body { font-size: 14.5px; line-height: 1.72; color: var(--text); display: flex; flex-direction: column; gap: 11px; }',
      '.wrt-prompt-body p { margin: 0; }',
      '.wrt-prompt-list { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; }',
      '.wrt-prompt-quote { margin: 0; padding: 9px 13px; border-left: 3px solid var(--accent-border); background: var(--surface-subtle); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; font-style: italic; color: var(--text-secondary); }',
      '.wrt-prompt-tip { margin-top: auto; padding-top: 12px; border-top: 1px dashed var(--border); font-size: 12px; color: var(--text-muted); }',

      /* Right Distraction-Free Exam Editor Pane */
      '.wrt-right { overflow: hidden; }',
      '.wrt-editor-bar { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 9px 16px; border-bottom: 1px solid var(--border); background: var(--surface-subtle); }',
      '.wrt-editor-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }',
      '.wrt-editor-opt-tag { font-family: var(--font-mono); font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: var(--radius-sm); background: var(--accent-soft); border: 1px solid var(--accent-border); color: var(--accent); }',
      '.wrt-word-badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--surface); font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--text-secondary); transition: border-color 120ms ease, background-color 120ms ease, color 120ms ease; }',
      '.wrt-word-badge.is-in-range { border-color: var(--ok); background: var(--ok-soft); color: var(--ok); }',
      '.wrt-word-badge.is-out-range { border-color: var(--warn); background: var(--warn-soft); color: var(--warn); }',
      '.wrt-word-status { font-size: 11.5px; color: var(--text-muted); }',
      '.wrt-spell-toggle { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 9px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-secondary); font-family: var(--font-mono); font-size: 11px; font-weight: 600; cursor: pointer; transition: border-color 120ms ease, color 120ms ease, background-color 120ms ease; }',
      '.wrt-spell-toggle:hover { border-color: var(--accent); color: var(--text); }',
      '.wrt-spell-toggle[aria-pressed="true"] { border-color: var(--accent-border); background: var(--accent-soft); color: var(--accent); }',

      '.wrt-textarea { flex: 1; width: 100%; min-height: 0; border: 0; outline: none; resize: none; padding: 22px 26px; background: var(--surface); color: var(--text); font-family: var(--font-sans); font-size: 15.5px; line-height: 1.82; letter-spacing: 0.005em; }',
      '.wrt-textarea:focus-visible { outline: none; box-shadow: none; }',
      '.wrt-textarea::placeholder { color: var(--text-muted); opacity: 0.7; }',

      /* SEND & Input LLM Grading Modal */
      '.wrt-packaged-banner { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 9px 12px; border-radius: var(--radius); background: var(--surface-subtle); border: 1px solid var(--border-strong); font-size: 12.5px; }',
      '.wrt-packaged-pill { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; color: var(--accent); }',
      '.wrt-packaged-note { font-size: 11.5px; color: var(--warn); font-weight: 500; }',
      '.wrt-modal-notice { padding: 11px 13px; border-radius: var(--radius); background: var(--accent-soft); border: 1px solid var(--accent-border); color: var(--text); font-size: 13px; line-height: 1.5; display: flex; flex-direction: column; gap: 8px; }',
      '.wrt-modal-notice-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }',
      '.wrt-scope-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 4px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-subtle); }',
      '.wrt-scope-btn { height: 30px; border: 1px solid transparent; border-radius: var(--radius-sm); background: transparent; color: var(--text-secondary); font-family: var(--font-mono); font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 110ms ease; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 6px; }',
      '.wrt-scope-btn:hover { color: var(--text); }',
      '.wrt-scope-btn.is-active { background: var(--surface); border-color: var(--accent-border); color: var(--accent); box-shadow: var(--shadow-sm); }',

      '.wrt-grade-block { border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; background: var(--surface-subtle); display: flex; flex-direction: column; gap: 10px; }',
      '.wrt-grade-block-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }',
      '.wrt-grade-block-title { font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; letter-spacing: 0.05em; color: var(--text); }',
      '.wrt-grade-block-sum { font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--accent); }',

      '.wrt-crit-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px 12px; }',
      '.wrt-crit-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }',
      '.wrt-crit-name { font-size: 13px; font-weight: 600; color: var(--text); }',
      '.wrt-crit-hint { font-size: 11px; color: var(--text-muted); line-height: 1.3; }',
      '.wrt-score-pills { display: inline-flex; align-items: center; gap: 4px; }',
      '.wrt-score-pill { width: 30px; height: 28px; padding: 0; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-secondary); font-family: var(--font-mono); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 100ms ease; }',
      '.wrt-score-pill:hover { border-color: var(--accent); color: var(--accent); }',
      '.wrt-score-pill.is-selected { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }',

      '.wrt-live-projection { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-radius: var(--radius); border: 1px solid var(--border-strong); background: var(--surface); }',
      '.wrt-live-proj-label { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: var(--text-muted); }',
      '.wrt-live-proj-val { font-family: var(--font-mono); font-size: 14px; font-weight: 700; color: var(--accent); }',

      '.wrt-mistakes-label { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--text); }',
      '.wrt-mistakes-sub { font-size: 11px; font-weight: 400; color: var(--text-muted); }',
      '.wrt-mistakes-ta { min-height: 82px; font-family: var(--font-mono); font-size: 12px; line-height: 1.5; }',

      /* Parse Error Panel */
      '.wrt-error-card { max-width: 720px; margin: 20px auto; background: var(--surface); border: 1px solid var(--err); border-radius: var(--radius-lg); padding: 22px 24px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow-sm); }',
      '.wrt-error-title { margin: 0; font-family: var(--font-mono); font-size: 13px; font-weight: 700; letter-spacing: 0.06em; color: var(--err); }',
      '.wrt-error-msg { margin: 0; font-size: 14px; color: var(--text); line-height: 1.55; }',
      '.wrt-error-spec { margin: 0; padding: 12px 14px; border-radius: var(--radius); background: var(--surface-subtle); border: 1px solid var(--border); font-family: var(--font-mono); font-size: 11.5px; line-height: 1.55; color: var(--text-secondary); overflow-x: auto; white-space: pre-wrap; }',

      '@media (max-width: 920px) {',
      '  #ws-body:has(.wrt-shell) { overflow-y: auto; }',
      '  .wrt-shell { height: auto; }',
      '  .wrt-split { grid-template-columns: 1fr; }',
      '  .wrt-left { overflow-y: visible; }',
      '  .wrt-textarea { min-height: 360px; }',
      '}',
      '@media (max-width: 560px) {',
      '  .wrt-crit-row { grid-template-columns: 1fr; }',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ================= HELPERS ================= */
  function esc(str) {
    if (window.CAE.Core && typeof window.CAE.Core.escapeHtml === 'function') {
      return window.CAE.Core.escapeHtml(str);
    }
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function countWords(text) {
    var trimmed = String(text || '').trim();
    if (!trimmed) return 0;
    var tokens = trimmed.split(/\s+/).filter(function (tok) {
      return /[A-Za-z0-9\u00C0-\u024F]/.test(tok);
    });
    return tokens.length;
  }

  function parseWordLimit(rawLimit) {
    var fallback = { min: 220, max: 260, label: '220–260' };
    if (!rawLimit) return fallback;
    var m = String(rawLimit).match(/(\d+)\s*[-–—to]+\s*(\d+)/i);
    if (!m) return fallback;
    var min = parseInt(m[1], 10);
    var max = parseInt(m[2], 10);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return fallback;
    return { min: min, max: max, label: min + '–' + max };
  }

  function formatOptionCode(opt) {
    return 'Q' + opt.qNum + ': ' + opt.type;
  }

  function renderPromptMarkup(rawPrompt) {
    var lines = String(rawPrompt || '').replace(/\r\n?/g, '\n').split('\n');
    var blocks = [];
    var listBuf = [];

    function flushList() {
      if (!listBuf.length) return;
      blocks.push(
        '<ul class="wrt-prompt-list">' +
          listBuf.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') +
        '</ul>'
      );
      listBuf = [];
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) {
        flushList();
        continue;
      }

      var bulletMatch = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (bulletMatch) {
        listBuf.push(bulletMatch[1].trim());
        continue;
      }

      flushList();

      if (/^["'\u201C].*["'\u201D]$/.test(line)) {
        blocks.push('<blockquote class="wrt-prompt-quote">' + esc(line) + '</blockquote>');
      } else {
        blocks.push('<p>' + esc(line) + '</p>');
      }
    }
    flushList();

    return blocks.join('');
  }

  /* ================= BACKWARD-COMPATIBLE MULTI-OPTION .TXT PARSER ================= */
  function parseTaskBlock(rawBody, taskLabel, requireType, fallbackType) {
    var lines = rawBody.replace(/\r\n?/g, '\n').split('\n');
    var type = requireType ? (fallbackType || '') : 'Essay';
    var title = '';
    var wordLimitRaw = '';
    var promptLines = [];
    var inPrompt = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();

      var wlMatch = trimmed.match(/^WORD[_\s-]*LIMIT\s*:\s*(.*)$/i);
      if (wlMatch) {
        wordLimitRaw = wlMatch[1].trim();
        inPrompt = false;
        continue;
      }

      if (!inPrompt) {
        if (!trimmed) continue;

        var typeMatch = trimmed.match(/^TYPE\s*:\s*(.*)$/i);
        if (typeMatch) {
          type = typeMatch[1].trim();
          continue;
        }

        var titleMatch = trimmed.match(/^TITLE\s*:\s*(.*)$/i);
        if (titleMatch) {
          title = titleMatch[1].trim();
          continue;
        }

        var promptMatch = trimmed.match(/^PROMPT\s*:\s*(.*)$/i);
        if (promptMatch) {
          inPrompt = true;
          if (promptMatch[1].trim()) {
            promptLines.push(promptMatch[1].trim());
          }
          continue;
        }

        /* Tolerate prose written directly without explicit PROMPT: tag */
        inPrompt = true;
        promptLines.push(line);
      } else {
        promptLines.push(line);
      }
    }

    var promptText = promptLines.join('\n').trim();
    if (!promptText) {
      return { error: taskLabel + ': Missing or empty "PROMPT:" section.' };
    }

    if (requireType && !type) {
      type = 'Situational Task';
    }

    var wl = parseWordLimit(wordLimitRaw);
    return {
      type: type,
      title: title || (taskLabel + ' — ' + type),
      prompt: promptText,
      wordLimit: wl
    };
  }

  function parseWritingText(rawTxt) {
    var text = String(rawTxt || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (!text.trim()) {
      return { error: 'The uploaded file is empty. Expected === TASK 1: ESSAY === and === TASK 2 === (or === TASK 2: OPTION 1 === ...).' };
    }

    var headerRe = /^\s*===\s*TASK\s*(1|2)(?:\s*:\s*([^=\n]+?))?\s*===\s*$/gim;
    var matches = [];
    var m;
    while ((m = headerRe.exec(text)) !== null) {
      matches.push({
        taskNum: m[1],
        suffix: (m[2] || '').trim(),
        start: m.index,
        contentStart: m.index + m[0].length
      });
    }

    if (!matches.length) {
      return { error: 'No section headers found. Expected === TASK 1: ESSAY === and === TASK 2 === (or === TASK 2: OPTION 1 === ...).' };
    }

    var task1Raw = null;
    var task2Entries = [];

    for (var i = 0; i < matches.length; i++) {
      var cur = matches[i];
      var nextStart = (i + 1 < matches.length) ? matches[i + 1].start : text.length;
      var body = text.slice(cur.contentStart, nextStart).trim();

      if (cur.taskNum === '1') {
        if (task1Raw !== null) {
          return { error: 'Duplicate section header found for Task 1.' };
        }
        task1Raw = body;
      } else {
        var optMatch = cur.suffix.match(/^OPTION\s*(\d+)(?:\s*[:\-–(]\s*([^)]+)\)?)?$/i);
        var optNum = optMatch ? parseInt(optMatch[1], 10) : (task2Entries.length + 1);
        var headerHintType = '';
        if (optMatch && optMatch[2]) {
          headerHintType = optMatch[2].trim();
        } else if (!optMatch && cur.suffix) {
          headerHintType = cur.suffix;
        }
        task2Entries.push({
          optNum: optNum,
          headerHintType: headerHintType,
          raw: body
        });
      }
    }

    if (task1Raw === null) {
      return { error: 'Missing required section header "=== TASK 1: ESSAY ===".' };
    }
    if (!task2Entries.length) {
      return { error: 'Missing required Part 2 header ("=== TASK 2 ===" or "=== TASK 2: OPTION 1 ===").' };
    }

    var p1 = parseTaskBlock(task1Raw, 'Task 1 (Essay)', false, 'Essay');
    if (p1.error) return { error: p1.error };

    var part2Options = [];
    for (var k = 0; k < task2Entries.length; k++) {
      var entry = task2Entries[k];
      var label = task2Entries.length > 1
        ? ('Task 2 · Option ' + entry.optNum)
        : 'Task 2';
      var parsedOpt = parseTaskBlock(entry.raw, label, true, entry.headerHintType);
      if (parsedOpt.error) return { error: parsedOpt.error };

      parsedOpt.optNum = entry.optNum;
      parsedOpt.qNum = 2 + k; /* Official CAE numbering: Q2, Q3, Q4 (and Q5 if 4 options) */
      part2Options.push(parsedOpt);
    }

    return {
      part1: p1,
      part2Options: part2Options
    };
  }

  /* ================= SMART PART 2 SELECTION & GRADING PACKAGE ================= */
  function resolveChosenPart2() {
    var options = session.parsed.part2Options;
    var activeIdx = session.activePart2Index;
    var activeWords = countWords(session.drafts.task2[activeIdx]);

    if (activeWords > 0) {
      return {
        index: activeIdx,
        option: options[activeIdx],
        draft: session.drafts.task2[activeIdx] || '',
        words: activeWords,
        autoSwitched: false,
        viewedOption: options[activeIdx]
      };
    }

    /* Safeguard: viewed option is blank -> pick non-empty option with highest word count */
    var bestIdx = -1;
    var bestWords = 0;
    for (var i = 0; i < options.length; i++) {
      var w = countWords(session.drafts.task2[i]);
      if (w > bestWords) {
        bestWords = w;
        bestIdx = i;
      }
    }

    if (bestIdx !== -1) {
      return {
        index: bestIdx,
        option: options[bestIdx],
        draft: session.drafts.task2[bestIdx] || '',
        words: bestWords,
        autoSwitched: bestIdx !== activeIdx,
        viewedOption: options[activeIdx]
      };
    }

    return {
      index: activeIdx,
      option: options[activeIdx],
      draft: '',
      words: 0,
      autoSwitched: false,
      viewedOption: options[activeIdx]
    };
  }

  function buildExternalGradingPackage(chosenP2) {
    var t1 = session.parsed.part1;
    var t2 = chosenP2.option;
    var d1 = session.drafts.part1 || '';
    var d2 = chosenP2.draft || '';
    var w1 = countWords(d1);
    var w2 = chosenP2.words;

    var include1 = w1 > 0 || (w1 === 0 && w2 === 0);
    var include2 = w2 > 0 || (w1 === 0 && w2 === 0);

    var lines = [];
    lines.push('# CAMBRIDGE C1 ADVANCED (CAE) WRITING — EXAMINER GRADING REQUEST');
    lines.push('');
    lines.push('Act as a strict, certified Cambridge Assessment English C1 Advanced (CAE) Writing examiner.');
    lines.push('Assess the candidate response(s) below strictly against the official C1 Advanced Writing Assessment Scales (0–5 per subscale, maximum 20 marks per task):');
    lines.push('');
    lines.push('## OFFICIAL C1 ADVANCED ASSESSMENT SUBSCALES (0–5 EACH)');
    lines.push('- **Content (0–5):** All content is relevant to the task; target reader is fully informed (in Part 1 Essay, two notes discussed + clear reasoned decision on which is more important).');
    lines.push('- **Communicative Achievement (0–5):** Conventions of the communicative task (Essay / Proposal / Report / Review / Letter) are used with sufficient flexibility to communicate complex ideas effectively, holding the target reader\'s attention with ease.');
    lines.push('- **Organisation (0–5):** Text is a well-organised, coherent whole using a variety of cohesive devices and organisational patterns (clear topic sentences, headings where appropriate, balanced progression).');
    lines.push('- **Language (0–5):** Range of C1 vocabulary including less common lexis used effectively; range of simple and complex grammatical forms used with control and flexibility; occasional slips do not impede communication.');
    lines.push('');
    lines.push('Note: Grade honestly without grade inflation. A Band 3 is solid C1 pass (~180); Band 4 is strong C1 (~190–196); Band 5 is exceptional C2-borderline control (~200+). Penalise major under-length/over-length essays only where content or reader effect suffers.');
    lines.push('');

    if (include1) {
      lines.push('================================================================');
      lines.push('## PART 1 (Q1): ESSAY — ' + t1.title);
      lines.push('Target word limit: ' + t1.wordLimit.label + ' words');
      lines.push('');
      lines.push('### PROMPT');
      lines.push(t1.prompt);
      lines.push('');
      lines.push('### CANDIDATE RESPONSE (Word count: ' + w1 + ' words)');
      lines.push(d1.trim() ? d1.trim() : '[No response written]');
      lines.push('');
    }

    if (include2) {
      lines.push('================================================================');
      lines.push('## PART 2 (' + formatOptionCode(t2).toUpperCase() + ') — ' + t2.title);
      lines.push('Task Type: ' + t2.type);
      lines.push('Target word limit: ' + t2.wordLimit.label + ' words');
      lines.push('');
      lines.push('### PROMPT');
      lines.push(t2.prompt);
      lines.push('');
      lines.push('### CANDIDATE RESPONSE (Word count: ' + w2 + ' words)');
      lines.push(d2.trim() ? d2.trim() : '[No response written]');
      lines.push('');
    }

    lines.push('================================================================');
    lines.push('## REQUIRED OUTPUT FORMAT');
    lines.push('For each attempted task above, output:');
    lines.push('1. **Scores Table (0–5 integers only):**');
    lines.push('   - Content: X/5');
    lines.push('   - Communicative Achievement: X/5');
    lines.push('   - Organisation: X/5');
    lines.push('   - Language: X/5');
    lines.push('   - Total: XX/20');
    lines.push('2. **Brief Examiner Justification:** 2–3 sharp sentences per subscale explaining why it did not earn the next band up.');
    lines.push('3. **Key Language & Structure Mistakes (Copy-Paste Ready Bullets):**');
    lines.push('   Provide a concise bulleted list of the most important grammar, lexical, collocation, register, or structural mistakes using the format:');
    lines.push('   - "original excerpt" -> "improved C1 version" (short reason)');
    lines.push('   (Keep each bullet on one line so I can paste them directly into my error tracker.)');

    return lines.join('\n');
  }

  /* ================= PARSE LLM MISTAKES FOR STORE ================= */
  function parsePastedMistakes(rawText, scope, chosenP2) {
    var lines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n');
    var p2Label = formatOptionCode(chosenP2.option);
    var partTag = scope === 'part1'
      ? 'Part 1 (Essay)'
      : scope === 'part2'
        ? ('Part 2 (' + p2Label + ')')
        : ('Writing (Essay + ' + p2Label + ')');

    var titleContext = scope === 'part1'
      ? session.parsed.part1.title
      : scope === 'part2'
        ? chosenP2.option.title
        : (session.parsed.part1.title + ' / ' + chosenP2.option.title);

    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var clean = lines[i].trim().replace(/^(?:[-*•]+|\d+[.)])\s*/, '').trim();
      if (!clean) continue;

      var arrowMatch = clean.match(/^(.+?)\s*(?:->|=>|→)\s*(.+)$/);
      if (arrowMatch) {
        out.push({
          part: partTag,
          context: titleContext,
          userAnswer: arrowMatch[1].trim().replace(/^["']|["']$/g, ''),
          correctAnswer: arrowMatch[2].trim()
        });
      } else {
        out.push({
          part: partTag,
          context: titleContext,
          userAnswer: '(writing error)',
          correctAnswer: clean
        });
      }
    }
    return out;
  }

  /* ================= SEND BUTTON & GRADING MODAL FLOW ================= */
  function openSendModal() {
    if (!session) return;

    var chosenP2 = resolveChosenPart2();
    var w1 = countWords(session.drafts.part1);
    var w2 = chosenP2.words;
    var p2Code = formatOptionCode(chosenP2.option);

    var defaultScope = (w1 > 0 && w2 > 0)
      ? 'full'
      : (w2 > 0 && w1 === 0)
        ? 'part2'
        : (w1 > 0 && w2 === 0)
          ? 'part1'
          : session.activeTask;

    var gradingPackage = buildExternalGradingPackage(chosenP2);

    window.CAE.Core.copyToClipboard(gradingPackage).then(function (copied) {
      var formState = {
        scope: defaultScope,
        scores: {
          part1: { content: null, communicative: null, organisation: null, language: null },
          part2: { content: null, communicative: null, organisation: null, language: null }
        }
      };

      function buildCriteriaBlockHtml(taskKey, blockTitle) {
        var rows = CRITERIA_META.map(function (c) {
          var pills = [0, 1, 2, 3, 4, 5].map(function (val) {
            return (
              '<button type="button" class="wrt-score-pill" data-g-task="' + taskKey + '" data-g-crit="' + c.key + '" data-g-val="' + val + '" aria-pressed="false">' +
                val +
              '</button>'
            );
          }).join('');

          return (
            '<div class="wrt-crit-row">' +
              '<div class="wrt-crit-info">' +
                '<span class="wrt-crit-name">' + esc(c.label) + '</span>' +
                '<span class="wrt-crit-hint">' + esc(c.hint) + '</span>' +
              '</div>' +
              '<div class="wrt-score-pills" role="group" aria-label="' + esc(blockTitle + ' ' + c.label) + '">' +
                pills +
              '</div>' +
            '</div>'
          );
        }).join('');

        return (
          '<div class="wrt-grade-block" data-grade-block="' + taskKey + '">' +
            '<div class="wrt-grade-block-head">' +
              '<span class="wrt-grade-block-title">' + esc(blockTitle) + '</span>' +
              '<span class="wrt-grade-block-sum" data-block-sum="' + taskKey + '">— / 20</span>' +
            '</div>' +
            rows +
          '</div>'
        );
      }

      var copyNoticeStatus = copied
        ? 'Copied automatically.'
        : 'Clipboard access was blocked on file:// — expand or copy from the box below.';

      var packagedBannerHtml =
        '<div class="wrt-packaged-banner">' +
          '<span class="wrt-packaged-pill">PACKAGED PART 2: ' + esc(p2Code.toUpperCase()) + ' (' + w2 + 'w)</span>' +
          (chosenP2.autoSwitched
            ? '<span class="wrt-packaged-note">Auto-selected (highest word count; ' + esc(formatOptionCode(chosenP2.viewedOption)) + ' was blank)</span>'
            : '<span class="muted-note" style="font-size:11.5px;">' + esc(chosenP2.option.title) + '</span>') +
        '</div>';

      var bodyHtml =
        packagedBannerHtml +
        '<div class="wrt-modal-notice">' +
          '<div><strong>Your essay + prompt have been copied to your clipboard. Paste them into your preferred LLM to get graded, then enter the scores below.</strong></div>' +
          '<div class="wrt-modal-notice-bar">' +
            '<span class="muted-note" id="wrt-copy-status">' + esc(copyNoticeStatus) + '</span>' +
            '<div style="display:flex;gap:6px;">' +
              '<button type="button" class="btn btn-sm" id="wrt-btn-copy-again">Copy Again</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" id="wrt-btn-toggle-pkg">' + (copied ? 'View Prompt' : 'Hide Prompt') + '</button>' +
            '</div>' +
          '</div>' +
          '<textarea class="modal-fallback-textarea" id="wrt-pkg-fallback" readonly' + (copied ? ' hidden' : '') + '>' + esc(gradingPackage) + '</textarea>' +
        '</div>' +

        '<div style="display:flex;flex-direction:column;gap:6px;">' +
          '<div class="mono" style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:var(--text-muted);">LOG GRADE FOR</div>' +
          '<div class="wrt-scope-tabs" role="tablist">' +
            '<button type="button" class="wrt-scope-btn" data-grade-scope="part1">Task 1 · Essay</button>' +
            '<button type="button" class="wrt-scope-btn" data-grade-scope="part2" title="' + esc('Task 2 · ' + p2Code) + '">Task 2 · ' + esc(p2Code) + '</button>' +
            '<button type="button" class="wrt-scope-btn" data-grade-scope="full">Both Tasks</button>' +
          '</div>' +
        '</div>' +

        buildCriteriaBlockHtml('part1', 'PART 1 · ESSAY (' + w1 + ' words)') +
        buildCriteriaBlockHtml('part2', 'PART 2 · ' + p2Code.toUpperCase() + ' (' + w2 + ' words)') +

        '<div class="wrt-live-projection">' +
          '<span class="wrt-live-proj-label">LIVE CAMBRIDGE PROJECTION</span>' +
          '<span class="wrt-live-proj-val" id="wrt-live-proj">Select all 4 criteria</span>' +
        '</div>' +

        '<div style="display:flex;flex-direction:column;gap:6px;">' +
          '<label class="wrt-mistakes-label" for="wrt-mistakes-input">' +
            '<span>Paste Key Mistakes from LLM</span>' +
            '<span class="wrt-mistakes-sub">Optional · Included in Hub Advanced Analysis</span>' +
          '</label>' +
          '<textarea class="field-textarea wrt-mistakes-ta" id="wrt-mistakes-input" placeholder="- &quot;make a research&quot; -> &quot;conduct research&quot; (collocation)&#10;- Informal contractions used in formal essay"></textarea>' +
        '</div>';

      function saveAttempt(returnToHub, cardEl) {
        var activeTasks = formState.scope === 'full' ? ['part1', 'part2'] : [formState.scope];
        var incomplete = activeTasks.some(function (tk) {
          return CRITERIA_META.some(function (c) { return formState.scores[tk][c.key] === null; });
        });

        if (incomplete) {
          window.CAE.Core.toast('Select a score (0–5) for all 4 assessment criteria before saving.');
          return false;
        }

        var earned = 0;
        var possible = 0;
        var breakdown = {};

        activeTasks.forEach(function (tk) {
          var s = formState.scores[tk];
          var tSum = s.content + s.communicative + s.organisation + s.language;
          earned += tSum;
          possible += 20;
          breakdown[tk] = { earned: tSum, possible: 20 };
        });

        var writingCriteria;
        if (formState.scope === 'full') {
          var s1 = formState.scores.part1;
          var s2 = formState.scores.part2;
          writingCriteria = {
            content: Math.round(((s1.content + s2.content) / 2) * 10) / 10,
            communicative: Math.round(((s1.communicative + s2.communicative) / 2) * 10) / 10,
            organisation: Math.round(((s1.organisation + s2.organisation) / 2) * 10) / 10,
            language: Math.round(((s1.language + s2.language) / 2) * 10) / 10
          };
        } else {
          var only = formState.scores[formState.scope];
          writingCriteria = {
            content: only.content,
            communicative: only.communicative,
            organisation: only.organisation,
            language: only.language
          };
        }

        var pct = (earned / possible) * 100;
        var cambridgeScore = window.CAE.Store.percentToCambridge(pct);
        var mistakesTa = cardEl.querySelector('#wrt-mistakes-input');
        var mistakes = parsePastedMistakes(mistakesTa ? mistakesTa.value : '', formState.scope, chosenP2);

        window.CAE.Store.recordAttempt({
          module: 'writing',
          scope: formState.scope,
          earned: earned,
          possible: possible,
          cambridgeScore: cambridgeScore,
          mistakes: mistakes,
          partBreakdown: breakdown,
          writingCriteria: writingCriteria
        });

        var gradeLabel = window.CAE.Store.getGradeLabel(cambridgeScore);
        window.CAE.Core.toast(
          'Writing grade saved: ' + earned + '/' + possible + ' · Scale ' + cambridgeScore + ' (' + gradeLabel + ')',
          4000
        );

        if (returnToHub) {
          window.CAE.Core.stopTimer();
          window.CAE.Core.closeModal();
          window.CAE.Core.showHub();
          return false;
        }
        return true;
      }

      var card = window.CAE.Core.showModal('INPUT LLM GRADING · PAPER 2 WRITING', bodyHtml, [
        {
          label: 'Cancel',
          variant: 'ghost'
        },
        {
          label: 'Save & Continue',
          variant: 'default',
          closeOnClick: true,
          onClick: function (_e, cardEl) {
            return saveAttempt(false, cardEl);
          }
        },
        {
          label: 'Save Grade to Hub',
          variant: 'primary',
          closeOnClick: true,
          onClick: function (_e, cardEl) {
            return saveAttempt(true, cardEl);
          }
        }
      ]);

      if (!card) return;

      /* Modal interactive state sync */
      function syncModalUI() {
        card.querySelectorAll('[data-grade-scope]').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-grade-scope') === formState.scope);
        });

        var show1 = formState.scope === 'part1' || formState.scope === 'full';
        var show2 = formState.scope === 'part2' || formState.scope === 'full';

        var blk1 = card.querySelector('[data-grade-block="part1"]');
        var blk2 = card.querySelector('[data-grade-block="part2"]');
        if (blk1) blk1.hidden = !show1;
        if (blk2) blk2.hidden = !show2;

        ['part1', 'part2'].forEach(function (tk) {
          var s = formState.scores[tk];
          var complete = CRITERIA_META.every(function (c) { return s[c.key] !== null; });
          var sumEl = card.querySelector('[data-block-sum="' + tk + '"]');
          if (!sumEl) return;
          if (complete) {
            var total = s.content + s.communicative + s.organisation + s.language;
            var scale = window.CAE.Store.percentToCambridge((total / 20) * 100);
            sumEl.textContent = total + ' / 20 · Scale ' + scale;
          } else {
            var partialSum = CRITERIA_META.reduce(function (acc, c) { return acc + (s[c.key] || 0); }, 0);
            var filled = CRITERIA_META.filter(function (c) { return s[c.key] !== null; }).length;
            sumEl.textContent = filled ? (partialSum + ' / 20 (' + filled + '/4)') : '— / 20';
          }
        });

        var projEl = card.querySelector('#wrt-live-proj');
        if (!projEl) return;

        var activeTasks = formState.scope === 'full' ? ['part1', 'part2'] : [formState.scope];
        var allReady = activeTasks.every(function (tk) {
          return CRITERIA_META.every(function (c) { return formState.scores[tk][c.key] !== null; });
        });

        if (!allReady) {
          projEl.textContent = 'Select 0–5 for all criteria';
          return;
        }

        var totalEarned = activeTasks.reduce(function (sum, tk) {
          var s = formState.scores[tk];
          return sum + s.content + s.communicative + s.organisation + s.language;
        }, 0);
        var totalPossible = activeTasks.length * 20;
        var pct = Math.round((totalEarned / totalPossible) * 100);
        var scale = window.CAE.Store.percentToCambridge(pct);
        var label = window.CAE.Store.getGradeLabel(scale);
        projEl.textContent = totalEarned + '/' + totalPossible + ' (' + pct + '%) · ' + scale + ' · ' + label;
      }

      /* Scope & score pill handlers */
      card.addEventListener('click', function (e) {
        var scopeBtn = e.target.closest('[data-grade-scope]');
        if (scopeBtn) {
          formState.scope = scopeBtn.getAttribute('data-grade-scope');
          syncModalUI();
          return;
        }

        var pill = e.target.closest('.wrt-score-pill[data-g-task]');
        if (pill) {
          var tk = pill.getAttribute('data-g-task');
          var ck = pill.getAttribute('data-g-crit');
          var val = parseInt(pill.getAttribute('data-g-val'), 10);
          formState.scores[tk][ck] = val;

          var rowGroup = pill.parentElement;
          if (rowGroup) {
            rowGroup.querySelectorAll('.wrt-score-pill').forEach(function (p) {
              var isSel = p === pill;
              p.classList.toggle('is-selected', isSel);
              p.setAttribute('aria-pressed', isSel ? 'true' : 'false');
            });
          }
          syncModalUI();
        }
      });

      /* Copy Again & View Prompt fallback */
      var copyAgainBtn = card.querySelector('#wrt-btn-copy-again');
      var togglePkgBtn = card.querySelector('#wrt-btn-toggle-pkg');
      var pkgFallback = card.querySelector('#wrt-pkg-fallback');
      var copyStatusEl = card.querySelector('#wrt-copy-status');

      if (copyAgainBtn) {
        copyAgainBtn.addEventListener('click', function () {
          window.CAE.Core.copyToClipboard(gradingPackage).then(function (ok) {
            if (ok) {
              if (copyStatusEl) copyStatusEl.textContent = 'Copied to clipboard.';
              window.CAE.Core.toast('Grading prompt + response copied.');
            } else {
              if (pkgFallback) {
                pkgFallback.hidden = false;
                pkgFallback.focus();
                pkgFallback.select();
              }
              if (togglePkgBtn) togglePkgBtn.textContent = 'Hide Prompt';
              window.CAE.Core.toast('Clipboard blocked — press Ctrl+C / Cmd+C in the box.');
            }
          });
        });
      }

      if (togglePkgBtn && pkgFallback) {
        togglePkgBtn.addEventListener('click', function () {
          var nextHidden = !pkgFallback.hidden;
          pkgFallback.hidden = nextHidden;
          togglePkgBtn.textContent = nextHidden ? 'View Prompt' : 'Hide Prompt';
          if (!nextHidden) {
            pkgFallback.focus();
            pkgFallback.select();
          }
        });
      }

      syncModalUI();
    });
  }

  /* ================= LIVE WORD COUNT, OPTION TABS & NAVIGATION ================= */
  function updatePart2OptionBarBadges() {
    if (!session || !session.panels.part2) return;
    var bar = session.panels.part2.querySelector('.writing-opt-bar');
    if (!bar) return;

    session.parsed.part2Options.forEach(function (opt, idx) {
      var btn = bar.querySelector('.writing-opt-btn[data-opt-idx="' + idx + '"]');
      if (!btn) return;
      var words = countWords(session.drafts.task2[idx]);
      var badge = btn.querySelector('[data-opt-badge="' + idx + '"]');
      var isActive = idx === session.activePart2Index;
      var inRange = words >= opt.wordLimit.min && words <= opt.wordLimit.max;

      btn.classList.toggle('is-active', isActive);
      btn.classList.toggle('has-draft', words > 0);
      btn.classList.toggle('is-in-range', inRange);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');

      if (badge) {
        if (words > 0) {
          badge.textContent = words + 'w';
          badge.hidden = false;
        } else {
          badge.textContent = '';
          badge.hidden = true;
        }
      }
    });
  }

  function updateWordCounterUI(taskKey) {
    if (!session || !session.panels[taskKey]) return;

    var text, wl, baseNavLabel;
    if (taskKey === 'part1') {
      text = session.drafts.part1 || '';
      wl = session.parsed.part1.wordLimit;
      baseNavLabel = 'Part 1: Essay';
    } else {
      var activeOpt = session.parsed.part2Options[session.activePart2Index];
      text = session.drafts.task2[session.activePart2Index] || '';
      wl = activeOpt.wordLimit;
      baseNavLabel = 'Part 2: ' + activeOpt.type;
    }

    var words = countWords(text);
    var panel = session.panels[taskKey];
    var badge = panel.querySelector('[data-word-badge="' + taskKey + '"]');
    var status = panel.querySelector('[data-word-status="' + taskKey + '"]');

    if (badge) {
      badge.textContent = words + ' / ' + wl.label + ' words';
      badge.classList.remove('is-in-range', 'is-out-range');
      if (words > 0) {
        if (words >= wl.min && words <= wl.max) {
          badge.classList.add('is-in-range');
        } else {
          badge.classList.add('is-out-range');
        }
      }
    }

    if (status) {
      if (words === 0) {
        status.textContent = 'Target ' + wl.label + ' words';
      } else if (words < wl.min) {
        status.textContent = (wl.min - words) + ' under target';
      } else if (words > wl.max) {
        status.textContent = (words - wl.max) + ' over target';
      } else {
        status.textContent = 'Within exam range';
      }
    }

    if (taskKey === 'part2') {
      updatePart2OptionBarBadges();
    }

    /* Update bottom nav label with active genre & live word count */
    var nav = document.getElementById('ws-bottom-nav');
    if (nav) {
      var btn = nav.querySelector('.ws-part-tab[data-part-id="' + taskKey + '"]');
      if (btn) {
        btn.textContent = baseNavLabel + ' (' + words + 'w)';
        btn.classList.toggle('is-done', words >= wl.min && words <= wl.max);
      }
    }
  }

  function bindHighlighterForActiveView() {
    if (!session || !window.CAE.Core) return;
    var panel = session.panels[session.activeTask];
    if (!panel) return;

    if (session.activeTask === 'part2') {
      var activePromptView = panel.querySelector('[data-opt-prompt="' + session.activePart2Index + '"]');
      if (activePromptView) {
        window.CAE.Core.enableHighlighter(activePromptView);
        return;
      }
    }

    var leftPane = panel.querySelector('.wrt-left');
    if (leftPane) {
      window.CAE.Core.enableHighlighter(leftPane);
    }
  }

  function selectPart2Option(idx, shouldFocusEditor) {
    if (!session || !session.panels.part2) return;
    var options = session.parsed.part2Options;
    if (idx < 0 || idx >= options.length) return;

    session.activePart2Index = idx;
    var opt = options[idx];
    var panel = session.panels.part2;

    /* Swap left-pane prompt view without destroying highlights on other options */
    panel.querySelectorAll('[data-opt-prompt]').forEach(function (viewEl) {
      viewEl.hidden = parseInt(viewEl.getAttribute('data-opt-prompt'), 10) !== idx;
    });

    /* Swap right-pane editor to this option's independent draft */
    var ta = panel.querySelector('textarea[data-wrt-editor="part2"]');
    if (ta) {
      ta.value = session.drafts.task2[idx] || '';
      ta.placeholder = 'Write your ' + opt.type + ' here (' + opt.wordLimit.label + ' words)...';
      ta.setAttribute('aria-label', 'Part 2 ' + formatOptionCode(opt) + ' editor');
    }

    var optTag = panel.querySelector('[data-p2-editor-tag]');
    if (optTag) {
      optTag.textContent = formatOptionCode(opt).toUpperCase();
    }

    updateWordCounterUI('part2');
    if (session.activeTask === 'part2') {
      bindHighlighterForActiveView();
      if (shouldFocusEditor && ta) ta.focus();
    }
  }

  function switchTask(taskKey) {
    if (!session || !session.panels[taskKey]) return;
    session.activeTask = taskKey;

    TASK_KEYS.forEach(function (tk) {
      session.panels[tk].hidden = (tk !== taskKey);
    });

    var nav = document.getElementById('ws-bottom-nav');
    if (nav) {
      nav.querySelectorAll('.ws-part-tab').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-part-id') === taskKey);
      });
    }

    bindHighlighterForActiveView();

    var ta = session.panels[taskKey].querySelector('textarea[data-wrt-editor]');
    if (ta) ta.focus();
  }

  /* ================= PANEL BUILDERS ================= */
  function buildPart1Panel(taskData) {
    var panel = document.createElement('section');
    panel.className = 'wrt-panel';
    panel.setAttribute('data-wrt-panel', 'part1');

    var placeholder = 'Write your C1 Advanced Essay here (' + taskData.wordLimit.label + ' words)...';

    panel.innerHTML =
      '<div class="wrt-split">' +
        '<aside class="wrt-pane wrt-left" aria-label="Task 1 prompt">' +
          '<div class="wrt-task-eyebrow">' +
            '<span class="wrt-type-pill">PART 1 · COMPULSORY ESSAY</span>' +
            '<span class="wrt-limit-tag">' + esc(taskData.wordLimit.label) + ' words</span>' +
          '</div>' +
          '<h3 class="wrt-task-title">' + esc(taskData.title) + '</h3>' +
          '<div class="wrt-prompt-body">' + renderPromptMarkup(taskData.prompt) + '</div>' +
          '<div class="wrt-prompt-tip">Tip: Select any key requirement above to highlight it before drafting.</div>' +
        '</aside>' +
        '<div class="wrt-pane wrt-right">' +
          '<div class="wrt-editor-bar">' +
            '<div class="wrt-editor-meta">' +
              '<span class="wrt-word-badge" data-word-badge="part1">0 / ' + esc(taskData.wordLimit.label) + ' words</span>' +
              '<span class="wrt-word-status" data-word-status="part1">Target ' + esc(taskData.wordLimit.label) + ' words</span>' +
            '</div>' +
            '<button type="button" class="wrt-spell-toggle" data-spell-toggle="part1" aria-pressed="false" title="Toggle browser spellcheck (disabled by default to mirror official CAE exam)">' +
              'Spellcheck: OFF' +
            '</button>' +
          '</div>' +
          '<textarea class="wrt-textarea" data-wrt-editor="part1" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="sentences" placeholder="' + esc(placeholder) + '" aria-label="Part 1 Compulsory Essay editor"></textarea>' +
        '</div>' +
      '</div>';

    return panel;
  }

  function buildPart2Panel(options) {
    var panel = document.createElement('section');
    panel.className = 'wrt-panel';
    panel.setAttribute('data-wrt-panel', 'part2');

    var firstOpt = options[0];
    var hasMultiple = options.length > 1;

    var optionBarHtml = hasMultiple
      ? '<div class="writing-opt-bar" role="tablist" aria-label="Part 2 exam options">' +
          options.map(function (opt, idx) {
            return (
              '<button type="button" class="writing-opt-btn' + (idx === 0 ? ' is-active' : '') + '" ' +
                'role="tab" aria-selected="' + (idx === 0 ? 'true' : 'false') + '" data-opt-idx="' + idx + '">' +
                '<span class="writing-opt-qnum">Q' + opt.qNum + ':</span>' +
                '<span>' + esc(opt.type) + '</span>' +
                '<span class="writing-opt-badge" data-opt-badge="' + idx + '" hidden></span>' +
              '</button>'
            );
          }).join('') +
        '</div>'
      : '';

    var promptViewsHtml = options.map(function (opt, idx) {
      var pillText = hasMultiple
        ? ('PART 2 · ' + formatOptionCode(opt).toUpperCase())
        : ('PART 2 · ' + opt.type.toUpperCase());

      return (
        '<div class="wrt-opt-prompt-view" data-opt-prompt="' + idx + '"' + (idx === 0 ? '' : ' hidden') + '>' +
          '<div class="wrt-task-eyebrow">' +
            '<span class="wrt-type-pill">' + esc(pillText) + '</span>' +
            '<span class="wrt-limit-tag">' + esc(opt.wordLimit.label) + ' words</span>' +
          '</div>' +
          '<h3 class="wrt-task-title">' + esc(opt.title) + '</h3>' +
          '<div class="wrt-prompt-body">' + renderPromptMarkup(opt.prompt) + '</div>' +
          '<div class="wrt-prompt-tip">' +
            (hasMultiple
              ? 'Choose ONE Part 2 option to write. Drafts are saved separately per option while you browse.'
              : 'Tip: Select any key requirement above to highlight it before drafting.') +
          '</div>' +
        '</div>'
      );
    }).join('');

    var placeholder = 'Write your ' + firstOpt.type + ' here (' + firstOpt.wordLimit.label + ' words)...';

    panel.innerHTML =
      '<div class="wrt-split">' +
        '<aside class="wrt-pane wrt-left" aria-label="Task 2 prompt">' +
          optionBarHtml +
          promptViewsHtml +
        '</aside>' +
        '<div class="wrt-pane wrt-right">' +
          '<div class="wrt-editor-bar">' +
            '<div class="wrt-editor-meta">' +
              (hasMultiple ? '<span class="wrt-editor-opt-tag" data-p2-editor-tag>' + esc(formatOptionCode(firstOpt).toUpperCase()) + '</span>' : '') +
              '<span class="wrt-word-badge" data-word-badge="part2">0 / ' + esc(firstOpt.wordLimit.label) + ' words</span>' +
              '<span class="wrt-word-status" data-word-status="part2">Target ' + esc(firstOpt.wordLimit.label) + ' words</span>' +
            '</div>' +
            '<button type="button" class="wrt-spell-toggle" data-spell-toggle="part2" aria-pressed="false" title="Toggle browser spellcheck (disabled by default to mirror official CAE exam)">' +
              'Spellcheck: OFF' +
            '</button>' +
          '</div>' +
          '<textarea class="wrt-textarea" data-wrt-editor="part2" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="sentences" placeholder="' + esc(placeholder) + '" aria-label="Part 2 ' + esc(formatOptionCode(firstOpt)) + ' editor"></textarea>' +
        '</div>' +
      '</div>';

    return panel;
  }

  /* ================= PARSE ERROR VIEW ================= */
  function renderParseError(containerEl, errorMsg) {
    window.CAE.Core.stopTimer();
    window.CAE.Core.setTopAction(null);
    window.CAE.Core.setBottomNav([]);
    window.CAE.Core.setScopePill('Parse Error');

    var specSample = [
      '=== TASK 1: ESSAY ===',
      'TITLE: Urban Public Spaces',
      'PROMPT:',
      'Your class has watched a panel discussion on how cities should invest in public spaces...',
      '- green parks',
      '- cultural venues',
      '- pedestrian zones',
      '"Parks improve mental health more than anything else."',
      'WORD_LIMIT: 220-260',
      '',
      '=== TASK 2: OPTION 1 ===',
      'TYPE: Proposal',
      'TITLE: Campus Sustainability Initiative',
      'PROMPT:',
      'Your college director has invited students to submit proposals...',
      'WORD_LIMIT: 220-260',
      '',
      '=== TASK 2: OPTION 2 ===',
      'TYPE: Report',
      'TITLE: Student Sports Facilities Evaluation',
      'PROMPT:',
      'Write a report for the university management committee...',
      'WORD_LIMIT: 220-260'
    ].join('\n');

    containerEl.innerHTML =
      '<div class="wrt-error-card" role="alert">' +
        '<h3 class="wrt-error-title">WRITING PARSE ERROR</h3>' +
        '<p class="wrt-error-msg">' + esc(errorMsg) + '</p>' +
        '<pre class="wrt-error-spec">' + esc(specSample) + '</pre>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px;">' +
          '<button type="button" class="btn btn-sm" id="wrt-err-retry">Upload Different File</button>' +
          '<button type="button" class="btn btn-primary btn-sm" id="wrt-err-hub">Back to Hub</button>' +
        '</div>' +
      '</div>';

    var retryBtn = containerEl.querySelector('#wrt-err-retry');
    var hubBtn = containerEl.querySelector('#wrt-err-hub');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        window.CAE.Core.showHub();
        window.CAE.Core.openUploadGate('writing');
      });
    }
    if (hubBtn) {
      hubBtn.addEventListener('click', function () {
        window.CAE.Core.showHub();
      });
    }
  }

  /* ================= LIFECYCLE: MOUNT & UNMOUNT ================= */
  function unmount() {
    if (!session) return;
    if (session.shell && session.onInput) {
      session.shell.removeEventListener('input', session.onInput);
    }
    if (session.shell && session.onClick) {
      session.shell.removeEventListener('click', session.onClick);
    }
    if (window.CAE.Core) {
      window.CAE.Core.stopTimer();
      window.CAE.Core.disableHighlighter();
    }
    session = null;
  }

  function mount(containerEl, rawTxt) {
    unmount();
    injectStyles();

    var parsedResult = parseWritingText(rawTxt);
    if (parsedResult.error) {
      renderParseError(containerEl, parsedResult.error);
      return;
    }

    var shell = document.createElement('div');
    shell.className = 'wrt-shell';

    var panels = {
      part1: buildPart1Panel(parsedResult.part1),
      part2: buildPart2Panel(parsedResult.part2Options)
    };

    panels.part1.hidden = false;
    panels.part2.hidden = true;
    shell.appendChild(panels.part1);
    shell.appendChild(panels.part2);

    containerEl.innerHTML = '';
    containerEl.appendChild(shell);

    session = {
      containerEl: containerEl,
      shell: shell,
      parsed: parsedResult,
      panels: panels,
      activeTask: 'part1',
      activePart2Index: 0,
      drafts: {
        part1: '',
        task2: parsedResult.part2Options.map(function () { return ''; })
      },
      spellcheck: { part1: false, part2: false },
      onInput: null,
      onClick: null
    };

    /* Live draft preservation & word counter */
    session.onInput = function (e) {
      var ta = e.target;
      if (!ta || !ta.hasAttribute('data-wrt-editor')) return;
      var tk = ta.getAttribute('data-wrt-editor');

      if (tk === 'part1') {
        session.drafts.part1 = ta.value;
      } else {
        session.drafts.task2[session.activePart2Index] = ta.value;
      }
      updateWordCounterUI(tk);
    };

    /* Delegated clicks: Part 2 option tabs & spellcheck toggle */
    session.onClick = function (e) {
      var optBtn = e.target.closest('.writing-opt-btn[data-opt-idx]');
      if (optBtn) {
        var idx = parseInt(optBtn.getAttribute('data-opt-idx'), 10);
        if (Number.isFinite(idx)) {
          selectPart2Option(idx, false);
        }
        return;
      }

      var spellBtn = e.target.closest('[data-spell-toggle]');
      if (spellBtn) {
        var tk = spellBtn.getAttribute('data-spell-toggle');
        var next = !session.spellcheck[tk];
        session.spellcheck[tk] = next;

        spellBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
        spellBtn.textContent = next ? 'Spellcheck: ON' : 'Spellcheck: OFF';

        var ta = session.panels[tk].querySelector('textarea[data-wrt-editor]');
        if (ta) {
          ta.setAttribute('spellcheck', next ? 'true' : 'false');
          ta.spellcheck = next;
          ta.focus();
        }
      }
    };

    shell.addEventListener('input', session.onInput);
    shell.addEventListener('click', session.onClick);

    /* Configure Workspace Chrome */
    var p2Count = parsedResult.part2Options.length;
    var scopeLabel = p2Count > 1
      ? ('Paper 2 · Essay + ' + p2Count + ' Options')
      : 'Paper 2 · 2 Tasks';
    window.CAE.Core.setScopePill(scopeLabel);
    window.CAE.Core.setTopAction('SEND', openSendModal);

    var firstP2 = parsedResult.part2Options[0];
    var navItems = [
      { id: 'part1', label: 'Part 1: Essay (0w)', done: false },
      { id: 'part2', label: 'Part 2: ' + firstP2.type + ' (0w)', done: false }
    ];
    window.CAE.Core.setBottomNav(navItems, 'part1', switchTask);

    /* Auto-start 90-minute official CAE Writing timer & enable prompt highlighter */
    window.CAE.Core.startTimer(90);
    bindHighlighterForActiveView();

    var initialTa = panels.part1.querySelector('textarea[data-wrt-editor]');
    if (initialTa) initialTa.focus();
  }

  return {
    mount: mount,
    unmount: unmount
  };
})();