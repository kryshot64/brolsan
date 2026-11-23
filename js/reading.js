window.CAE = window.CAE || {};
window.CAE.Modules = window.CAE.Modules || {};

window.CAE.Modules.reading = (function () {
  'use strict';

  var STYLE_ID = 'cae-reading-styles';
  var PART_KEYS = ['part5', 'part6', 'part7', 'part8'];

  var PART_META = {
    part5: {
      short: 'Part 5',
      title: 'Part 5 · Multiple Choice',
      hint: 'Read the passage and choose A, B, C, or D for each question. 2 marks each.',
      pointsPerItem: 2
    },
    part6: {
      short: 'Part 6',
      title: 'Part 6 · Cross-Text Multiple Matching',
      hint: 'Compare the extracts and select the matching writer (A–D) for each question. 2 marks each.',
      pointsPerItem: 2
    },
    part7: {
      short: 'Part 7',
      title: 'Part 7 · Gapped Text',
      hint: 'Drag paragraphs from the right into the gaps on the left (or click a card, then click a gap). One extra paragraph is not used. 2 marks each.',
      pointsPerItem: 2
    },
    part8: {
      short: 'Part 8',
      title: 'Part 8 · Multiple Matching',
      hint: 'Match each statement to the correct section using the dropdowns. 1 mark each.',
      pointsPerItem: 1
    }
  };

  /* Active session state */
  var session = null;

  /* ================= SCOPED STYLES (INJECTED ONCE) ================= */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* Lock workspace body to viewport height for true split-screen scrolling */
      '#ws-body:has(.rdg-shell) { overflow: hidden; padding: 12px 16px; }',

      '.rdg-shell { height: 100%; min-height: 0; display: flex; flex-direction: column; }',
      '.rdg-part-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; }',

      /* Compact Part Header */
      '.rdg-part-head { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 9px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }',
      '.rdg-part-head-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }',
      '.rdg-part-title { margin: 0; font-family: var(--font-mono); font-size: 12.5px; font-weight: 700; letter-spacing: 0.05em; color: var(--text); }',
      '.rdg-part-hint { margin: 0; font-size: 12px; color: var(--text-muted); }',
      '.rdg-part-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }',
      '.rdg-part-score { font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; padding: 3px 8px; border-radius: var(--radius-sm); background: var(--accent-soft); border: 1px solid var(--accent-border); color: var(--accent); }',

      /* True Split-Screen Container (54% Left / 46% Right) */
      '.rdg-split { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 54fr) minmax(0, 46fr); gap: 14px; }',
      '.rdg-pane { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow-y: auto; min-height: 0; box-shadow: var(--shadow-sm); }',
      '.rdg-left { padding: 20px 24px 28px; }',
      '.rdg-right { padding: 14px 16px 20px; }',

      /* Left Reading Passage Typography */
      '.rdg-article-title { margin: 0 0 16px; font-size: 18px; font-weight: 700; letter-spacing: -0.015em; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 10px; }',
      '.rdg-prose { font-size: 15px; line-height: 1.76; color: var(--text); }',
      '.rdg-prose p { margin: 0 0 14px; }',
      '.rdg-prose p:last-child { margin-bottom: 0; }',

      /* Labeled Texts [A]..[F] (Parts 6 & 8) */
      '.rdg-text-blocks { display: flex; flex-direction: column; gap: 14px; }',
      '.rdg-text-block { padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-subtle); }',
      '.rdg-text-block-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }',
      '.rdg-letter-badge { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: var(--radius-sm); background: var(--accent-soft); border: 1px solid var(--accent-border); color: var(--accent); font-family: var(--font-mono); font-size: 12px; font-weight: 700; flex-shrink: 0; }',
      '.rdg-text-block-heading { font-weight: 700; font-size: 13.5px; color: var(--text); }',
      '.rdg-text-block .rdg-prose { font-size: 14.5px; line-height: 1.68; }',
      '.rdg-text-block .rdg-prose p { margin: 0 0 10px; }',
      '.rdg-text-block .rdg-prose p:last-child { margin-bottom: 0; }',

      /* Explanation Badge Slot */
      '.rdg-exp-slot { display: inline-flex; align-items: center; flex-shrink: 0; }',
      '.rdg-exp-slot .cae-exp-btn { margin-left: 0; }',

      /* Part 5 & Part 6 Question Cards */
      '.rdg-q-list { display: flex; flex-direction: column; gap: 12px; }',
      '.rdg-q-card { border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; background: var(--surface); display: flex; flex-direction: column; gap: 9px; }',
      '.rdg-q-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }',
      '.rdg-q-head-right { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }',
      '.rdg-q-stem { font-size: 13.5px; font-weight: 600; color: var(--text); line-height: 1.45; }',
      '.rdg-qnum { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 21px; padding: 0 6px; margin-right: 6px; border-radius: var(--radius-sm); background: var(--surface-subtle); border: 1px solid var(--border-strong); color: var(--text-secondary); font-family: var(--font-mono); font-size: 11px; font-weight: 700; vertical-align: 1px; }',
      '.rdg-q-status { font-family: var(--font-mono); font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: var(--radius-sm); white-space: nowrap; flex-shrink: 0; }',
      '.rdg-q-status.ok { background: var(--ok-soft); color: var(--ok); }',
      '.rdg-q-status.err { background: var(--err-soft); color: var(--err); }',

      '.rdg-p5-options { display: flex; flex-direction: column; gap: 5px; }',
      '.rdg-p5-opt { display: flex; align-items: flex-start; gap: 9px; padding: 7px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-subtle); cursor: pointer; font-size: 13px; line-height: 1.42; transition: border-color 110ms ease, background-color 110ms ease; }',
      '.rdg-p5-opt:hover { border-color: var(--accent-border); background: var(--surface-hover); }',
      '.rdg-p5-opt input[type="radio"] { margin: 2px 0 0; accent-color: var(--accent); flex-shrink: 0; cursor: pointer; }',
      '.rdg-p5-opt-letter { font-family: var(--font-mono); font-weight: 700; font-size: 12px; color: var(--text-secondary); flex-shrink: 0; }',
      '.rdg-p5-opt.is-selected { border-color: var(--accent); background: var(--accent-soft); }',
      '.rdg-p5-opt.is-key-reveal { border-color: var(--ok); background: var(--ok-soft); }',

      /* Part 6 Compact Pill Selectors */
      '.rdg-p6-pills { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }',
      '.rdg-p6-pill { min-width: 42px; height: 30px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface-subtle); color: var(--text); font-family: var(--font-mono); font-size: 12.5px; font-weight: 700; cursor: pointer; transition: all 110ms ease; }',
      '.rdg-p6-pill:hover { border-color: var(--accent); color: var(--accent); }',
      '.rdg-p6-pill.is-selected { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }',
      '.rdg-p6-pill.is-correct { background: var(--ok) !important; border-color: var(--ok) !important; color: #ffffff !important; }',
      '.rdg-p6-pill.is-wrong { background: var(--err) !important; border-color: var(--err) !important; color: #ffffff !important; }',
      '.rdg-p6-pill.is-key-reveal { border-color: var(--ok); background: var(--ok-soft); color: var(--ok); }',

      /* Part 7 Drag-and-Drop Gapped Text */
      '.rdg-p7-gap { margin: 14px 0; border: 1.5px dashed var(--border-strong); border-radius: var(--radius); background: var(--surface-subtle); transition: border-color 120ms ease, background-color 120ms ease, box-shadow 120ms ease; }',
      '.rdg-p7-gap.is-empty { padding: 13px 16px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 10px; }',
      '.rdg-p7-gap.is-empty:hover { border-color: var(--accent); background: var(--accent-soft); }',
      '.rdg-p7-gap.is-dragover { border-color: var(--accent) !important; border-style: solid; background: var(--accent-soft) !important; box-shadow: 0 0 0 3px var(--focus-ring); }',
      '.rdg-p7-gap.is-targetable { border-color: var(--accent); border-style: dashed; }',
      '.rdg-p7-gap.is-filled { border-style: solid; border-color: var(--accent-border); background: var(--surface); padding: 12px 14px; }',
      '.rdg-p7-gap-right { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }',
      '.rdg-p7-gap-label { font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; color: var(--accent); }',
      '.rdg-p7-gap-placeholder { font-size: 12.5px; color: var(--text-muted); flex: 1; text-align: center; }',
      '.rdg-p7-placed-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; padding-bottom: 7px; border-bottom: 1px solid var(--border); }',
      '.rdg-p7-placed-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }',
      '.rdg-p7-placed-body { font-size: 14px; line-height: 1.62; color: var(--text); cursor: grab; }',
      '.rdg-p7-placed-body:active { cursor: grabbing; }',
      '.rdg-p7-placed-body p { margin: 0 0 8px; }',
      '.rdg-p7-placed-body p:last-child { margin-bottom: 0; }',
      '.rdg-p7-return-btn { height: 24px; padding: 0 8px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface-subtle); color: var(--text-secondary); font-family: var(--font-mono); font-size: 11px; font-weight: 600; cursor: pointer; }',
      '.rdg-p7-return-btn:hover { border-color: var(--err); color: var(--err); background: var(--err-soft); }',

      '.rdg-p7-pool-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }',
      '.rdg-p7-pool-title { font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.07em; color: var(--text-muted); }',
      '.rdg-p7-pool-status { font-family: var(--font-mono); font-size: 11px; color: var(--accent); font-weight: 600; }',
      '.rdg-p7-pool { display: flex; flex-direction: column; gap: 9px; min-height: 120px; border-radius: var(--radius); transition: background-color 120ms ease; }',
      '.rdg-p7-pool.is-dragover { background: var(--accent-soft); outline: 1.5px dashed var(--accent); outline-offset: 4px; }',

      '.rdg-p7-card { border: 1px solid var(--border); border-left: 3px solid var(--accent-border); border-radius: var(--radius); background: var(--surface-subtle); padding: 10px 12px; cursor: grab; transition: border-color 110ms ease, background-color 110ms ease, transform 110ms ease, opacity 110ms ease; }',
      '.rdg-p7-card:hover { border-color: var(--accent); background: var(--surface-hover); }',
      '.rdg-p7-card:active { cursor: grabbing; }',
      '.rdg-p7-card.is-dragging { opacity: 0.45; }',
      '.rdg-p7-card.is-selected { border-color: var(--accent); border-left-color: var(--accent); background: var(--accent-soft); box-shadow: 0 0 0 2px var(--focus-ring); }',
      '.rdg-p7-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 5px; }',
      '.rdg-p7-card-grip { font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted); letter-spacing: 0.04em; }',
      '.rdg-p7-card-text { font-size: 13px; line-height: 1.5; color: var(--text); }',
      '.rdg-p7-card-text p { margin: 0 0 6px; }',
      '.rdg-p7-card-text p:last-child { margin-bottom: 0; }',

      /* Part 8 Zero-Scroll Compact Dropdown List (1080p/900p fit) */
      '.rdg-right.rdg-p8-right { padding: 8px 12px; display: flex; flex-direction: column; justify-content: space-between; }',
      '.rdg-p8-list { display: flex; flex-direction: column; height: 100%; justify-content: space-between; gap: 3px; }',
      '.rdg-p8-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 5px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-subtle); transition: border-color 110ms ease, background-color 110ms ease; }',
      '.rdg-p8-row:hover { border-color: var(--border-strong); }',
      '.rdg-p8-qnum { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--text-secondary); min-width: 28px; }',
      '.rdg-p8-stem { font-size: 12.25px; line-height: 1.28; color: var(--text); }',
      '.rdg-p8-ctrl-wrap { display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0; }',
      '.rdg-p8-select { width: 60px; height: 25px; padding: 0 5px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font-family: var(--font-mono); font-size: 12px; font-weight: 700; cursor: pointer; }',
      '.rdg-p8-select:hover { border-color: var(--accent); }',
      '.rdg-p8-corr { font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--ok); min-width: 24px; text-align: right; }',
      '.rdg-p8-ctrl-wrap .cae-exp-btn { width: 17px; height: 17px; font-size: 10px; margin-left: 0; }',

      /* Parse Error Panel */
      '.rdg-error-card { max-width: 740px; margin: 20px auto; background: var(--surface); border: 1px solid var(--err); border-radius: var(--radius-lg); padding: 22px 24px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow-sm); }',
      '.rdg-error-title { margin: 0; font-family: var(--font-mono); font-size: 13px; font-weight: 700; letter-spacing: 0.06em; color: var(--err); }',
      '.rdg-error-msg { margin: 0; font-size: 14px; color: var(--text); line-height: 1.55; }',
      '.rdg-error-spec { margin: 0; padding: 12px 14px; border-radius: var(--radius); background: var(--surface-subtle); border: 1px solid var(--border); font-family: var(--font-mono); font-size: 11.5px; line-height: 1.55; color: var(--text-secondary); overflow-x: auto; white-space: pre-wrap; }',

      /* Summary Modal */
      '.rdg-summary-hero { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 14px 16px; border-radius: var(--radius); background: var(--surface-subtle); border: 1px solid var(--border); }',
      '.rdg-summary-scale { font-family: var(--font-mono); font-size: 24px; font-weight: 700; color: var(--accent); }',
      '.rdg-summary-table { width: 100%; border-collapse: collapse; font-size: 13px; }',
      '.rdg-summary-table th, .rdg-summary-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; }',
      '.rdg-summary-table th { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }',
      '.rdg-summary-table td.num, .rdg-summary-table th.num { text-align: right; font-family: var(--font-mono); }',
      '.rdg-summary-table tr:last-child td { border-bottom: 0; }',

      '@media (max-width: 920px) {',
      '  #ws-body:has(.rdg-shell) { overflow-y: auto; }',
      '  .rdg-shell { height: auto; }',
      '  .rdg-split { grid-template-columns: 1fr; }',
      '  .rdg-pane { overflow-y: visible; }',
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

  function renderParagraphs(text) {
    var paras = String(text || '').trim().split(/\n\s*\n/).filter(function (p) { return p.trim().length > 0; });
    return paras.map(function (p) {
      return '<p>' + esc(p.trim()).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function extractOptionalTitle(rawBlock) {
    var lines = rawBlock.replace(/\r\n?/g, '\n').split('\n');
    var i = 0;
    while (i < lines.length && !lines[i].trim()) i++;
    var title = '';
    if (i < lines.length) {
      var m = lines[i].trim().match(/^TITLE\s*:\s*(.*)$/i);
      if (m) {
        title = m[1].trim();
        i++;
      }
    }
    return {
      title: title,
      body: lines.slice(i).join('\n').trim()
    };
  }

  function stripTrailingNote(rawBody) {
    var lines = String(rawBody || '').replace(/\r\n?/g, '\n').split('\n');
    var textLines = [];
    var noteLines = [];
    var inNote = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!inNote) {
        var nm = line.match(/^\s*NOTE\s*:\s*(.*)$/i);
        if (nm) {
          inNote = true;
          if (nm[1].trim()) noteLines.push(nm[1].trim());
          continue;
        }
        textLines.push(line);
      } else {
        if (line.trim()) noteLines.push(line.trim());
      }
    }

    return {
      text: textLines.join('\n').trim(),
      note: noteLines.join(' ').trim()
    };
  }

  function parseLabeledBlocks(rawText, partLabel, allowHeading, extractNote) {
    var lines = rawText.replace(/\r\n?/g, '\n').split('\n');
    var blocks = [];
    var current = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = line.match(/^\s*\[([A-H])\]\s*(.*)$/i);
      if (m) {
        if (current) blocks.push(current);
        current = {
          letter: m[1].toUpperCase(),
          firstLine: m[2].trim(),
          restLines: []
        };
      } else if (current) {
        current.restLines.push(line);
      } else if (line.trim()) {
        return { error: partLabel + ': Unexpected text before first [A] label: "' + line.trim().slice(0, 60) + '".' };
      }
    }
    if (current) blocks.push(current);

    if (!blocks.length) {
      return { error: partLabel + ': No labeled blocks [A], [B], ... found.' };
    }

    var seen = {};
    var out = [];

    for (var b = 0; b < blocks.length; b++) {
      var blk = blocks[b];
      if (seen[blk.letter]) {
        return { error: partLabel + ': Duplicate block label [' + blk.letter + '].' };
      }
      seen[blk.letter] = true;

      var restJoined = blk.restLines.join('\n').trim();
      var heading = '';
      var body = '';

      if (allowHeading && blk.firstLine && restJoined && blk.firstLine.length <= 80 && !/[.?!"]$/.test(blk.firstLine)) {
        heading = blk.firstLine;
        body = restJoined;
      } else if (blk.firstLine && restJoined) {
        body = blk.firstLine + '\n' + restJoined;
      } else {
        body = blk.firstLine || restJoined;
      }

      var note = '';
      if (extractNote) {
        var stripped = stripTrailingNote(body);
        body = stripped.text;
        note = stripped.note;
      }

      if (!body.trim()) {
        return { error: partLabel + ': Block [' + blk.letter + '] has no content.' };
      }

      out.push({
        letter: blk.letter,
        heading: heading,
        text: body.trim(),
        note: note
      });
    }

    return { blocks: out };
  }

  /* ================= PART PARSERS ================= */
  function parsePart5(rawSection) {
    var splitMatch = rawSection.match(/^\s*===\s*QUESTIONS\s*===\s*$/im);
    if (!splitMatch) {
      return { error: 'Part 5: Missing required "=== QUESTIONS ===" separator.' };
    }

    var passageRaw = rawSection.slice(0, splitMatch.index).trim();
    var questionsRaw = rawSection.slice(splitMatch.index + splitMatch[0].length).trim();

    var extracted = extractOptionalTitle(passageRaw);
    if (!extracted.body) {
      return { error: 'Part 5: Passage text is empty.' };
    }
    if (!questionsRaw) {
      return { error: 'Part 5: Questions section after "=== QUESTIONS ===" is empty.' };
    }

    /* Split questions by lines beginning with Q<number>: */
    var qLines = questionsRaw.split('\n');
    var rawBlocks = [];
    var curBlock = [];

    for (var i = 0; i < qLines.length; i++) {
      var ln = qLines[i].trim();
      if (!ln) continue;
      if (/^Q\s*\d+\s*:/i.test(ln)) {
        if (curBlock.length) rawBlocks.push(curBlock);
        curBlock = [ln];
      } else if (curBlock.length) {
        curBlock.push(ln);
      } else {
        return { error: 'Part 5: Unexpected line before first question: "' + ln.slice(0, 60) + '".' };
      }
    }
    if (curBlock.length) rawBlocks.push(curBlock);

    if (!rawBlocks.length) {
      return { error: 'Part 5: No questions found. Expected blocks starting with "Q31: ...".' };
    }

    var items = [];

    for (var b = 0; b < rawBlocks.length; b++) {
      var lines = rawBlocks[b];
      var qMatch = lines[0].match(/^Q\s*(\d+)\s*:\s*([\s\S]+)$/i);
      if (!qMatch) {
        return { error: 'Part 5: Could not parse question header "' + lines[0].slice(0, 60) + '".' };
      }

      var qNum = parseInt(qMatch[1], 10);
      var stem = qMatch[2].trim();
      var options = {};
      var ans = '';
      var exp = '';
      var trap = '';
      var wrongReasons = {};
      var lastField = 'STEM';

      for (var j = 1; j < lines.length; j++) {
        var line = lines[j];
        var ansMatch = line.match(/^ANS\s*:\s*([A-D])\b/i);
        var metaMatch = line.match(/^(EXP|TRAP|WA|WB|WC|WD)\s*:\s*([\s\S]*)$/i);
        var optMatch = line.match(/^([A-D])\s*:\s*([\s\S]+)$/i);

        if (ansMatch) {
          ans = ansMatch[1].toUpperCase();
          lastField = 'ANS';
        } else if (metaMatch) {
          var tag = metaMatch[1].toUpperCase();
          var val = metaMatch[2].trim();
          if (tag === 'EXP') {
            exp = val;
            lastField = 'EXP';
          } else if (tag === 'TRAP') {
            trap = val;
            lastField = 'TRAP';
          } else {
            var wLetter = tag.charAt(1);
            wrongReasons[wLetter] = val;
            lastField = tag;
          }
        } else if (optMatch) {
          var letter = optMatch[1].toUpperCase();
          options[letter] = optMatch[2].trim();
          lastField = letter;
        } else if (lastField === 'STEM') {
          stem += ' ' + line;
        } else if (lastField === 'EXP') {
          exp = exp ? (exp + ' ' + line) : line;
        } else if (lastField === 'TRAP') {
          trap = trap ? (trap + ' ' + line) : line;
        } else if (/^W[A-D]$/.test(lastField)) {
          var wl = lastField.charAt(1);
          wrongReasons[wl] = wrongReasons[wl] ? (wrongReasons[wl] + ' ' + line) : line;
        } else if (options[lastField] !== undefined) {
          options[lastField] += ' ' + line;
        }
      }

      var missingOpt = ['A', 'B', 'C', 'D'].find(function (l) { return !options[l]; });
      if (missingOpt) {
        return { error: 'Part 5 (Q' + qNum + '): Missing required option "' + missingOpt + ':".' };
      }
      if (!ans || !options[ans]) {
        return { error: 'Part 5 (Q' + qNum + '): Missing or invalid "ANS:" tag (expected A, B, C, or D).' };
      }

      items.push({
        id: 'rdg_p5_q' + qNum + '_' + items.length,
        num: qNum,
        stem: stem.trim(),
        options: options,
        answer: ans,
        exp: exp.trim(),
        trap: trap.trim(),
        wrongReasons: wrongReasons,
        maxPoints: 2
      });
    }

    return {
      title: extracted.title,
      passage: extracted.body,
      items: items
    };
  }

  function parseCrossMatchingPart(rawSection, partKey, pointsPerItem) {
    var partLabel = PART_META[partKey].short;
    var splitMatch = rawSection.match(/^\s*===\s*QUESTIONS\s*===\s*$/im);
    if (!splitMatch) {
      return { error: partLabel + ': Missing required "=== QUESTIONS ===" separator.' };
    }

    var textsRaw = rawSection.slice(0, splitMatch.index).trim();
    var questionsRaw = rawSection.slice(splitMatch.index + splitMatch[0].length).trim();

    var extracted = extractOptionalTitle(textsRaw);
    var parsedBlocks = parseLabeledBlocks(extracted.body, partLabel, true, false);
    if (parsedBlocks.error) return { error: parsedBlocks.error };

    var validLetters = parsedBlocks.blocks.map(function (b) { return b.letter; });
    if (validLetters.length < 2) {
      return { error: partLabel + ': Expected at least 2 labeled sections ([A], [B], ...).' };
    }

    if (!questionsRaw) {
      return { error: partLabel + ': Questions section after "=== QUESTIONS ===" is empty.' };
    }

    /* Group multi-line questions starting with Q<num>: */
    var rawLines = questionsRaw.split('\n');
    var qEntries = [];
    var current = '';
    for (var i = 0; i < rawLines.length; i++) {
      var ln = rawLines[i].trim();
      if (!ln) continue;
      if (/^Q\s*\d+\s*:/i.test(ln)) {
        if (current) qEntries.push(current);
        current = ln;
      } else if (current) {
        current += ' ' + ln;
      } else {
        return { error: partLabel + ': Unexpected line in QUESTIONS: "' + ln.slice(0, 60) + '". Expected "Q<num>: ... | ANS: <LETTER>".' };
      }
    }
    if (current) qEntries.push(current);

    if (!qEntries.length) {
      return { error: partLabel + ': No questions found under "=== QUESTIONS ===".' };
    }

    var items = [];
    for (var q = 0; q < qEntries.length; q++) {
      var entry = qEntries[q];
      var headMatch = entry.match(/^Q\s*(\d+)\s*:\s*([\s\S]+)$/i);
      if (!headMatch) {
        return { error: partLabel + ': Malformed question line "' + entry.slice(0, 75) + '". Expected "Q<num>: Question text | ANS: <LETTER>".' };
      }

      var qNum = parseInt(headMatch[1], 10);
      var rest = headMatch[2].trim();

      /* Split strictly on pipe boundaries preceding recognized tags so stray pipes in text don't break parsing */
      var segments = rest.split(/\s*\|\|?\s*(?=(?:ANS|EXP|TRAP|W[A-H])\s*:)/i);
      var stem = (segments[0] || '').trim();
      var ans = '';
      var exp = '';
      var trap = '';
      var wrongReasons = {};

      for (var s = 1; s < segments.length; s++) {
        var seg = segments[s].trim();
        if (!seg) continue;
        var tm = seg.match(/^(ANS|EXP|TRAP|W[A-H])\s*:\s*([\s\S]*)$/i);
        if (!tm) continue;
        var tag = tm[1].toUpperCase();
        var val = tm[2].trim();

        if (tag === 'ANS') {
          var letterMatch = val.match(/^([A-H])\b/i);
          ans = letterMatch ? letterMatch[1].toUpperCase() : '';
        } else if (tag === 'EXP') {
          exp = val;
        } else if (tag === 'TRAP') {
          trap = val;
        } else if (/^W[A-H]$/.test(tag)) {
          if (val) wrongReasons[tag.charAt(1)] = val;
        }
      }

      if (!stem || !ans) {
        return { error: partLabel + ': Malformed question line "' + entry.slice(0, 75) + '". Expected "Q<num>: Question text | ANS: <LETTER>".' };
      }

      if (validLetters.indexOf(ans) === -1) {
        return { error: partLabel + ' (Q' + qNum + '): Answer "' + ans + '" does not match available sections (' + validLetters.join(', ') + ').' };
      }

      items.push({
        id: 'rdg_' + partKey + '_q' + qNum + '_' + items.length,
        num: qNum,
        stem: stem,
        answer: ans,
        exp: exp,
        trap: trap,
        wrongReasons: wrongReasons,
        maxPoints: pointsPerItem
      });
    }

    return {
      title: extracted.title,
      texts: parsedBlocks.blocks,
      letters: validLetters,
      items: items
    };
  }

  function parsePart7(rawSection) {
    var optMatch = rawSection.match(/^\s*===\s*OPTIONS\s*===\s*$/im);
    if (!optMatch) {
      return { error: 'Part 7: Missing required "=== OPTIONS ===" separator.' };
    }

    var ansMatch = rawSection.match(/^\s*===\s*ANSWERS\s*===\s*$/im);
    if (!ansMatch) {
      return { error: 'Part 7: Missing required "=== ANSWERS ===" separator.' };
    }
    if (ansMatch.index <= optMatch.index) {
      return { error: 'Part 7: "=== ANSWERS ===" must appear after "=== OPTIONS ===".' };
    }

    var articleRaw = rawSection.slice(0, optMatch.index).trim();
    var optionsRaw = rawSection.slice(optMatch.index + optMatch[0].length, ansMatch.index).trim();
    var answersRaw = rawSection.slice(ansMatch.index + ansMatch[0].length).trim();

    var extracted = extractOptionalTitle(articleRaw);
    if (!extracted.body) {
      return { error: 'Part 7: Base article is empty.' };
    }

    /* Extract gap markers [[GAP:XX]] */
    var gapRe = /\[\[GAP\s*:\s*(\d+)\]\]/gi;
    var gaps = [];
    var gapSeen = {};
    var gm;
    while ((gm = gapRe.exec(extracted.body)) !== null) {
      var gNum = parseInt(gm[1], 10);
      if (gapSeen[gNum]) {
        return { error: 'Part 7: Duplicate gap marker [[GAP:' + gNum + ']].' };
      }
      gapSeen[gNum] = true;
      gaps.push(gNum);
    }

    if (!gaps.length) {
      return { error: 'Part 7: No [[GAP:XX]] markers found in base article.' };
    }

    /* Parse options [A]..[G] and strip optional trailing NOTE: from visible text */
    var parsedOpts = parseLabeledBlocks(optionsRaw, 'Part 7 OPTIONS', false, true);
    if (parsedOpts.error) return { error: parsedOpts.error };

    var optionMap = {};
    parsedOpts.blocks.forEach(function (blk) {
      optionMap[blk.letter] = blk;
    });

    if (parsedOpts.blocks.length < gaps.length) {
      return { error: 'Part 7: Fewer paragraph options (' + parsedOpts.blocks.length + ') than gaps (' + gaps.length + ').' };
    }

    /* Parse answers: supports both "41=C | EXP: ..." per line and legacy "41=C, 42=A, ..." */
    if (!answersRaw) {
      return { error: 'Part 7: "=== ANSWERS ===" section is empty.' };
    }

    var answerMap = {};
    var expMap = {};
    var trapMap = {};
    var ansLines = answersRaw.replace(/\r\n?/g, '\n').split('\n');
    var lastGapNum = null;
    var lastTag = null;

    for (var li = 0; li < ansLines.length; li++) {
      var line = ansLines[li].trim();
      if (!line) continue;

      var singleMatch = line.match(/^Q?\s*(\d+)\s*[=:]\s*([A-H])(?:\s*\|\|?\s*([\s\S]+))?$/i);
      if (singleMatch) {
        var sGap = parseInt(singleMatch[1], 10);
        var sLetter = singleMatch[2].toUpperCase();
        answerMap[sGap] = sLetter;
        lastGapNum = sGap;
        lastTag = null;

        if (singleMatch[3]) {
          var tailSegs = singleMatch[3].trim().split(/\s*\|\|?\s*(?=(?:EXP|TRAP)\s*:)/i);
          for (var ts = 0; ts < tailSegs.length; ts++) {
            var tMatch = tailSegs[ts].trim().match(/^(EXP|TRAP)\s*:\s*([\s\S]*)$/i);
            if (!tMatch) continue;
            var tKey = tMatch[1].toUpperCase();
            var tVal = tMatch[2].trim();
            if (tKey === 'EXP') {
              expMap[sGap] = tVal;
              lastTag = 'EXP';
            } else if (tKey === 'TRAP') {
              trapMap[sGap] = tVal;
              lastTag = 'TRAP';
            }
          }
        }
        continue;
      }

      /* Legacy comma/space separated format: 41=C, 42=A, ... */
      var pairRe = /Q?\s*(\d+)\s*[=:]\s*([A-H])\b/gi;
      var pm;
      var matchedAnyPair = false;
      while ((pm = pairRe.exec(line)) !== null) {
        matchedAnyPair = true;
        answerMap[parseInt(pm[1], 10)] = pm[2].toUpperCase();
      }
      if (matchedAnyPair) {
        lastGapNum = null;
        lastTag = null;
        continue;
      }

      /* Continuation line for a multi-line EXP/TRAP */
      if (lastGapNum !== null && lastTag === 'EXP') {
        expMap[lastGapNum] = expMap[lastGapNum] ? (expMap[lastGapNum] + ' ' + line) : line;
      } else if (lastGapNum !== null && lastTag === 'TRAP') {
        trapMap[lastGapNum] = trapMap[lastGapNum] ? (trapMap[lastGapNum] + ' ' + line) : line;
      }
    }

    var items = [];
    for (var i = 0; i < gaps.length; i++) {
      var num = gaps[i];
      var correctLetter = answerMap[num];
      if (!correctLetter) {
        return { error: 'Part 7: Missing answer for gap [[GAP:' + num + ']] in "=== ANSWERS ===".' };
      }
      if (!optionMap[correctLetter]) {
        return { error: 'Part 7: Answer "' + num + '=' + correctLetter + '" references missing option [' + correctLetter + '].' };
      }

      items.push({
        id: 'rdg_p7_g' + num,
        num: num,
        answer: correctLetter,
        exp: (expMap[num] || '').trim(),
        trap: (trapMap[num] || '').trim(),
        maxPoints: 2
      });
    }

    return {
      title: extracted.title,
      article: extracted.body,
      options: parsedOpts.blocks,
      optionMap: optionMap,
      items: items
    };
  }

  function parseReadingText(rawTxt) {
    var text = String(rawTxt || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (!text.trim()) {
      return { error: 'The uploaded file is empty. Expected === PART 5 === through === PART 8 ===.' };
    }

    var headerRe = /^\s*===\s*PART\s*([5-8])\s*===\s*$/gim;
    var matches = [];
    var m;
    while ((m = headerRe.exec(text)) !== null) {
      matches.push({
        partNum: m[1],
        key: 'part' + m[1],
        start: m.index,
        contentStart: m.index + m[0].length
      });
    }

    if (!matches.length) {
      return { error: 'No Reading section headers found. Expected === PART 5 ===, === PART 6 ===, === PART 7 ===, and === PART 8 ===.' };
    }

    var rawSections = {};
    for (var i = 0; i < matches.length; i++) {
      var cur = matches[i];
      var nextStart = (i + 1 < matches.length) ? matches[i + 1].start : text.length;
      if (rawSections[cur.key] !== undefined) {
        return { error: 'Duplicate section header found: === PART ' + cur.partNum + ' ===.' };
      }
      rawSections[cur.key] = text.slice(cur.contentStart, nextStart).trim();
    }

    var missing = [];
    for (var p = 5; p <= 8; p++) {
      if (rawSections['part' + p] === undefined) {
        missing.push('=== PART ' + p + ' ===');
      }
    }
    if (missing.length) {
      return { error: 'Missing required section header(s): ' + missing.join(', ') + '.' };
    }

    var p5 = parsePart5(rawSections.part5);
    if (p5.error) return { error: p5.error };

    var p6 = parseCrossMatchingPart(rawSections.part6, 'part6', 2);
    if (p6.error) return { error: p6.error };

    var p7 = parsePart7(rawSections.part7);
    if (p7.error) return { error: p7.error };

    var p8 = parseCrossMatchingPart(rawSections.part8, 'part8', 1);
    if (p8.error) return { error: p8.error };

    return {
      parts: {
        part5: p5,
        part6: p6,
        part7: p7,
        part8: p8
      }
    };
  }

  /* ================= EXPLANATION BADGE HELPERS ================= */
  function attachExplanationBadge(panel, itemId, expPayload) {
    var slot = panel.querySelector('[data-exp-slot="' + itemId + '"]');
    if (!slot) return false;
    slot.innerHTML = '';

    if (!expPayload) return false;
    var hasContent = Boolean(
      (expPayload.rule && expPayload.rule.trim()) ||
      (expPayload.wrongReason && expPayload.wrongReason.trim()) ||
      (expPayload.trap && expPayload.trap.trim())
    );
    if (!hasContent) return false;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cae-exp-btn';
    btn.textContent = '?';
    slot.appendChild(btn);

    if (window.CAE.Core && typeof window.CAE.Core.registerExplanation === 'function') {
      window.CAE.Core.registerExplanation(btn, expPayload);
    }
    return true;
  }

  function clearExplanationBadge(panel, itemId) {
    var slot = panel.querySelector('[data-exp-slot="' + itemId + '"]');
    if (slot) slot.innerHTML = '';
    if (window.CAE.Core && typeof window.CAE.Core.hideExplanation === 'function') {
      window.CAE.Core.hideExplanation();
    }
  }

  function formatPart7Note(letter, noteText) {
    var clean = String(noteText || '').trim();
    if (!clean) return '';
    if (/^Paragraph\s+\[?[A-H]\]?/i.test(clean)) return clean;
    return 'Paragraph ' + letter + ': ' + clean;
  }

  /* ================= PART 7 STATE & DOM SYNC ================= */
  function getPart7GapContext(gapNum) {
    var art = session.parsed.parts.part7.article;
    var markerRe = new RegExp('\\[\\[GAP\\s*:\\s*' + gapNum + '\\]\\]', 'i');
    var idx = art.search(markerRe);
    if (idx === -1) return 'Gap ' + gapNum;
    var before = art.slice(Math.max(0, idx - 75), idx).replace(/\[\[GAP\s*:\s*\d+\]\]/gi, '[GAP]').replace(/\s+/g, ' ').trim();
    var after = art.slice(idx + 10, idx + 85).replace(/\[\[GAP\s*:\s*\d+\]\]/gi, '[GAP]').replace(/\s+/g, ' ').trim();
    return '...' + before + ' [GAP ' + gapNum + '] ' + after + '...';
  }

  function renderPart7GapElement(gapEl, gapNum) {
    var p7 = session.parsed.parts.part7;
    var assignedLetter = session.answers.part7[gapNum] || '';
    var isSelectedTarget = Boolean(session.p7SelectedLetter);
    var itemId = 'rdg_p7_g' + gapNum;

    gapEl.className = 'rdg-p7-gap ' + (assignedLetter ? 'is-filled' : 'is-empty');
    if (isSelectedTarget && !assignedLetter) {
      gapEl.classList.add('is-targetable');
    }

    if (!assignedLetter) {
      gapEl.innerHTML =
        '<span class="rdg-p7-gap-label">GAP ' + gapNum + '</span>' +
        '<span class="rdg-p7-gap-placeholder">' +
          (isSelectedTarget
            ? 'Click to place [' + esc(session.p7SelectedLetter) + '] here'
            : 'Drop paragraph A–' + esc(p7.options[p7.options.length - 1].letter) + ' here') +
        '</span>' +
        '<span class="rdg-p7-gap-right">' +
          '<span class="rdg-q-status" data-p7-status="' + gapNum + '" hidden></span>' +
          '<span class="rdg-exp-slot" data-exp-slot="' + esc(itemId) + '"></span>' +
        '</span>';
      return;
    }

    var opt = p7.optionMap[assignedLetter];
    gapEl.innerHTML =
      '<div class="rdg-p7-placed-head">' +
        '<div class="rdg-p7-placed-meta">' +
          '<span class="rdg-p7-gap-label">GAP ' + gapNum + '</span>' +
          '<span class="rdg-letter-badge">' + esc(assignedLetter) + '</span>' +
          '<span class="rdg-q-status" data-p7-status="' + gapNum + '" hidden></span>' +
          '<span class="rdg-exp-slot" data-exp-slot="' + esc(itemId) + '"></span>' +
        '</div>' +
        '<button type="button" class="rdg-p7-return-btn" data-p7-return="' + gapNum + '" title="Return paragraph ' + esc(assignedLetter) + ' to pool">× Return</button>' +
      '</div>' +
      '<div class="rdg-p7-placed-body" draggable="true" data-p7-placed-letter="' + esc(assignedLetter) + '" data-p7-placed-gap="' + gapNum + '">' +
        renderParagraphs(opt ? opt.text : '') +
      '</div>';
  }

  function renderPart7Pool() {
    var panel = session.panels.part7;
    var poolEl = panel.querySelector('#rdg-p7-pool');
    var statusEl = panel.querySelector('#rdg-p7-pool-status');
    if (!poolEl) return;

    var p7 = session.parsed.parts.part7;
    var placedLetters = {};
    Object.keys(session.answers.part7).forEach(function (g) {
      var l = session.answers.part7[g];
      if (l) placedLetters[l] = true;
    });

    var available = p7.options.filter(function (opt) { return !placedLetters[opt.letter]; });

    if (statusEl) {
      if (session.p7SelectedLetter) {
        statusEl.textContent = 'Selected [' + session.p7SelectedLetter + '] — click any gap';
      } else {
        var extraCount = Math.max(0, p7.options.length - p7.items.length);
        statusEl.textContent = available.length + ' of ' + p7.options.length + ' remaining' +
          (extraCount ? ' (' + extraCount + ' unused)' : '');
      }
    }

    if (!available.length) {
      poolEl.innerHTML = '<p class="muted-note" style="padding:12px;">All paragraph cards have been placed.</p>';
      return;
    }

    poolEl.innerHTML = available.map(function (opt) {
      var isSel = session.p7SelectedLetter === opt.letter;
      return (
        '<div class="rdg-p7-card' + (isSel ? ' is-selected' : '') + '" draggable="true" tabindex="0" role="button" ' +
          'data-p7-card="' + esc(opt.letter) + '" aria-pressed="' + (isSel ? 'true' : 'false') + '">' +
          '<div class="rdg-p7-card-head">' +
            '<span class="rdg-letter-badge">' + esc(opt.letter) + '</span>' +
            '<span class="rdg-p7-card-grip">' + (isSel ? 'SELECTED · CLICK GAP' : 'DRAG OR CLICK') + '</span>' +
          '</div>' +
          '<div class="rdg-p7-card-text">' + renderParagraphs(opt.text) + '</div>' +
        '</div>'
      );
    }).join('');
  }

  function refreshPart7GapTargetability() {
    var panel = session.panels.part7;
    if (!panel) return;
    panel.querySelectorAll('.rdg-p7-gap').forEach(function (gapEl) {
      var gapNum = parseInt(gapEl.getAttribute('data-p7-gap'), 10);
      if (!session.answers.part7[gapNum]) {
        /* Preserve graded state if already checked and not actively targeting a card */
        var hasExp = Boolean(gapEl.querySelector('.cae-exp-btn'));
        var hasStatus = Boolean(gapEl.querySelector('[data-p7-status]:not([hidden])'));
        if (!hasExp && !hasStatus) {
          renderPart7GapElement(gapEl, gapNum);
        } else {
          gapEl.classList.toggle('is-targetable', Boolean(session.p7SelectedLetter));
        }
      }
    });
  }

  function placePart7Card(targetGapNum, letter, fromGapNum) {
    if (!session || !letter) return;
    var p7 = session.parsed.parts.part7;
    if (!p7.optionMap[letter]) return;

    if (window.CAE.Core && typeof window.CAE.Core.hideExplanation === 'function') {
      window.CAE.Core.hideExplanation();
    }

    var prevOccupant = session.answers.part7[targetGapNum] || '';
    var sourceGap = fromGapNum || null;

    /* Find if letter is already in another gap */
    if (!sourceGap) {
      Object.keys(session.answers.part7).forEach(function (g) {
        if (session.answers.part7[g] === letter) sourceGap = parseInt(g, 10);
      });
    }

    if (sourceGap === targetGapNum) return;

    if (sourceGap) {
      /* Moving from one gap to another: swap if target was occupied */
      if (prevOccupant) {
        session.answers.part7[sourceGap] = prevOccupant;
      } else {
        delete session.answers.part7[sourceGap];
      }
      var srcEl = session.panels.part7.querySelector('.rdg-p7-gap[data-p7-gap="' + sourceGap + '"]');
      if (srcEl) renderPart7GapElement(srcEl, sourceGap);
    }

    /* Place letter in target gap (if dragged from pool, prevOccupant returns automatically to pool) */
    session.answers.part7[targetGapNum] = letter;
    session.p7SelectedLetter = null;

    var targetEl = session.panels.part7.querySelector('.rdg-p7-gap[data-p7-gap="' + targetGapNum + '"]');
    if (targetEl) renderPart7GapElement(targetEl, targetGapNum);

    renderPart7Pool();
    refreshPart7GapTargetability();
    markPartModified('part7');
  }

  function returnPart7Card(gapNum) {
    if (!session || !session.answers.part7[gapNum]) return;
    if (window.CAE.Core && typeof window.CAE.Core.hideExplanation === 'function') {
      window.CAE.Core.hideExplanation();
    }
    delete session.answers.part7[gapNum];
    session.p7SelectedLetter = null;

    var gapEl = session.panels.part7.querySelector('.rdg-p7-gap[data-p7-gap="' + gapNum + '"]');
    if (gapEl) renderPart7GapElement(gapEl, gapNum);

    renderPart7Pool();
    refreshPart7GapTargetability();
    markPartModified('part7');
  }

  /* ================= MODIFICATION & LIVE COUNTS ================= */
  function countAnswered(partKey) {
    if (!session) return { answered: 0, total: 0 };
    var items = session.parsed.parts[partKey].items;
    var map = session.answers[partKey];
    var answered = 0;
    items.forEach(function (item) {
      var val = (partKey === 'part7') ? map[item.num] : map[item.id];
      if (val && String(val).trim()) answered += 1;
    });
    return { answered: answered, total: items.length };
  }

  function updateBottomNavTab(partKey) {
    var nav = document.getElementById('ws-bottom-nav');
    if (!nav || !session) return;
    var btn = nav.querySelector('.ws-part-tab[data-part-id="' + partKey + '"]');
    if (!btn) return;
    var counts = countAnswered(partKey);
    btn.textContent = PART_META[partKey].short + ' (' + counts.answered + '/' + counts.total + ')';
    btn.classList.toggle('is-done', Boolean(session.partChecked[partKey]));
  }

  function markPartModified(partKey) {
    updateBottomNavTab(partKey);
    if (session.partChecked[partKey]) {
      session.partDirty[partKey] = true;
      var btn = session.panels[partKey].querySelector('[data-check-part="' + partKey + '"]');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Re-check Answers for This Section';
      }
    }
  }

  /* ================= GRADING LOGIC ================= */
  function gradePart(partKey) {
    var partData = session.parsed.parts[partKey];
    var panel = session.panels[partKey];
    var earned = 0;
    var possible = 0;
    var mistakes = [];

    if (partKey === 'part5') {
      partData.items.forEach(function (item) {
        possible += item.maxPoints;
        var chosen = session.answers.part5[item.id] || '';
        var isCorrect = chosen === item.answer;
        var card = panel.querySelector('[data-q-card="' + item.id + '"]');
        var status = card ? card.querySelector('[data-q-status="' + item.id + '"]') : null;
        var userDisplay = chosen ? (chosen + ': ' + (item.options[chosen] || '')) : '';
        var correctDisplay = item.answer + ': ' + item.options[item.answer];

        if (card) {
          card.querySelectorAll('.rdg-p5-opt').forEach(function (optEl) {
            optEl.classList.remove('is-correct', 'is-wrong', 'is-key-reveal');
            var letter = optEl.getAttribute('data-opt-letter');
            if (letter === chosen && isCorrect) {
              optEl.classList.add('is-correct');
            } else if (letter === chosen && !isCorrect) {
              optEl.classList.add('is-wrong');
            } else if (letter === item.answer && !isCorrect) {
              optEl.classList.add('is-key-reveal');
            }
          });
        }

        if (isCorrect) {
          earned += item.maxPoints;
          if (status) {
            status.textContent = '✓ +2';
            status.className = 'rdg-q-status ok';
            status.hidden = false;
          }
        } else {
          if (status) {
            status.textContent = '✗ Ans: ' + item.answer;
            status.className = 'rdg-q-status err';
            status.hidden = false;
          }
          mistakes.push({
            part: 'Part 5',
            context: 'Q' + item.num + ': ' + item.stem,
            userAnswer: userDisplay || '(blank)',
            correctAnswer: correctDisplay
          });
        }

        var p5WrongReason = (!isCorrect && chosen && item.wrongReasons && item.wrongReasons[chosen])
          ? item.wrongReasons[chosen]
          : undefined;

        attachExplanationBadge(panel, item.id, {
          isCorrect: isCorrect,
          userAnswer: userDisplay,
          correctAnswer: correctDisplay,
          rule: item.exp || '',
          wrongReason: p5WrongReason,
          trap: item.trap || ''
        });
      });
    } else if (partKey === 'part6') {
      partData.items.forEach(function (item) {
        possible += item.maxPoints;
        var chosen = session.answers.part6[item.id] || '';
        var isCorrect = chosen === item.answer;
        var card = panel.querySelector('[data-q-card="' + item.id + '"]');
        var status = card ? card.querySelector('[data-q-status="' + item.id + '"]') : null;

        if (card) {
          card.querySelectorAll('.rdg-p6-pill').forEach(function (pill) {
            pill.classList.remove('is-correct', 'is-wrong', 'is-key-reveal');
            var letter = pill.getAttribute('data-p6-letter');
            if (letter === chosen && isCorrect) {
              pill.classList.add('is-correct');
            } else if (letter === chosen && !isCorrect) {
              pill.classList.add('is-wrong');
            } else if (letter === item.answer && !isCorrect) {
              pill.classList.add('is-key-reveal');
            }
          });
        }

        if (isCorrect) {
          earned += item.maxPoints;
          if (status) {
            status.textContent = '✓ +2';
            status.className = 'rdg-q-status ok';
            status.hidden = false;
          }
        } else {
          if (status) {
            status.textContent = '✗ Ans: ' + item.answer;
            status.className = 'rdg-q-status err';
            status.hidden = false;
          }
          mistakes.push({
            part: 'Part 6',
            context: 'Q' + item.num + ': ' + item.stem,
            userAnswer: chosen || '(blank)',
            correctAnswer: item.answer
          });
        }

        var p6WrongReason = (!isCorrect && chosen && item.wrongReasons && item.wrongReasons[chosen])
          ? item.wrongReasons[chosen]
          : undefined;

        attachExplanationBadge(panel, item.id, {
          isCorrect: isCorrect,
          userAnswer: chosen ? ('Writer ' + chosen) : '',
          correctAnswer: 'Writer ' + item.answer,
          rule: item.exp || '',
          wrongReason: p6WrongReason,
          trap: item.trap || ''
        });
      });
    } else if (partKey === 'part7') {
      partData.items.forEach(function (item) {
        possible += item.maxPoints;
        var chosen = session.answers.part7[item.num] || '';
        var isCorrect = chosen === item.answer;
        var gapEl = panel.querySelector('.rdg-p7-gap[data-p7-gap="' + item.num + '"]');
        var status = gapEl ? gapEl.querySelector('[data-p7-status="' + item.num + '"]') : null;

        if (gapEl) gapEl.classList.remove('is-correct', 'is-wrong');

        if (isCorrect) {
          earned += item.maxPoints;
          if (gapEl) gapEl.classList.add('is-correct');
          if (status) {
            status.textContent = '✓ +2';
            status.className = 'rdg-q-status ok';
            status.hidden = false;
          }
        } else {
          if (gapEl) gapEl.classList.add('is-wrong');
          if (status) {
            status.textContent = '✗ Correct: [' + item.answer + ']';
            status.className = 'rdg-q-status err';
            status.hidden = false;
          }
          mistakes.push({
            part: 'Part 7',
            context: 'Gap ' + item.num + ': ' + getPart7GapContext(item.num),
            userAnswer: chosen ? ('[' + chosen + ']') : '(blank)',
            correctAnswer: '[' + item.answer + ']'
          });
        }

        var chosenOpt = chosen ? partData.optionMap[chosen] : null;
        var correctOpt = partData.optionMap[item.answer] || null;
        var p7WrongReason = (!isCorrect && chosen && chosenOpt && chosenOpt.note)
          ? formatPart7Note(chosen, chosenOpt.note)
          : undefined;
        var p7Rule = item.exp || (correctOpt && correctOpt.note ? formatPart7Note(item.answer, correctOpt.note) : '');

        attachExplanationBadge(panel, item.id, {
          isCorrect: isCorrect,
          userAnswer: chosen ? ('Paragraph [' + chosen + ']') : '',
          correctAnswer: 'Paragraph [' + item.answer + ']',
          rule: p7Rule,
          wrongReason: p7WrongReason,
          trap: item.trap || ''
        });
      });
    } else if (partKey === 'part8') {
      partData.items.forEach(function (item) {
        possible += item.maxPoints;
        var chosen = session.answers.part8[item.id] || '';
        var isCorrect = chosen === item.answer;
        var selectEl = panel.querySelector('select[data-p8-id="' + item.id + '"]');
        var rowEl = panel.querySelector('[data-p8-row="' + item.id + '"]');
        var corrEl = panel.querySelector('[data-p8-corr="' + item.id + '"]');

        if (selectEl) selectEl.classList.remove('is-correct', 'is-wrong');
        if (rowEl) rowEl.classList.remove('is-correct', 'is-wrong');

        if (isCorrect) {
          earned += item.maxPoints;
          if (selectEl) selectEl.classList.add('is-correct');
          if (corrEl) {
            corrEl.textContent = '✓';
            corrEl.hidden = false;
          }
        } else {
          if (selectEl) selectEl.classList.add('is-wrong');
          if (corrEl) {
            corrEl.textContent = '✓ ' + item.answer;
            corrEl.hidden = false;
          }
          mistakes.push({
            part: 'Part 8',
            context: 'Q' + item.num + ': ' + item.stem,
            userAnswer: chosen || '(blank)',
            correctAnswer: item.answer
          });
        }

        var p8WrongReason = (!isCorrect && chosen && item.wrongReasons && item.wrongReasons[chosen])
          ? item.wrongReasons[chosen]
          : undefined;

        attachExplanationBadge(panel, item.id, {
          isCorrect: isCorrect,
          userAnswer: chosen ? ('Section ' + chosen) : '',
          correctAnswer: 'Section ' + item.answer,
          rule: item.exp || '',
          wrongReason: p8WrongReason,
          trap: item.trap || ''
        });
      });
    }

    var pct = possible > 0 ? Math.round((earned / possible) * 100) : 0;
    var cambridge = window.CAE.Store.percentToCambridge(pct);

    var scorePill = panel.querySelector('[data-part-score="' + partKey + '"]');
    if (scorePill) {
      scorePill.textContent = earned + '/' + possible + ' (' + pct + '% · Scale ' + cambridge + ')';
      scorePill.hidden = false;
    }

    var checkBtn = panel.querySelector('[data-check-part="' + partKey + '"]');
    if (checkBtn) {
      checkBtn.textContent = 'Section Checked';
      checkBtn.disabled = true;
    }

    session.partChecked[partKey] = true;
    session.partDirty[partKey] = false;
    updateBottomNavTab(partKey);

    return {
      partKey: partKey,
      earned: earned,
      possible: possible,
      pct: pct,
      cambridgeScore: cambridge,
      mistakes: mistakes
    };
  }

  function handleCheckSinglePart(partKey) {
    if (!session) return;
    if (session.partChecked[partKey] && !session.partDirty[partKey]) {
      window.CAE.Core.toast(PART_META[partKey].short + ' is already graded.');
      return;
    }

    var result = gradePart(partKey);
    var breakdown = {};
    breakdown[partKey] = { earned: result.earned, possible: result.possible };

    window.CAE.Store.recordAttempt({
      module: 'reading',
      scope: partKey,
      earned: result.earned,
      possible: result.possible,
      cambridgeScore: result.cambridgeScore,
      mistakes: result.mistakes,
      partBreakdown: breakdown
    });

    var gradeLabel = window.CAE.Store.getGradeLabel(result.cambridgeScore);
    window.CAE.Core.toast(
      PART_META[partKey].short + ': ' + result.earned + '/' + result.possible +
      ' (' + result.pct + '% · ' + result.cambridgeScore + ' ' + gradeLabel + ')',
      4000
    );
  }

  function showFullSummaryModal(summary) {
    var Store = window.CAE.Store;
    var grade = Store.getGradeLabel(summary.cambridgeScore);
    var mins = Math.floor(summary.elapsedSec / 60);
    var secs = summary.elapsedSec % 60;
    var timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

    var rowsHtml = PART_KEYS.map(function (pk) {
      var r = summary.results[pk];
      return (
        '<tr>' +
          '<td><strong>' + esc(PART_META[pk].title) + '</strong></td>' +
          '<td class="num">' + r.earned + ' / ' + r.possible + '</td>' +
          '<td class="num">' + r.pct + '%</td>' +
          '<td class="num">' + r.cambridgeScore + '</td>' +
        '</tr>'
      );
    }).join('');

    var bodyHtml =
      '<div class="rdg-summary-hero">' +
        '<div>' +
          '<div class="mono" style="font-size:11px;font-weight:700;letter-spacing:0.07em;color:var(--text-muted);">PROJECTED CAMBRIDGE SCALE</div>' +
          '<div style="display:flex;align-items:baseline;gap:10px;margin-top:2px;">' +
            '<span class="rdg-summary-scale">' + summary.cambridgeScore + '</span>' +
            '<span style="font-weight:600;font-size:14px;">' + esc(grade) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="mono" style="text-align:right;font-size:12.5px;color:var(--text-secondary);">' +
          '<div><strong>' + summary.totalEarned + ' / ' + summary.totalPossible + '</strong> (' + summary.totalPct + '%)</div>' +
          '<div style="font-size:11.5px;color:var(--text-muted);">Time: ' + timeStr + ' · ' + summary.mistakeCount + ' mistakes</div>' +
        '</div>' +
      '</div>' +
      '<table class="rdg-summary-table">' +
        '<thead>' +
          '<tr><th>Section</th><th class="num">Raw</th><th class="num">Accuracy</th><th class="num">Scale</th></tr>' +
        '</thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
      '</table>' +
      '<p class="muted-note" style="margin:0;">Full Reading attempt and mistake log saved to your local CAE Bench history.</p>';

    window.CAE.Core.showModal('READING · TEST SUMMARY', bodyHtml, [
      { label: 'Review Answers', variant: 'ghost' },
      {
        label: 'Back to Hub',
        variant: 'primary',
        onClick: function () {
          window.CAE.Core.showHub();
        }
      }
    ]);
  }

  function handleFullCheck() {
    if (!session) return;

    if (session.fullSubmitted && session.lastFullSummary) {
      showFullSummaryModal(session.lastFullSummary);
      return;
    }

    var elapsedSec = window.CAE.Core.getElapsedSeconds();
    window.CAE.Core.stopTimer();

    var results = {};
    var breakdown = {};
    var allMistakes = [];
    var totalEarned = 0;
    var totalPossible = 0;

    PART_KEYS.forEach(function (pk) {
      var r = gradePart(pk);
      results[pk] = r;
      breakdown[pk] = { earned: r.earned, possible: r.possible };
      totalEarned += r.earned;
      totalPossible += r.possible;
      allMistakes = allMistakes.concat(r.mistakes);
    });

    var totalPct = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
    var cambridgeScore = window.CAE.Store.percentToCambridge(totalPct);

    window.CAE.Store.recordAttempt({
      module: 'reading',
      scope: 'full',
      earned: totalEarned,
      possible: totalPossible,
      cambridgeScore: cambridgeScore,
      mistakes: allMistakes,
      partBreakdown: breakdown
    });

    session.fullSubmitted = true;
    session.lastFullSummary = {
      results: results,
      totalEarned: totalEarned,
      totalPossible: totalPossible,
      totalPct: totalPct,
      cambridgeScore: cambridgeScore,
      mistakeCount: allMistakes.length,
      elapsedSec: elapsedSec
    };

    window.CAE.Core.setTopAction('View Summary', function () {
      showFullSummaryModal(session.lastFullSummary);
    });

    showFullSummaryModal(session.lastFullSummary);
  }

  /* ================= PART PANEL BUILDERS ================= */
  function buildPartHeaderHtml(partKey) {
    var meta = PART_META[partKey];
    return (
      '<div class="rdg-part-head">' +
        '<div class="rdg-part-head-info">' +
          '<h3 class="rdg-part-title">' + esc(meta.title) + '</h3>' +
          '<p class="rdg-part-hint">' + esc(meta.hint) + '</p>' +
        '</div>' +
        '<div class="rdg-part-actions">' +
          '<span class="rdg-part-score" data-part-score="' + partKey + '" hidden></span>' +
          '<button type="button" class="btn btn-sm" data-check-part="' + partKey + '">Check Answers for This Section</button>' +
        '</div>' +
      '</div>'
    );
  }

  function buildLabeledTextsHtml(title, texts) {
    return (
      (title ? '<h3 class="rdg-article-title">' + esc(title) + '</h3>' : '') +
      '<div class="rdg-text-blocks">' +
        texts.map(function (blk) {
          return (
            '<article class="rdg-text-block">' +
              '<div class="rdg-text-block-head">' +
                '<span class="rdg-letter-badge">' + esc(blk.letter) + '</span>' +
                (blk.heading ? '<span class="rdg-text-block-heading">' + esc(blk.heading) + '</span>' : '') +
              '</div>' +
              '<div class="rdg-prose">' + renderParagraphs(blk.text) + '</div>' +
            '</article>'
          );
        }).join('') +
      '</div>'
    );
  }

  function buildPart5Panel(data) {
    var panel = document.createElement('section');
    panel.className = 'rdg-part-panel';
    panel.setAttribute('data-rdg-panel', 'part5');

    var leftHtml =
      (data.title ? '<h3 class="rdg-article-title">' + esc(data.title) + '</h3>' : '') +
      '<div class="rdg-prose">' + renderParagraphs(data.passage) + '</div>';

    var rightHtml =
      '<div class="rdg-q-list">' +
        data.items.map(function (item) {
          var optsHtml = ['A', 'B', 'C', 'D'].map(function (letter) {
            return (
              '<label class="rdg-p5-opt" data-opt-letter="' + letter + '">' +
                '<input type="radio" name="' + esc(item.id) + '" value="' + letter + '" data-p5-id="' + esc(item.id) + '">' +
                '<span class="rdg-p5-opt-letter">' + letter + '.</span>' +
                '<span>' + esc(item.options[letter]) + '</span>' +
              '</label>'
            );
          }).join('');

          return (
            '<div class="rdg-q-card" data-q-card="' + esc(item.id) + '">' +
              '<div class="rdg-q-head">' +
                '<div class="rdg-q-stem"><span class="rdg-qnum">Q' + item.num + '</span>' + esc(item.stem) + '</div>' +
                '<div class="rdg-q-head-right">' +
                  '<span class="rdg-q-status" data-q-status="' + esc(item.id) + '" hidden></span>' +
                  '<span class="rdg-exp-slot" data-exp-slot="' + esc(item.id) + '"></span>' +
                '</div>' +
              '</div>' +
              '<div class="rdg-p5-options">' + optsHtml + '</div>' +
            '</div>'
          );
        }).join('') +
      '</div>';

    panel.innerHTML =
      buildPartHeaderHtml('part5') +
      '<div class="rdg-split">' +
        '<div class="rdg-pane rdg-left">' + leftHtml + '</div>' +
        '<div class="rdg-pane rdg-right">' + rightHtml + '</div>' +
      '</div>';

    return panel;
  }

  function buildPart6Panel(data) {
    var panel = document.createElement('section');
    panel.className = 'rdg-part-panel';
    panel.setAttribute('data-rdg-panel', 'part6');

    var leftHtml = buildLabeledTextsHtml(data.title, data.texts);

    var rightHtml =
      '<div class="rdg-q-list">' +
        data.items.map(function (item) {
          var pillsHtml = data.letters.map(function (letter) {
            return (
              '<button type="button" class="rdg-p6-pill" data-p6-id="' + esc(item.id) + '" data-p6-letter="' + letter + '" aria-pressed="false">' +
                letter +
              '</button>'
            );
          }).join('');

          return (
            '<div class="rdg-q-card" data-q-card="' + esc(item.id) + '">' +
              '<div class="rdg-q-head">' +
                '<div class="rdg-q-stem"><span class="rdg-qnum">Q' + item.num + '</span>' + esc(item.stem) + '</div>' +
                '<div class="rdg-q-head-right">' +
                  '<span class="rdg-q-status" data-q-status="' + esc(item.id) + '" hidden></span>' +
                  '<span class="rdg-exp-slot" data-exp-slot="' + esc(item.id) + '"></span>' +
                '</div>' +
              '</div>' +
              '<div class="rdg-p6-pills" role="group" aria-label="Question ' + item.num + ' choices">' + pillsHtml + '</div>' +
            '</div>'
          );
        }).join('') +
      '</div>';

    panel.innerHTML =
      buildPartHeaderHtml('part6') +
      '<div class="rdg-split">' +
        '<div class="rdg-pane rdg-left">' + leftHtml + '</div>' +
        '<div class="rdg-pane rdg-right">' + rightHtml + '</div>' +
      '</div>';

    return panel;
  }

  function buildPart7Panel(data) {
    var panel = document.createElement('section');
    panel.className = 'rdg-part-panel';
    panel.setAttribute('data-rdg-panel', 'part7');

    /* Split base article around [[GAP:XX]] markers */
    var segments = data.article.split(/(\[\[GAP\s*:\s*\d+\]\])/gi);
    var articleHtml = segments.map(function (seg) {
      var gm = seg.match(/^\[\[GAP\s*:\s*(\d+)\]\]$/i);
      if (gm) {
        var gapNum = parseInt(gm[1], 10);
        return '<div class="rdg-p7-gap is-empty" data-p7-gap="' + gapNum + '" tabindex="0" role="region" aria-label="Gap ' + gapNum + ' drop zone"></div>';
      }
      return seg.trim() ? ('<div class="rdg-prose">' + renderParagraphs(seg) + '</div>') : '';
    }).join('');

    var leftHtml =
      (data.title ? '<h3 class="rdg-article-title">' + esc(data.title) + '</h3>' : '') +
      articleHtml;

    var rightHtml =
      '<div class="rdg-p7-pool-head">' +
        '<span class="rdg-p7-pool-title">PARAGRAPH OPTIONS (DRAG INTO GAPS)</span>' +
        '<span class="rdg-p7-pool-status" id="rdg-p7-pool-status"></span>' +
      '</div>' +
      '<div class="rdg-p7-pool" id="rdg-p7-pool"></div>';

    panel.innerHTML =
      buildPartHeaderHtml('part7') +
      '<div class="rdg-split">' +
        '<div class="rdg-pane rdg-left">' + leftHtml + '</div>' +
        '<div class="rdg-pane rdg-right">' + rightHtml + '</div>' +
      '</div>';

    return panel;
  }

  function buildPart8Panel(data) {
    var panel = document.createElement('section');
    panel.className = 'rdg-part-panel';
    panel.setAttribute('data-rdg-panel', 'part8');

    var leftHtml = buildLabeledTextsHtml(data.title, data.texts);

    var optsMarkup = '<option value="">—</option>' + data.letters.map(function (l) {
      return '<option value="' + l + '">' + l + '</option>';
    }).join('');

    var rightHtml =
      '<div class="rdg-p8-list">' +
        data.items.map(function (item) {
          return (
            '<div class="rdg-p8-row" data-p8-row="' + esc(item.id) + '">' +
              '<span class="rdg-p8-qnum">Q' + item.num + '</span>' +
              '<span class="rdg-p8-stem">' + esc(item.stem) + '</span>' +
              '<span class="rdg-p8-ctrl-wrap">' +
                '<select class="rdg-p8-select" data-p8-id="' + esc(item.id) + '" aria-label="Question ' + item.num + '">' +
                  optsMarkup +
                '</select>' +
                '<span class="rdg-p8-corr" data-p8-corr="' + esc(item.id) + '" hidden></span>' +
                '<span class="rdg-exp-slot" data-exp-slot="' + esc(item.id) + '"></span>' +
              '</span>' +
            '</div>'
          );
        }).join('') +
      '</div>';

    panel.innerHTML =
      buildPartHeaderHtml('part8') +
      '<div class="rdg-split">' +
        '<div class="rdg-pane rdg-left">' + leftHtml + '</div>' +
        '<div class="rdg-pane rdg-right rdg-p8-right">' + rightHtml + '</div>' +
      '</div>';

    return panel;
  }

  /* ================= PART SWITCHING & HIGHLIGHTER BINDING ================= */
  function bindHighlighterForActivePart() {
    if (!session || !window.CAE.Core) return;
    var activePanel = session.panels[session.activePart];
    if (!activePanel) return;
    var leftPane = activePanel.querySelector('.rdg-left');
    if (leftPane) {
      window.CAE.Core.enableHighlighter(leftPane);
    }
  }

  function switchPart(partKey) {
    if (!session || !session.panels[partKey]) return;
    if (window.CAE.Core && typeof window.CAE.Core.hideExplanation === 'function') {
      window.CAE.Core.hideExplanation();
    }
    session.activePart = partKey;

    PART_KEYS.forEach(function (pk) {
      session.panels[pk].hidden = (pk !== partKey);
    });

    var nav = document.getElementById('ws-bottom-nav');
    if (nav) {
      nav.querySelectorAll('.ws-part-tab').forEach(function (btn) {
        btn.classList.toggle('is-active', btn.getAttribute('data-part-id') === partKey);
      });
    }

    bindHighlighterForActivePart();
  }

  /* ================= PARSE ERROR VIEW ================= */
  function renderParseError(containerEl, errorMsg) {
    window.CAE.Core.stopTimer();
    window.CAE.Core.setTopAction(null);
    window.CAE.Core.setBottomNav([]);
    window.CAE.Core.setScopePill('Parse Error');

    var specSample = [
      '=== PART 5 ===',
      'TITLE: Article Title',
      'Passage paragraphs...',
      '=== QUESTIONS ===',
      'Q31: Question stem?',
      'A: Option A',
      'B: Option B',
      'C: Option C',
      'D: Option D',
      'ANS: B',
      'EXP: Why B is right (optional)',
      'WA: Why A is wrong (optional)',
      '',
      '=== PART 6 ===',
      'TITLE: Cross-Text Title',
      '[A] Text A...',
      '[B] Text B...',
      '=== QUESTIONS ===',
      'Q37: Which writer shares B\'s view? | ANS: C | EXP: Reason | WA: Why A fails',
      '',
      '=== PART 7 ===',
      'TITLE: Gapped Text Title',
      'Base paragraph... [[GAP:41]] Next paragraph...',
      '=== OPTIONS ===',
      '[A] Extracted paragraph A...',
      'NOTE: Optional cohesion note (hidden from card)',
      '=== ANSWERS ===',
      '41=C | EXP: Why C fits Gap 41 (or legacy: 41=C, 42=A, ...)',
      '',
      '=== PART 8 ===',
      'TITLE: Multiple Matching Title',
      '[A] Section A...',
      '=== QUESTIONS ===',
      'Q47: Which section mentions...? | ANS: B | EXP: Paraphrase link | TRAP: Decoy note'
    ].join('\n');

    containerEl.innerHTML =
      '<div class="rdg-error-card" role="alert">' +
        '<h3 class="rdg-error-title">READING PARSE ERROR</h3>' +
        '<p class="rdg-error-msg">' + esc(errorMsg) + '</p>' +
        '<pre class="rdg-error-spec">' + esc(specSample) + '</pre>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px;">' +
          '<button type="button" class="btn btn-sm" id="rdg-err-retry">Upload Different File</button>' +
          '<button type="button" class="btn btn-primary btn-sm" id="rdg-err-hub">Back to Hub</button>' +
        '</div>' +
      '</div>';

    var retryBtn = containerEl.querySelector('#rdg-err-retry');
    var hubBtn = containerEl.querySelector('#rdg-err-hub');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        window.CAE.Core.showHub();
        window.CAE.Core.openUploadGate('reading');
      });
    }
    if (hubBtn) {
      hubBtn.addEventListener('click', function () {
        window.CAE.Core.showHub();
      });
    }
  }

  /* ================= PART 7 DRAG-AND-DROP WIRING ================= */
  function attachPart7Events(p7Panel) {
    var poolEl = p7Panel.querySelector('#rdg-p7-pool');

    p7Panel.addEventListener('dragstart', function (e) {
      if (e.target.closest('.cae-exp-btn') || e.target.closest('[data-p7-return]')) {
        e.preventDefault();
        return;
      }

      var card = e.target.closest('[data-p7-card]');
      if (card) {
        var letter = card.getAttribute('data-p7-card');
        session.p7Drag = { letter: letter, fromGap: null };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', letter);
        card.classList.add('is-dragging');
        return;
      }

      var placedBody = e.target.closest('[data-p7-placed-letter]');
      if (placedBody) {
        var placedLetter = placedBody.getAttribute('data-p7-placed-letter');
        var fromGap = parseInt(placedBody.getAttribute('data-p7-placed-gap'), 10);
        session.p7Drag = { letter: placedLetter, fromGap: fromGap };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', placedLetter);
      }
    });

    p7Panel.addEventListener('dragend', function () {
      session.p7Drag = null;
      p7Panel.querySelectorAll('.is-dragging, .is-dragover').forEach(function (el) {
        el.classList.remove('is-dragging', 'is-dragover');
      });
    });

    p7Panel.addEventListener('dragover', function (e) {
      var gapEl = e.target.closest('.rdg-p7-gap');
      if (gapEl) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        gapEl.classList.add('is-dragover');
        return;
      }

      if (poolEl && poolEl.contains(e.target) && session.p7Drag && session.p7Drag.fromGap) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        poolEl.classList.add('is-dragover');
      }
    });

    p7Panel.addEventListener('dragleave', function (e) {
      var gapEl = e.target.closest('.rdg-p7-gap');
      if (gapEl && !gapEl.contains(e.relatedTarget)) {
        gapEl.classList.remove('is-dragover');
      }
      if (poolEl && e.target === poolEl && !poolEl.contains(e.relatedTarget)) {
        poolEl.classList.remove('is-dragover');
      }
    });

    p7Panel.addEventListener('drop', function (e) {
      var gapEl = e.target.closest('.rdg-p7-gap');
      if (gapEl) {
        e.preventDefault();
        gapEl.classList.remove('is-dragover');
        var gapNum = parseInt(gapEl.getAttribute('data-p7-gap'), 10);
        var letter = (session.p7Drag && session.p7Drag.letter) || String(e.dataTransfer.getData('text/plain') || '').trim().toUpperCase();
        var fromGap = session.p7Drag ? session.p7Drag.fromGap : null;
        session.p7Drag = null;
        if (letter) {
          placePart7Card(gapNum, letter, fromGap);
        }
        return;
      }

      if (poolEl && poolEl.contains(e.target) && session.p7Drag && session.p7Drag.fromGap) {
        e.preventDefault();
        poolEl.classList.remove('is-dragover');
        var srcGap = session.p7Drag.fromGap;
        session.p7Drag = null;
        returnPart7Card(srcGap);
      }
    });

    /* Secondary interaction: Click card to select -> Click gap to place */
    p7Panel.addEventListener('click', function (e) {
      if (e.target.closest('.cae-exp-btn')) return;

      var returnBtn = e.target.closest('[data-p7-return]');
      if (returnBtn) {
        e.stopPropagation();
        var rGap = parseInt(returnBtn.getAttribute('data-p7-return'), 10);
        returnPart7Card(rGap);
        return;
      }

      var card = e.target.closest('[data-p7-card]');
      if (card) {
        var letter = card.getAttribute('data-p7-card');
        session.p7SelectedLetter = (session.p7SelectedLetter === letter) ? null : letter;
        renderPart7Pool();
        refreshPart7GapTargetability();
        return;
      }

      var gapEl = e.target.closest('.rdg-p7-gap');
      if (gapEl && session.p7SelectedLetter) {
        var targetGap = parseInt(gapEl.getAttribute('data-p7-gap'), 10);
        placePart7Card(targetGap, session.p7SelectedLetter, null);
      }
    });

    p7Panel.addEventListener('keydown', function (e) {
      if (e.target.closest('.cae-exp-btn')) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest('[data-p7-card]');
      if (card) {
        e.preventDefault();
        card.click();
        return;
      }
      var gapEl = e.target.closest('.rdg-p7-gap');
      if (gapEl && session.p7SelectedLetter) {
        e.preventDefault();
        gapEl.click();
      }
    });
  }

  /* ================= LIFECYCLE: MOUNT & UNMOUNT ================= */
  function unmount() {
    if (!session) return;
    if (session.shell && session.onClick) {
      session.shell.removeEventListener('click', session.onClick);
    }
    if (session.shell && session.onChange) {
      session.shell.removeEventListener('change', session.onChange);
    }
    if (window.CAE.Core) {
      window.CAE.Core.stopTimer();
      window.CAE.Core.disableHighlighter();
      if (typeof window.CAE.Core.hideExplanation === 'function') {
        window.CAE.Core.hideExplanation();
      }
    }
    session = null;
  }

  function mount(containerEl, rawTxt) {
    unmount();
    injectStyles();

    var parsedResult = parseReadingText(rawTxt);
    if (parsedResult.error) {
      renderParseError(containerEl, parsedResult.error);
      return;
    }

    var shell = document.createElement('div');
    shell.className = 'rdg-shell';

    var panels = {
      part5: buildPart5Panel(parsedResult.parts.part5),
      part6: buildPart6Panel(parsedResult.parts.part6),
      part7: buildPart7Panel(parsedResult.parts.part7),
      part8: buildPart8Panel(parsedResult.parts.part8)
    };

    PART_KEYS.forEach(function (pk) {
      panels[pk].hidden = (pk !== 'part5');
      shell.appendChild(panels[pk]);
    });

    containerEl.innerHTML = '';
    containerEl.appendChild(shell);

    session = {
      containerEl: containerEl,
      shell: shell,
      parsed: parsedResult,
      panels: panels,
      activePart: 'part5',
      answers: {
        part5: {},
        part6: {},
        part7: {},
        part8: {}
      },
      p7Drag: null,
      p7SelectedLetter: null,
      partChecked: { part5: false, part6: false, part7: false, part8: false },
      partDirty: { part5: true, part6: true, part7: true, part8: true },
      fullSubmitted: false,
      lastFullSummary: null,
      onClick: null,
      onChange: null
    };

    /* Initialize Part 7 empty gap slots & right paragraph pool */
    parsedResult.parts.part7.items.forEach(function (item) {
      var gapEl = panels.part7.querySelector('.rdg-p7-gap[data-p7-gap="' + item.num + '"]');
      if (gapEl) renderPart7GapElement(gapEl, item.num);
    });
    renderPart7Pool();
    attachPart7Events(panels.part7);

    /* Delegated click events: per-part check & Part 6 pills */
    session.onClick = function (e) {
      var checkBtn = e.target.closest('[data-check-part]');
      if (checkBtn) {
        handleCheckSinglePart(checkBtn.getAttribute('data-check-part'));
        return;
      }

      var p6Pill = e.target.closest('.rdg-p6-pill[data-p6-id]');
      if (p6Pill) {
        var qId = p6Pill.getAttribute('data-p6-id');
        var letter = p6Pill.getAttribute('data-p6-letter');
        session.answers.part6[qId] = letter;

        var card = p6Pill.closest('[data-q-card]');
        if (card) {
          card.querySelectorAll('.rdg-p6-pill').forEach(function (btn) {
            var isSel = btn === p6Pill;
            btn.classList.toggle('is-selected', isSel);
            btn.classList.remove('is-correct', 'is-wrong', 'is-key-reveal');
            btn.setAttribute('aria-pressed', isSel ? 'true' : 'false');
          });
          var statusEl = card.querySelector('[data-q-status="' + qId + '"]');
          if (statusEl) statusEl.hidden = true;
        }
        clearExplanationBadge(panels.part6, qId);
        markPartModified('part6');
      }
    };

    /* Delegated change events: Part 5 radios & Part 8 dropdowns */
    session.onChange = function (e) {
      var target = e.target;
      if (!target) return;

      if (target.hasAttribute('data-p5-id')) {
        var p5Id = target.getAttribute('data-p5-id');
        session.answers.part5[p5Id] = target.value;
        var card = target.closest('[data-q-card]');
        if (card) {
          card.querySelectorAll('.rdg-p5-opt').forEach(function (opt) {
            opt.classList.toggle('is-selected', opt.getAttribute('data-opt-letter') === target.value);
            opt.classList.remove('is-correct', 'is-wrong', 'is-key-reveal');
          });
          var statusEl = card.querySelector('[data-q-status="' + p5Id + '"]');
          if (statusEl) statusEl.hidden = true;
        }
        clearExplanationBadge(panels.part5, p5Id);
        markPartModified('part5');
        return;
      }

      if (target.hasAttribute('data-p8-id')) {
        var p8Id = target.getAttribute('data-p8-id');
        session.answers.part8[p8Id] = target.value;
        target.classList.remove('is-correct', 'is-wrong');
        var corr = panels.part8.querySelector('[data-p8-corr="' + p8Id + '"]');
        if (corr) corr.hidden = true;
        clearExplanationBadge(panels.part8, p8Id);
        markPartModified('part8');
      }
    };

    shell.addEventListener('click', session.onClick);
    shell.addEventListener('change', session.onChange);

    /* Configure Workspace Chrome */
    var totalQ = PART_KEYS.reduce(function (sum, pk) {
      return sum + parsedResult.parts[pk].items.length;
    }, 0);
    window.CAE.Core.setScopePill(totalQ + ' Qs · Parts 5–8');
    window.CAE.Core.setTopAction('Check Test', handleFullCheck);

    var navItems = PART_KEYS.map(function (pk) {
      var total = parsedResult.parts[pk].items.length;
      return {
        id: pk,
        label: PART_META[pk].short + ' (0/' + total + ')',
        done: false
      };
    });
    window.CAE.Core.setBottomNav(navItems, 'part5', switchPart);

    /* Start 45-minute CAE Reading timer & enable zero-reflow highlighter on active left pane */
    window.CAE.Core.startTimer(45);
    bindHighlighterForActivePart();
  }

  return {
    mount: mount,
    unmount: unmount
  };
})();