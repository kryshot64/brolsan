window.CAE = window.CAE || {};
window.CAE.Modules = window.CAE.Modules || {};

window.CAE.Modules.uoe = (function () {
  'use strict';

  var STYLE_ID = 'cae-uoe-styles';

  var PART_META = {
    part1: {
      short: 'Part 1',
      title: 'Part 1 · Multiple-Choice Cloze',
      hint: 'Choose the best option (A, B, C, or D) for each gap. 1 mark each.'
    },
    part2: {
      short: 'Part 2',
      title: 'Part 2 · Open Cloze',
      hint: 'Type ONE word that best fits each gap. 1 mark each.'
    },
    part3: {
      short: 'Part 3',
      title: 'Part 3 · Word Formation',
      hint: 'Use the ROOT word beside each gap to form a word that fits the text. 1 mark each.'
    },
    part4: {
      short: 'Part 4',
      title: 'Part 4 · Key Word Transformations',
      hint: 'Complete the second sentence using 3 to 6 words, including the KEY word unchanged. Up to 2 marks each.'
    }
  };

  var PART_KEYS = ['part1', 'part2', 'part3', 'part4'];

  /* Active session state */
  var session = null;

  /* ================= SCOPED STYLES (INJECTED ONCE) ================= */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.uoe-shell { max-width: 940px; margin: 0 auto; padding-bottom: 28px; display: flex; flex-direction: column; gap: 16px; }',
      '.uoe-part-panel { display: flex; flex-direction: column; gap: 14px; }',

      /* Part Header */
      '.uoe-part-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; padding: 14px 18px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }',
      '.uoe-part-head-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }',
      '.uoe-part-title { margin: 0; font-family: var(--font-mono); font-size: 13px; font-weight: 700; letter-spacing: 0.05em; color: var(--text); }',
      '.uoe-part-hint { margin: 0; font-size: 12.5px; color: var(--text-muted); }',
      '.uoe-part-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }',
      '.uoe-part-score { font-family: var(--font-mono); font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: var(--radius-sm); background: var(--accent-soft); border: 1px solid var(--accent-border); color: var(--accent); }',

      /* Passage Card (Parts 1–3) */
      '.uoe-passage-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 26px 30px 34px; box-shadow: var(--shadow-sm); }',
      '.uoe-passage-title { margin: 0 0 18px; font-size: 18px; font-weight: 700; letter-spacing: -0.015em; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 10px; }',
      '.uoe-prose { font-size: 15.5px; line-height: 2.95; color: var(--text); }',
      '.uoe-prose p { margin: 0 0 18px; }',
      '.uoe-prose p:last-child { margin-bottom: 0; }',

      /* Anti-Reflow Inline Token Wrappers */
      '.uoe-token { position: relative; display: inline-flex; align-items: center; gap: 5px; vertical-align: baseline; margin: 0 3px; line-height: 1.2; }',
      '.uoe-qnum { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 5px; border-radius: var(--radius-sm); background: var(--surface-subtle); border: 1px solid var(--border-strong); color: var(--text-secondary); font-family: var(--font-mono); font-size: 11px; font-weight: 700; flex-shrink: 0; user-select: none; }',

      /* Part 1 Fixed-Width Inline Select */
      '.uoe-select { width: 185px; min-width: 170px; max-width: 185px; height: 29px; padding: 0 8px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font-family: var(--font-mono); font-size: 12.5px; font-weight: 500; cursor: pointer; text-overflow: ellipsis; vertical-align: baseline; transition: border-color 120ms ease, background-color 120ms ease; }',
      '.uoe-select:hover { border-color: var(--accent); }',

      /* Parts 2, 3, 4 Fixed-Width Inline Text Inputs */
      '.uoe-input { height: 29px; padding: 0 9px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font-family: var(--font-mono); font-size: 13px; font-weight: 500; transition: border-color 120ms ease, background-color 120ms ease; }',
      '.uoe-input:hover { border-color: var(--accent); }',
      '.uoe-p2-input { width: 160px; min-width: 160px; max-width: 160px; }',
      '.uoe-p3-input { width: 185px; min-width: 185px; max-width: 185px; }',
      '.uoe-p4-input { width: 280px; min-width: 280px; max-width: 100%; height: 32px; margin: 0 6px; vertical-align: baseline; }',

      /* Part 3 Root Pill */
      '.uoe-root-pill { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 999px; background: var(--accent-soft); border: 1px solid var(--accent-border); color: var(--accent); font-family: var(--font-mono); font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; user-select: none; flex-shrink: 0; }',

      /* Zero-Reflow Subtle Correction & Explanation Row (Parts 1–3) */
      '.uoe-feedback-row { position: absolute; left: 0; top: calc(100% + 2px); display: inline-flex; align-items: center; gap: 5px; max-width: 265px; z-index: 3; }',
      '.uoe-corr { max-width: 225px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); font-size: 10.5px; font-weight: 700; color: var(--ok); line-height: 1.15; letter-spacing: 0.01em; pointer-events: auto; }',
      '.uoe-exp-slot { display: inline-flex; align-items: center; flex-shrink: 0; }',
      '.uoe-feedback-row .cae-exp-btn { width: 16px; height: 16px; font-size: 10px; margin-left: 0; }',

      /* Part 4 Card Stack */
      '.uoe-p4-list { display: flex; flex-direction: column; gap: 12px; }',
      '.uoe-p4-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px 20px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 10px; }',
      '.uoe-p4-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }',
      '.uoe-p4-meta { display: flex; align-items: center; gap: 10px; }',
      '.uoe-p4-right-meta { display: inline-flex; align-items: center; gap: 6px; }',
      '.uoe-p4-right-meta .cae-exp-btn { margin-left: 0; }',
      '.uoe-key-pill { display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: var(--radius-sm); background: var(--accent-soft); border: 1px solid var(--accent-border); color: var(--accent); font-family: var(--font-mono); font-size: 12px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; }',
      '.uoe-p4-pts { font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-sm); background: var(--surface-subtle); border: 1px solid var(--border); color: var(--text-muted); }',
      '.uoe-p4-pts.pts-2 { background: var(--ok-soft); border-color: transparent; color: var(--ok); }',
      '.uoe-p4-pts.pts-1 { background: var(--warn-soft); border-color: transparent; color: var(--warn); }',
      '.uoe-p4-pts.pts-0 { background: var(--err-soft); border-color: transparent; color: var(--err); }',
      '.uoe-p4-lead { font-size: 14.5px; color: var(--text-secondary); line-height: 1.55; }',
      '.uoe-p4-target { font-size: 15px; color: var(--text); line-height: 2.2; }',
      '.uoe-p4-feedback { padding-top: 8px; border-top: 1px dashed var(--border); font-family: var(--font-mono); font-size: 12px; color: var(--ok); display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }',
      '.uoe-p4-feedback-label { color: var(--text-muted); font-weight: 600; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.05em; }',
      '.uoe-p4-half-sep { color: var(--accent); font-weight: 700; padding: 0 3px; }',

      /* Grading States */
      '.is-partial { border-color: var(--warn) !important; background: var(--warn-soft) !important; }',

      /* Parse Error Panel */
      '.uoe-error-card { max-width: 720px; margin: 24px auto; background: var(--surface); border: 1px solid var(--err); border-radius: var(--radius-lg); padding: 22px 24px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow-sm); }',
      '.uoe-error-title { margin: 0; font-family: var(--font-mono); font-size: 13px; font-weight: 700; letter-spacing: 0.06em; color: var(--err); }',
      '.uoe-error-msg { margin: 0; font-size: 14px; color: var(--text); line-height: 1.55; }',
      '.uoe-error-spec { margin: 0; padding: 12px 14px; border-radius: var(--radius); background: var(--surface-subtle); border: 1px solid var(--border); font-family: var(--font-mono); font-size: 11.5px; line-height: 1.6; color: var(--text-secondary); overflow-x: auto; white-space: pre-wrap; }',

      /* Summary Modal Table */
      '.uoe-summary-hero { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 14px 16px; border-radius: var(--radius); background: var(--surface-subtle); border: 1px solid var(--border); }',
      '.uoe-summary-scale { font-family: var(--font-mono); font-size: 24px; font-weight: 700; color: var(--accent); }',
      '.uoe-summary-table { width: 100%; border-collapse: collapse; font-size: 13px; }',
      '.uoe-summary-table th, .uoe-summary-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; }',
      '.uoe-summary-table th { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }',
      '.uoe-summary-table td.num, .uoe-summary-table th.num { text-align: right; font-family: var(--font-mono); }',
      '.uoe-summary-table tr:last-child td { border-bottom: 0; }',

      '@media (max-width: 640px) {',
      '  .uoe-passage-card { padding: 18px 16px 24px; }',
      '  .uoe-p4-input { width: 100%; min-width: 0; margin: 4px 0; }',
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

  function normAnswer(str) {
    return String(str == null ? '' : str)
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function containsPhrase(haystack, needle) {
    if (!needle) return false;
    var re = new RegExp('(?:^|\\s|[(\'"-])' + escapeRegex(needle) + '(?:$|\\s|[.,;?!)\'"-])', 'i');
    return re.test(haystack);
  }

  function extractSnippet(fullText, tokenStart, tokenEnd) {
    var cleanBefore = fullText.slice(Math.max(0, tokenStart - 60), tokenStart)
      .replace(/\{\{[\s\S]*?\}\}/g, '___')
      .replace(/\s+/g, ' ')
      .trim();
    var cleanAfter = fullText.slice(tokenEnd, Math.min(fullText.length, tokenEnd + 60))
      .replace(/\{\{[\s\S]*?\}\}/g, '___')
      .replace(/\s+/g, ' ')
      .trim();
    return (cleanBefore ? '...' + cleanBefore + ' ' : '') + '___' + (cleanAfter ? ' ' + cleanAfter + '...' : '');
  }

  /* ================= STRICT-BUT-TOLERANT .TXT PARSER ================= */
  function extractOptionalTitle(blockText) {
    var lines = blockText.replace(/\r\n?/g, '\n').split('\n');
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
    var body = lines.slice(i).join('\n').trim();
    return { title: title, body: body };
  }

  function checkBalancedBraces(body, partLabel) {
    var idx = 0;
    while (idx < body.length) {
      var open = body.indexOf('{{', idx);
      var close = body.indexOf('}}', idx);
      if (close !== -1 && (open === -1 || close < open)) {
        var snippet = body.slice(Math.max(0, close - 24), close + 10).replace(/\s+/g, ' ');
        return partLabel + ': Found stray closing "}}" near "' + snippet + '".';
      }
      if (open === -1) break;
      var nextOpen = body.indexOf('{{', open + 2);
      if (close === -1 || (nextOpen !== -1 && nextOpen < close)) {
        var openSnip = body.slice(open, open + 42).replace(/\s+/g, ' ');
        return partLabel + ': Unclosed token "{{" starting at "' + openSnip + '".';
      }
      idx = close + 2;
    }
    return null;
  }

  function parseInlinePart(partKey, rawBody) {
    var partLabel = PART_META[partKey].short;
    var extracted = extractOptionalTitle(rawBody);
    var body = extracted.body;

    if (!body) {
      return { error: partLabel + ' is empty. Add passage text with inline {{...}} tokens.' };
    }

    var braceErr = checkBalancedBraces(body, partLabel);
    if (braceErr) return { error: braceErr };

    var items = [];
    var tokenRe = /\{\{([\s\S]*?)\}\}/g;
    var match;

    while ((match = tokenRe.exec(body)) !== null) {
      var rawToken = match[1].trim();
      var segments = rawToken.split('|').map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });

      if (segments.length < 2) {
        return { error: partLabel + ': Malformed token "{{' + rawToken + '}}" — expected pipe-separated fields.' };
      }

      var numMatch = segments[0].match(/^Q?\s*(\d+)$/i);
      if (!numMatch) {
        return { error: partLabel + ': Token "{{' + rawToken + '}}" must start with a question number (e.g., 1, 9, 17).' };
      }

      var qNum = parseInt(numMatch[1], 10);
      var fields = segments.slice(1);
      var snippet = extractSnippet(body, match.index, match.index + match[0].length);

      if (partKey === 'part1') {
        var opts = {};
        var ans = '';
        var p1Exp = '';
        var wrongReasons = {};

        for (var i = 0; i < fields.length; i++) {
          var fm = fields[i].match(/^(A|B|C|D|ANS|EXP|WA|WB|WC|WD)\s*:\s*([\s\S]*)$/i);
          if (!fm) {
            return { error: partLabel + ' (Q' + qNum + '): Unrecognized tag "' + fields[i] + '". Expected A–D, ANS, or optional EXP/WA–WD.' };
          }
          var k = fm[1].toUpperCase();
          var v = fm[2].trim();
          if (k === 'ANS') {
            ans = v;
          } else if (k === 'EXP') {
            p1Exp = v;
          } else if (k === 'WA' || k === 'WB' || k === 'WC' || k === 'WD') {
            if (v) wrongReasons[k.charAt(1)] = v;
          } else {
            opts[k] = v;
          }
        }

        var missingOpt = ['A', 'B', 'C', 'D'].find(function (letter) { return !opts[letter]; });
        if (missingOpt) {
          return { error: partLabel + ' (Q' + qNum + '): Missing required option tag "' + missingOpt + ':" in token.' };
        }
        if (!ans) {
          return { error: partLabel + ' (Q' + qNum + '): Missing required "ANS:" tag in token.' };
        }

        var ansLetter = ans.toUpperCase();
        if (!opts[ansLetter]) {
          /* Tolerate if ANS gave the exact option text instead of A/B/C/D */
          var matchedLetter = ['A', 'B', 'C', 'D'].find(function (l) {
            return normAnswer(opts[l]) === normAnswer(ans);
          });
          if (matchedLetter) {
            ansLetter = matchedLetter;
          } else {
            return { error: partLabel + ' (Q' + qNum + '): Invalid "ANS:' + ans + '" — expected A, B, C, or D.' };
          }
        }

        items.push({
          id: 'uoe_p1_q' + qNum + '_' + items.length,
          num: qNum,
          options: opts,
          answer: ansLetter,
          exp: p1Exp,
          wrongReasons: wrongReasons,
          maxPoints: 1,
          context: snippet + ' [A:' + opts.A + ' / B:' + opts.B + ' / C:' + opts.C + ' / D:' + opts.D + ']'
        });
      } else if (partKey === 'part2') {
        var p2AnsRaw = '';
        var p2Exp = '';
        var p2Trap = '';

        for (var j = 0; j < fields.length; j++) {
          var p2m = fields[j].match(/^(ANS|EXP|TRAP)\s*:\s*([\s\S]*)$/i);
          if (!p2m) continue;
          var p2Key = p2m[1].toUpperCase();
          var p2Val = p2m[2].trim();
          if (p2Key === 'ANS') p2AnsRaw = p2Val;
          else if (p2Key === 'EXP') p2Exp = p2Val;
          else if (p2Key === 'TRAP') p2Trap = p2Val;
        }
        if (!p2AnsRaw) {
          return { error: partLabel + ' (Q' + qNum + '): Missing required "ANS:" tag in token "{{' + rawToken + '}}".' };
        }
        var p2Alts = p2AnsRaw.split('/').map(function (s) { return s.trim(); }).filter(Boolean);
        if (!p2Alts.length) {
          return { error: partLabel + ' (Q' + qNum + '): "ANS:" tag is empty.' };
        }

        items.push({
          id: 'uoe_p2_q' + qNum + '_' + items.length,
          num: qNum,
          answers: p2Alts,
          exp: p2Exp,
          trap: p2Trap,
          maxPoints: 1,
          context: snippet
        });
      } else if (partKey === 'part3') {
        var rootWord = '';
        var p3AnsRaw = '';
        var p3Exp = '';
        var p3Trap = '';

        for (var kIdx = 0; kIdx < fields.length; kIdx++) {
          var p3m = fields[kIdx].match(/^(ROOT|ANS|EXP|TRAP)\s*:\s*([\s\S]*)$/i);
          if (!p3m) continue;
          var p3Key = p3m[1].toUpperCase();
          var p3Val = p3m[2].trim();
          if (p3Key === 'ROOT') rootWord = p3Val;
          else if (p3Key === 'ANS') p3AnsRaw = p3Val;
          else if (p3Key === 'EXP') p3Exp = p3Val;
          else if (p3Key === 'TRAP') p3Trap = p3Val;
        }
        if (!rootWord) {
          return { error: partLabel + ' (Q' + qNum + '): Missing required "ROOT:" tag in token "{{' + rawToken + '}}".' };
        }
        if (!p3AnsRaw) {
          return { error: partLabel + ' (Q' + qNum + '): Missing required "ANS:" tag in token "{{' + rawToken + '}}".' };
        }
        var p3Alts = p3AnsRaw.split('/').map(function (s) { return s.trim(); }).filter(Boolean);
        if (!p3Alts.length) {
          return { error: partLabel + ' (Q' + qNum + '): "ANS:" tag is empty.' };
        }

        items.push({
          id: 'uoe_p3_q' + qNum + '_' + items.length,
          num: qNum,
          root: rootWord.toUpperCase(),
          answers: p3Alts,
          exp: p3Exp,
          trap: p3Trap,
          maxPoints: 1,
          context: snippet + ' [ROOT: ' + rootWord.toUpperCase() + ']'
        });
      }
    }

    if (!items.length) {
      return { error: partLabel + ': No inline {{...}} question tokens found.' };
    }

    return {
      title: extracted.title,
      body: body,
      items: items
    };
  }

  function parsePart4(rawBody) {
    var extracted = extractOptionalTitle(rawBody);
    var body = extracted.body;

    if (!body) {
      return { error: 'Part 4 is empty. Add Q25–Q30 transformation lines.' };
    }

    /* Group multi-line question blocks starting with Q<num>: */
    var rawLines = body.split('\n');
    var blocks = [];
    var current = '';

    for (var i = 0; i < rawLines.length; i++) {
      var line = rawLines[i].trim();
      if (!line) continue;
      if (/^Q\s*\d+\s*:/i.test(line)) {
        if (current) blocks.push(current);
        current = line;
      } else if (current) {
        current += ' ' + line;
      } else {
        return { error: 'Part 4: Unexpected line "' + line.slice(0, 60) + '" — each question must start with "Q<number>:".' };
      }
    }
    if (current) blocks.push(current);

    if (!blocks.length) {
      return { error: 'Part 4: No questions found. Expected format "Q25: Lead sentence || KEY: WORD || PRE: ... || POST: ... || ANS: half1|half2".' };
    }

    var items = [];

    for (var b = 0; b < blocks.length; b++) {
      var block = blocks[b];
      var chunks = block.split('||').map(function (c) { return c.trim(); });
      var headMatch = chunks[0].match(/^Q\s*(\d+)\s*:\s*([\s\S]+)$/i);
      if (!headMatch) {
        return { error: 'Part 4: Could not parse lead-in sentence in "' + block.slice(0, 60) + '".' };
      }

      var qNum = parseInt(headMatch[1], 10);
      var lead = headMatch[2].trim();
      var tags = { KEY: null, PRE: null, POST: null, ANS: null, EXP: '', TRAP: '' };

      for (var c = 1; c < chunks.length; c++) {
        if (!chunks[c]) continue;
        var tm = chunks[c].match(/^(KEY|PRE|POST|ANS|EXP|TRAP)\s*:\s*([\s\S]*)$/i);
        if (!tm) {
          return { error: 'Part 4 (Q' + qNum + '): Unrecognized segment "' + chunks[c].slice(0, 50) + '". Expected KEY, PRE, POST, ANS, or optional EXP/TRAP.' };
        }
        tags[tm[1].toUpperCase()] = tm[2].trim();
      }

      if (!tags.KEY) {
        return { error: 'Part 4 (Q' + qNum + '): Missing required "KEY:" tag.' };
      }
      if (tags.PRE === null) {
        return { error: 'Part 4 (Q' + qNum + '): Missing required "PRE:" tag.' };
      }
      if (tags.POST === null) {
        return { error: 'Part 4 (Q' + qNum + '): Missing required "POST:" tag.' };
      }
      if (!tags.ANS) {
        return { error: 'Part 4 (Q' + qNum + '): Missing required "ANS:" tag.' };
      }

      var altStrings = tags.ANS.split('/').map(function (s) { return s.trim(); }).filter(Boolean);
      if (!altStrings.length) {
        return { error: 'Part 4 (Q' + qNum + '): "ANS:" tag contains no valid answers.' };
      }

      var alternatives = altStrings.map(function (alt) {
        var halves = alt.split('|').map(function (h) { return h.trim(); }).filter(Boolean);
        return {
          raw: alt,
          halves: halves,
          full: halves.join(' ')
        };
      });

      items.push({
        id: 'uoe_p4_q' + qNum + '_' + items.length,
        num: qNum,
        lead: lead,
        key: tags.KEY.toUpperCase(),
        pre: tags.PRE,
        post: tags.POST,
        alternatives: alternatives,
        exp: tags.EXP || '',
        trap: tags.TRAP || '',
        maxPoints: 2,
        context: 'Q' + qNum + ': ' + lead + ' [KEY: ' + tags.KEY.toUpperCase() + '] ' + tags.PRE + ' ___ ' + tags.POST
      });
    }

    return {
      title: extracted.title,
      items: items
    };
  }

  function parseUoEText(rawTxt) {
    var text = String(rawTxt || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (!text.trim()) {
      return { error: 'The uploaded file is empty. Expected sections === PART 1 === through === PART 4 ===.' };
    }

    var headerRe = /^\s*===\s*PART\s*([1-4])\s*===\s*$/gim;
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
      return { error: 'No section headers found. Expected === PART 1 ===, === PART 2 ===, === PART 3 ===, and === PART 4 ===.' };
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
    for (var p = 1; p <= 4; p++) {
      if (rawSections['part' + p] === undefined) {
        missing.push('=== PART ' + p + ' ===');
      }
    }
    if (missing.length) {
      return { error: 'Missing required section header(s): ' + missing.join(', ') + '.' };
    }

    var parsed = {};
    for (var idx = 0; idx < PART_KEYS.length; idx++) {
      var pk = PART_KEYS[idx];
      var res = (pk === 'part4')
        ? parsePart4(rawSections[pk])
        : parseInlinePart(pk, rawSections[pk]);
      if (res.error) return { error: res.error };
      parsed[pk] = res;
    }

    return { parts: parsed };
  }

  /* ================= EXPLANATION BADGE INJECTION ================= */
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

  function clearItemFeedback(panel, itemId) {
    var slot = panel.querySelector('[data-exp-slot="' + itemId + '"]');
    if (slot) slot.innerHTML = '';

    var corr = panel.querySelector('[data-corr-id="' + itemId + '"]');
    if (corr) {
      corr.textContent = '';
      corr.hidden = true;
    }

    var fbRow = panel.querySelector('[data-fb-row="' + itemId + '"]');
    if (fbRow) fbRow.hidden = true;
  }

  /* ================= GRADING LOGIC ================= */
  function scorePart4Item(item, userRaw) {
    var userNorm = normAnswer(userRaw);
    if (!userNorm) {
      return { points: 0, matchedAlt: item.alternatives[0] };
    }

    var bestPoints = 0;
    var bestAlt = item.alternatives[0];

    for (var i = 0; i < item.alternatives.length; i++) {
      var alt = item.alternatives[i];
      var fullNorm = normAnswer(alt.full);

      if (userNorm === fullNorm) {
        return { points: 2, matchedAlt: alt };
      }

      if (alt.halves.length >= 2) {
        var h1 = normAnswer(alt.halves[0]);
        var h2 = normAnswer(alt.halves.slice(1).join(' '));
        var hit1 = h1 ? containsPhrase(userNorm, h1) : false;
        var hit2 = h2 ? containsPhrase(userNorm, h2) : false;
        if (hit1 || hit2) {
          if (bestPoints < 1) {
            bestPoints = 1;
            bestAlt = alt;
          }
        }
      }
    }

    return { points: bestPoints, matchedAlt: bestAlt };
  }

  function formatPart4DisplayHtml(alternatives) {
    return alternatives.map(function (alt) {
      if (alt.halves.length >= 2) {
        return alt.halves.map(esc).join('<span class="uoe-p4-half-sep">|</span>');
      }
      return esc(alt.full);
    }).join(' <span style="color:var(--text-muted)">/</span> ');
  }

  function formatPart4DisplayText(alternatives) {
    return alternatives.map(function (alt) { return alt.raw; }).join(' / ');
  }

  function gradePart(partKey) {
    var partData = session.parsed.parts[partKey];
    var panel = session.panels[partKey];
    var earned = 0;
    var possible = 0;
    var mistakes = [];

    partData.items.forEach(function (item) {
      possible += item.maxPoints;
      var ctrl = panel.querySelector('[data-q-id="' + item.id + '"]');
      var userRaw = ctrl ? ctrl.value : '';
      var userTrim = String(userRaw || '').trim();

      if (ctrl) {
        ctrl.classList.remove('is-correct', 'is-wrong', 'is-partial');
      }

      if (partKey === 'part1') {
        var userLetter = userTrim.toUpperCase();
        var isCorrect = userLetter === item.answer;
        var corrEl = panel.querySelector('[data-corr-id="' + item.id + '"]');
        var fbRow = panel.querySelector('[data-fb-row="' + item.id + '"]');
        var correctDisplay = item.answer + ' · ' + item.options[item.answer];
        var userDisplay = userLetter ? (userLetter + ' · ' + (item.options[userLetter] || '')) : '';

        if (isCorrect) {
          earned += 1;
          if (ctrl) ctrl.classList.add('is-correct');
          if (corrEl) { corrEl.hidden = true; corrEl.textContent = ''; }
        } else {
          if (ctrl) ctrl.classList.add('is-wrong');
          if (corrEl) {
            corrEl.textContent = '✓ ' + correctDisplay;
            corrEl.title = 'Correct answer: ' + correctDisplay;
            corrEl.hidden = false;
          }
          mistakes.push({
            part: 'Part 1',
            context: 'Q' + item.num + ': ' + item.context,
            userAnswer: userDisplay || '(blank)',
            correctAnswer: correctDisplay
          });
        }

        var p1WrongReason = (!isCorrect && userLetter && item.wrongReasons && item.wrongReasons[userLetter])
          ? item.wrongReasons[userLetter]
          : undefined;

        var p1HasBadge = attachExplanationBadge(panel, item.id, {
          isCorrect: isCorrect,
          userAnswer: userDisplay,
          correctAnswer: correctDisplay,
          rule: item.exp || '',
          wrongReason: p1WrongReason
        });

        if (fbRow) {
          fbRow.hidden = isCorrect && !p1HasBadge;
        }
      } else if (partKey === 'part2' || partKey === 'part3') {
        var userNorm = normAnswer(userTrim);
        var matched = item.answers.some(function (a) { return normAnswer(a) === userNorm; });
        var corrEl23 = panel.querySelector('[data-corr-id="' + item.id + '"]');
        var fbRow23 = panel.querySelector('[data-fb-row="' + item.id + '"]');
        var fullAnsText = item.answers.join(' / ');

        if (matched) {
          earned += 1;
          if (ctrl) ctrl.classList.add('is-correct');
          if (corrEl23) { corrEl23.hidden = true; corrEl23.textContent = ''; }
        } else {
          if (ctrl) ctrl.classList.add('is-wrong');
          if (corrEl23) {
            corrEl23.textContent = '✓ ' + fullAnsText;
            corrEl23.title = 'Accepted: ' + fullAnsText;
            corrEl23.hidden = false;
          }
          mistakes.push({
            part: PART_META[partKey].short,
            context: 'Q' + item.num + ': ' + item.context,
            userAnswer: userTrim || '(blank)',
            correctAnswer: fullAnsText
          });
        }

        var p23HasBadge = attachExplanationBadge(panel, item.id, {
          isCorrect: matched,
          userAnswer: userTrim,
          correctAnswer: fullAnsText,
          rule: item.exp || '',
          trap: item.trap || ''
        });

        if (fbRow23) {
          fbRow23.hidden = matched && !p23HasBadge;
        }
      } else if (partKey === 'part4') {
        var scored = scorePart4Item(item, userTrim);
        earned += scored.points;

        var ptsBadge = panel.querySelector('[data-p4-pts="' + item.id + '"]');
        var p4FbRow = panel.querySelector('[data-p4-fb="' + item.id + '"]');
        var p4KeyText = formatPart4DisplayText(item.alternatives);

        if (ptsBadge) {
          ptsBadge.textContent = scored.points + ' / 2';
          ptsBadge.classList.remove('pts-0', 'pts-1', 'pts-2');
          ptsBadge.classList.add('pts-' + scored.points);
        }

        if (scored.points === 2) {
          if (ctrl) ctrl.classList.add('is-correct');
          if (p4FbRow) p4FbRow.hidden = true;
        } else {
          if (ctrl) ctrl.classList.add(scored.points === 1 ? 'is-partial' : 'is-wrong');
          if (p4FbRow) {
            p4FbRow.innerHTML =
              '<span class="uoe-p4-feedback-label">' + (scored.points === 1 ? 'Partial (1/2) · Key:' : 'Answer:') + '</span>' +
              '<span>' + formatPart4DisplayHtml(item.alternatives) + '</span>';
            p4FbRow.hidden = false;
          }
          mistakes.push({
            part: 'Part 4',
            context: item.context,
            userAnswer: userTrim || '(blank)',
            correctAnswer: p4KeyText + (scored.points === 1 ? ' (1/2 partial)' : '')
          });
        }

        attachExplanationBadge(panel, item.id, {
          isCorrect: scored.points === 2,
          isPartial: scored.points === 1,
          userAnswer: userTrim,
          correctAnswer: p4KeyText,
          rule: item.exp || '',
          trap: item.trap || ''
        });
      }
    });

    /* Update part header badge & check button */
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
      module: 'uoe',
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
    var elapsedMin = Math.floor(summary.elapsedSec / 60);
    var elapsedRem = summary.elapsedSec % 60;
    var timeStr = String(elapsedMin).padStart(2, '0') + ':' + String(elapsedRem).padStart(2, '0');

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
      '<div class="uoe-summary-hero">' +
        '<div>' +
          '<div class="mono" style="font-size:11px;font-weight:700;letter-spacing:0.07em;color:var(--text-muted);">PROJECTED CAMBRIDGE SCALE</div>' +
          '<div style="display:flex;align-items:baseline;gap:10px;margin-top:2px;">' +
            '<span class="uoe-summary-scale">' + summary.cambridgeScore + '</span>' +
            '<span style="font-weight:600;font-size:14px;">' + esc(grade) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="mono" style="text-align:right;font-size:12.5px;color:var(--text-secondary);">' +
          '<div><strong>' + summary.totalEarned + ' / ' + summary.totalPossible + '</strong> (' + summary.totalPct + '%)</div>' +
          '<div style="font-size:11.5px;color:var(--text-muted);">Time: ' + timeStr + ' · ' + summary.mistakeCount + ' mistakes</div>' +
        '</div>' +
      '</div>' +
      '<table class="uoe-summary-table">' +
        '<thead>' +
          '<tr><th>Section</th><th class="num">Raw</th><th class="num">Accuracy</th><th class="num">Scale</th></tr>' +
        '</thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
      '</table>' +
      '<p class="muted-note" style="margin:0;">Full attempt and mistake log saved to your local CAE Bench history.</p>';

    window.CAE.Core.showModal('USE OF ENGLISH · TEST SUMMARY', bodyHtml, [
      {
        label: 'Review Answers',
        variant: 'ghost'
      },
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
      module: 'uoe',
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

  /* ================= LIVE COUNTS & NAVIGATION ================= */
  function countAnswered(partKey) {
    if (!session || !session.panels[partKey]) return { answered: 0, total: 0 };
    var items = session.parsed.parts[partKey].items;
    var panel = session.panels[partKey];
    var answered = 0;
    items.forEach(function (item) {
      var ctrl = panel.querySelector('[data-q-id="' + item.id + '"]');
      if (ctrl && String(ctrl.value || '').trim().length > 0) {
        answered += 1;
      }
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

    if (session.containerEl) {
      session.containerEl.scrollTop = 0;
    }
  }

  /* ================= RENDERING ================= */
  function renderPassageWithTokens(partKey, partData) {
    var tokenIndex = 0;
    var paragraphs = partData.body.split(/\n\s*\n/);

    return paragraphs.map(function (para) {
      var out = '';
      var lastIdx = 0;
      var tokenRe = /\{\{[\s\S]*?\}\}/g;
      var match;

      while ((match = tokenRe.exec(para)) !== null) {
        var textBefore = para.slice(lastIdx, match.index);
        out += esc(textBefore).replace(/\n/g, '<br>');

        var item = partData.items[tokenIndex++];
        if (item) {
          out += renderInlineControl(partKey, item);
        }
        lastIdx = match.index + match[0].length;
      }

      out += esc(para.slice(lastIdx)).replace(/\n/g, '<br>');
      return '<p>' + out + '</p>';
    }).join('');
  }

  function renderInlineControl(partKey, item) {
    var feedbackRowHtml =
      '<span class="uoe-feedback-row" data-fb-row="' + esc(item.id) + '" hidden>' +
        '<span class="uoe-corr" data-corr-id="' + esc(item.id) + '" hidden></span>' +
        '<span class="uoe-exp-slot" data-exp-slot="' + esc(item.id) + '"></span>' +
      '</span>';

    if (partKey === 'part1') {
      var optsHtml =
        '<option value="">(' + item.num + ') —</option>' +
        ['A', 'B', 'C', 'D'].map(function (letter) {
          return '<option value="' + letter + '">' + item.num + letter + ' · ' + esc(item.options[letter]) + '</option>';
        }).join('');

      return (
        '<span class="uoe-token uoe-p1-token">' +
          '<select class="uoe-select" data-part="part1" data-q-id="' + esc(item.id) + '" aria-label="Question ' + item.num + '">' +
            optsHtml +
          '</select>' +
          feedbackRowHtml +
        '</span>'
      );
    }

    if (partKey === 'part2') {
      return (
        '<span class="uoe-token uoe-p2-token">' +
          '<span class="uoe-qnum">' + item.num + '</span>' +
          '<input type="text" class="uoe-input uoe-p2-input" data-part="part2" data-q-id="' + esc(item.id) + '" ' +
            'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ' +
            'aria-label="Question ' + item.num + '" placeholder="...">' +
          feedbackRowHtml +
        '</span>'
      );
    }

    /* Part 3 */
    return (
      '<span class="uoe-token uoe-p3-token">' +
        '<span class="uoe-qnum">' + item.num + '</span>' +
        '<input type="text" class="uoe-input uoe-p3-input" data-part="part3" data-q-id="' + esc(item.id) + '" ' +
          'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ' +
          'aria-label="Question ' + item.num + ' (' + esc(item.root) + ')" placeholder="...">' +
        '<span class="uoe-root-pill">' + esc(item.root) + '</span>' +
        feedbackRowHtml +
      '</span>'
    );
  }

  function renderPart4Cards(partData) {
    return (
      '<div class="uoe-p4-list">' +
        partData.items.map(function (item) {
          return (
            '<div class="uoe-p4-card">' +
              '<div class="uoe-p4-top">' +
                '<div class="uoe-p4-meta">' +
                  '<span class="uoe-qnum">Q' + item.num + '</span>' +
                  '<span class="uoe-key-pill">' + esc(item.key) + '</span>' +
                '</div>' +
                '<div class="uoe-p4-right-meta">' +
                  '<span class="uoe-p4-pts" data-p4-pts="' + esc(item.id) + '">— / 2</span>' +
                  '<span class="uoe-exp-slot" data-exp-slot="' + esc(item.id) + '"></span>' +
                '</div>' +
              '</div>' +
              '<div class="uoe-p4-lead">' + esc(item.lead) + '</div>' +
              '<div class="uoe-p4-target">' +
                '<span>' + esc(item.pre) + '</span>' +
                '<input type="text" class="uoe-input uoe-p4-input" data-part="part4" data-q-id="' + esc(item.id) + '" ' +
                  'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" ' +
                  'aria-label="Question ' + item.num + ' transformation" placeholder="3–6 words including ' + esc(item.key) + '">' +
                '<span>' + esc(item.post) + '</span>' +
              '</div>' +
              '<div class="uoe-p4-feedback" data-p4-fb="' + esc(item.id) + '" hidden></div>' +
            '</div>'
          );
        }).join('') +
      '</div>'
    );
  }

  function buildPartPanel(partKey, partData) {
    var panel = document.createElement('section');
    panel.className = 'uoe-part-panel';
    panel.setAttribute('data-uoe-panel', partKey);

    var meta = PART_META[partKey];
    var contentHtml;

    if (partKey === 'part4') {
      contentHtml =
        (partData.title ? '<h3 class="uoe-passage-title" style="border:0;margin:0 0 2px;padding:0;">' + esc(partData.title) + '</h3>' : '') +
        renderPart4Cards(partData);
    } else {
      contentHtml =
        '<article class="uoe-passage-card">' +
          (partData.title ? '<h3 class="uoe-passage-title">' + esc(partData.title) + '</h3>' : '') +
          '<div class="uoe-prose">' + renderPassageWithTokens(partKey, partData) + '</div>' +
        '</article>';
    }

    panel.innerHTML =
      '<div class="uoe-part-head">' +
        '<div class="uoe-part-head-info">' +
          '<h3 class="uoe-part-title">' + esc(meta.title) + '</h3>' +
          '<p class="uoe-part-hint">' + esc(meta.hint) + '</p>' +
        '</div>' +
        '<div class="uoe-part-actions">' +
          '<span class="uoe-part-score" data-part-score="' + partKey + '" hidden></span>' +
          '<button type="button" class="btn btn-sm" data-check-part="' + partKey + '">Check Answers for This Section</button>' +
        '</div>' +
      '</div>' +
      contentHtml;

    return panel;
  }

  function renderParseError(containerEl, errorMsg) {
    window.CAE.Core.stopTimer();
    window.CAE.Core.setTopAction(null);
    window.CAE.Core.setBottomNav([]);
    window.CAE.Core.setScopePill('Parse Error');

    var specSample = [
      '=== PART 1 ===',
      'TITLE: Optional Title',
      'Prose with {{1|A:make|B:do|C:take|D:have|ANS:B|EXP:Rule|WA:Why A fails}} inline tokens.',
      '',
      '=== PART 2 ===',
      'Prose with {{9|ANS:despite/notwithstanding|EXP:Rule|TRAP:Common decoy}} open cloze tokens.',
      '',
      '=== PART 3 ===',
      'Prose with {{17|ROOT:SIGNIFY|ANS:insignificant|EXP:Rule|TRAP:Common decoy}} word formation tokens.',
      '',
      '=== PART 4 ===',
      'Q25: Lead sentence || KEY: WORD || PRE: Text before || POST: text after || ANS: half one|half two || EXP: Rule || TRAP: Common trap'
    ].join('\n');

    containerEl.innerHTML =
      '<div class="uoe-error-card" role="alert">' +
        '<h3 class="uoe-error-title">USE OF ENGLISH PARSE ERROR</h3>' +
        '<p class="uoe-error-msg">' + esc(errorMsg) + '</p>' +
        '<pre class="uoe-error-spec">' + esc(specSample) + '</pre>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;padding-top:4px;">' +
          '<button type="button" class="btn btn-sm" id="uoe-err-retry">Upload Different File</button>' +
          '<button type="button" class="btn btn-primary btn-sm" id="uoe-err-hub">Back to Hub</button>' +
        '</div>' +
      '</div>';

    var retryBtn = containerEl.querySelector('#uoe-err-retry');
    var hubBtn = containerEl.querySelector('#uoe-err-hub');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        window.CAE.Core.showHub();
        window.CAE.Core.openUploadGate('uoe');
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
      session.shell.removeEventListener('change', session.onInput);
    }
    if (session.shell && session.onClick) {
      session.shell.removeEventListener('click', session.onClick);
    }
    if (session.shell && session.onKeyDown) {
      session.shell.removeEventListener('keydown', session.onKeyDown);
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

    var parsedResult = parseUoEText(rawTxt);
    if (parsedResult.error) {
      renderParseError(containerEl, parsedResult.error);
      return;
    }

    var shell = document.createElement('div');
    shell.className = 'uoe-shell';

    var panels = {};
    PART_KEYS.forEach(function (pk) {
      var panel = buildPartPanel(pk, parsedResult.parts[pk]);
      panel.hidden = (pk !== 'part1');
      panels[pk] = panel;
      shell.appendChild(panel);
    });

    containerEl.innerHTML = '';
    containerEl.appendChild(shell);

    session = {
      containerEl: containerEl,
      shell: shell,
      parsed: parsedResult,
      panels: panels,
      activePart: 'part1',
      partChecked: { part1: false, part2: false, part3: false, part4: false },
      partDirty: { part1: true, part2: true, part3: true, part4: true },
      fullSubmitted: false,
      lastFullSummary: null,
      onInput: null,
      onClick: null,
      onKeyDown: null
    };

    /* Live count updates + mark section re-checkable if user edits after checking */
    session.onInput = function (e) {
      var target = e.target;
      if (!target || !target.hasAttribute('data-q-id')) return;
      var pk = target.getAttribute('data-part');
      var itemId = target.getAttribute('data-q-id');
      if (!pk) return;

      updateBottomNavTab(pk);

      if (session.partChecked[pk]) {
        session.partDirty[pk] = true;
        target.classList.remove('is-correct', 'is-wrong', 'is-partial');
        clearItemFeedback(session.panels[pk], itemId);
        if (window.CAE.Core && typeof window.CAE.Core.hideExplanation === 'function') {
          window.CAE.Core.hideExplanation();
        }
        var btn = session.panels[pk].querySelector('[data-check-part="' + pk + '"]');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Re-check Answers for This Section';
        }
      }
    };

    /* Per-part check button handler */
    session.onClick = function (e) {
      var btn = e.target.closest('[data-check-part]');
      if (!btn) return;
      var pk = btn.getAttribute('data-check-part');
      handleCheckSinglePart(pk);
    };

    /* Enter key advances focus to the next inline input within the active part */
    session.onKeyDown = function (e) {
      if (e.key !== 'Enter') return;
      var target = e.target;
      if (!target || target.tagName !== 'INPUT' || !target.hasAttribute('data-q-id')) return;
      var pk = target.getAttribute('data-part');
      var inputs = Array.prototype.slice.call(session.panels[pk].querySelectorAll('input[data-q-id]'));
      var idx = inputs.indexOf(target);
      if (idx !== -1 && idx + 1 < inputs.length) {
        e.preventDefault();
        inputs[idx + 1].focus();
      }
    };

    shell.addEventListener('input', session.onInput);
    shell.addEventListener('change', session.onInput);
    shell.addEventListener('click', session.onClick);
    shell.addEventListener('keydown', session.onKeyDown);

    /* Configure Workspace Chrome */
    var totalQ = PART_KEYS.reduce(function (sum, pk) {
      return sum + parsedResult.parts[pk].items.length;
    }, 0);
    window.CAE.Core.setScopePill(totalQ + ' Qs · Parts 1–4');
    window.CAE.Core.setTopAction('Check Test', handleFullCheck);

    var navItems = PART_KEYS.map(function (pk) {
      var total = parsedResult.parts[pk].items.length;
      return {
        id: pk,
        label: PART_META[pk].short + ' (0/' + total + ')',
        done: false
      };
    });
    window.CAE.Core.setBottomNav(navItems, 'part1', switchPart);

    /* Start 45-minute CAE Use of English timer & zero-reflow highlighter */
    window.CAE.Core.startTimer(45);
    window.CAE.Core.enableHighlighter(containerEl);
  }

  return {
    mount: mount,
    unmount: unmount
  };
})();