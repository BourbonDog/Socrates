#!/usr/bin/env node
// Builds the study guide's two HTML copies from skills/socrates/study-guide.md:
//   skills/socrates/study-guide.html  ships with the skill; self-contained, works offline
//   docs/study-guide/index.html       the website copy; uses docs/site.css
//
// The markdown stays plain (Socrates reads it; GitHub renders it). This builder adds the page
// structure from the shape the markdown already has: each ## is a chapter (shown as a tab),
// each ### a card or a topic, a callout's label sets its kind, "How to apply it." becomes a
// panel, "Good for:" becomes tags, and a few known tables become the technique finder, the
// review timeline, the study-day schedule, and the cheat-sheet cards.
//
// Run after editing the guide:  node tools/build-guide.mjs
// Check without writing:        node tools/build-guide.mjs --check   (exits 1 if a copy is stale)
//
// A maintainer tool with no dependencies. The skill itself never runs it.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'skills/socrates/study-guide.md';
const STYLESHEET = 'docs/site.css';
const FONT_DIR = 'docs/fonts';
const OUTPUTS = { local: 'skills/socrates/study-guide.html', site: 'docs/study-guide/index.html' };
const SITE_URL = 'https://bourbondog.github.io/Socrates/';
const REPO_URL = 'https://github.com/BourbonDog/Socrates';

// Layout, keyed by heading ids. A test fails if any of these stops matching study-guide.md.
export const CHAPTERS = {
  'start-here': { tab: 'Start here' },
  'the-core-techniques': { tab: 'Techniques', layout: 'cards' },
  'matching-techniques-to-subjects': { tab: 'By subject', layout: 'grid' },
  'studying-in-multiple-formats': { tab: 'Study formats', layout: 'cards' },
  'neurodivergent-learners': { tab: 'Neurodivergent', layout: 'cards' },
  'building-your-study-system': { tab: 'Study system' },
  'the-one-page-cheat-sheet': { tab: 'Cheat sheet', printable: true },
  'about-this-guide': { tab: 'About' },
};

// Sections inside a card layout that read better as plain text after the cards.
export const PLAIN_SECTIONS = new Set([
  'when-a-technique-isnt-working-switch-it-up',
  'stacking-formats-for-stronger-memory',
]);

const FINDER_SECTION = 'quick-technique-finder';
const GLANCE_SECTION = 'the-14-techniques-at-a-glance';
const CHEATSHEET_CALENDAR = 'the-review-calendar';

// The header line counts cards in these chapters.
const COUNTS = [
  ['the-core-techniques', 'technique', 'techniques'],
  ['matching-techniques-to-subjects', 'subject', 'subjects'],
  ['neurodivergent-learners', 'neurodivergent profile', 'neurodivergent profiles'],
];

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='10' fill='%231c1b19'/%3E%3Ctext x='32' y='46' font-size='40' text-anchor='middle' fill='%23ffffff' font-family='Georgia,serif'%3E%CE%A3%3C/text%3E%3C/svg%3E";

const FONT_NOTICE = "/* Source Serif 4 is embedded below. Copyright 2014 - 2023 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'. Licensed under the SIL Open Font License 1.1: https://openfontlicense.org */\n";

// ---------- inline markdown ----------

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[*_`"“”'’()[\]]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const opensQuote = (prev) => prev === '' || /[\s([{“‘—–]/.test(prev);

// Straight quotes to curly ones, judged by the last visible character, so markup never confuses it.
function curlQuotes(html) {
  let out = '';
  let prev = '';
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    if (c === '<') {
      const end = html.indexOf('>', i);
      out += html.slice(i, end + 1);
      i = end;
      continue;
    }
    let ch = c;
    if (c === '"') ch = opensQuote(prev) ? '“' : '”';
    else if (c === "'") ch = opensQuote(prev) && /[A-Za-z0-9]/.test(html[i + 1] || '') ? '‘' : '’';
    out += ch;
    prev = ch;
  }
  return out;
}

export function renderInline(text) {
  let s = escapeHtml(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>');
  return curlQuotes(s);
}

// ---------- parsing ----------

const BLOCK_START = /^(#{1,3}\s|>|\||- |\d+\. )/;

function parseTable(rows) {
  const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const [head, separator, ...body] = rows;
  if (!separator || !/^[\s|:-]+$/.test(separator)) {
    throw new Error(`A table needs a header separator row (|---|) after: ${head}`);
  }
  return { head: cells(head), body: body.map(cells) };
}

function parseBlocks(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  const take = (re) => {
    const run = [];
    while (i < lines.length && re.test(lines[i])) run.push(lines[i++]);
    return run;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const heading = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (heading) { blocks.push({ type: `h${heading[1].length}`, text: heading[2] }); i++; continue; }
    if (line.startsWith('>')) {
      blocks.push({ type: 'quote', text: take(/^>/).map((l) => l.replace(/^>\s?/, '')).join(' ').trim() });
      continue;
    }
    if (line.startsWith('|')) { blocks.push({ type: 'table', rows: parseTable(take(/^\|/)) }); continue; }
    if (/^- /.test(line)) { blocks.push({ type: 'ul', items: take(/^- /).map((l) => l.slice(2)) }); continue; }
    if (/^\d+\. /.test(line)) { blocks.push({ type: 'ol', items: take(/^\d+\. /).map((l) => l.replace(/^\d+\. /, '')) }); continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) para.push(lines[i++].trim());
    blocks.push({ type: 'p', text: para.join(' ') });
  }
  return blocks;
}

// # title, first paragraph = subtitle, ## = chapters, ### = sections within a chapter.
export function parseGuide(md) {
  const guide = { title: '', subtitle: '', chapters: [] };
  const seen = new Map();
  const uniqueId = (text) => {
    const base = slugify(text) || 'section';
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
  let chapter = null;
  let section = null;
  for (const b of parseBlocks(md)) {
    if (b.type === 'h1') { guide.title = b.text; continue; }
    if (!chapter && b.type === 'p' && !guide.subtitle) { guide.subtitle = b.text; continue; }
    if (b.type === 'h2') {
      chapter = { id: uniqueId(b.text), title: b.text, intro: [], sections: [] };
      guide.chapters.push(chapter);
      section = null;
      continue;
    }
    if (!chapter) throw new Error(`Only the title and a subtitle may come before the first ## chapter: ${b.text || b.type}`);
    if (b.type === 'h3') {
      section = { id: uniqueId(b.text), title: b.text, blocks: [] };
      chapter.sections.push(section);
      continue;
    }
    (section ? section.blocks : chapter.intro).push(b);
  }
  return guide;
}

// ---------- rendering ----------

const isCalendar = (rows) => rows.head[0] === 'Day' && rows.body.length > 0 && rows.body[0][0] === 'Day 1';

function calloutKind(label) {
  if (/ADHD/.test(label)) return 'adhd';
  if (/^(Caution|Common mistake|Honest caveat|The tool trap|Watch out)/i.test(label)) return 'caution';
  if (/^(Tip|The honest truth|The multi-encoding stack|Non-negotiable|The whole guide|Going further|The three-category|Turn plans)/i.test(label)) return 'tip';
  return 'note';
}

function renderQuote(text) {
  const labeled = /^\*\*(.+?)\*\*\s*(.*)$/.exec(text);
  if (!labeled) return `<blockquote class="pullquote"><p>${renderInline(text)}</p></blockquote>`;
  const label = labeled[1].replace(/[.:]\s*$/, '');
  return `<aside class="callout ${calloutKind(label)}">\n<p class="tag">${renderInline(label)}</p>\n<p>${renderInline(labeled[2])}</p>\n</aside>`;
}

function renderList(block, cls = '') {
  const items = block.items.map((t) => `<li>${renderInline(t)}</li>`).join('\n');
  return `<${block.type}${cls ? ` class="${cls}"` : ''}>\n${items}\n</${block.type}>`;
}

function renderTable(rows, variant = '') {
  const th = rows.head.map((c) => `<th>${renderInline(c)}</th>`).join('');
  const trs = rows.body.map((r) => {
    const cls = variant === 'schedule' && /break/i.test(r[1] || '') ? ' class="break"' : '';
    return `<tr${cls}>${r.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`;
  });
  return `<div class="table-wrap${variant ? ` ${variant}` : ''}">\n<table>\n<thead>\n<tr>${th}</tr>\n</thead>\n<tbody>\n${trs.join('\n')}\n</tbody>\n</table>\n</div>`;
}

function renderTimeline(rows) {
  const items = rows.body.map(([when, what]) => `<li><b>${renderInline(when)}</b><span>${renderInline(what || '')}</span></li>`);
  return `<ol class="timeline">\n${items.join('\n')}\n</ol>`;
}

function renderStopStart(rows) {
  const column = (k) => rows.body.map((r) => r[k]).filter(Boolean).map((t) => `<li>${renderInline(t)}</li>`).join('');
  return `<div class="stop-start">\n<div class="list-card stop">\n<h4>${renderInline(rows.head[0])}</h4>\n<ul>${column(0)}</ul>\n</div>\n<div class="list-card start">\n<h4>${renderInline(rows.head[1])}</h4>\n<ul>${column(1)}</ul>\n</div>\n</div>`;
}

function renderGlance(items) {
  const lis = items.map((t) => {
    const m = /^\*\*(.+?)\*\*\s*—\s*(.*)$/.exec(t);
    return m ? `<li><b>${renderInline(m[1])}</b><span>${renderInline(capitalize(m[2]))}</span></li>` : `<li>${renderInline(t)}</li>`;
  });
  return `<ol class="glance">\n${lis.join('\n')}\n</ol>`;
}

const MYTH = /^\*\*Myth: /;

function renderBlocks(blocks, ctx) {
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];

    if (b.type === 'p') {
      const howto = /^\*\*How to apply it\.\*\*\s*(.*)$/.exec(b.text);
      if (howto) {
        const inner = [];
        if (howto[1]) inner.push(`<p>${renderInline(howto[1])}</p>`);
        else if (next && (next.type === 'ol' || next.type === 'ul')) {
          inner.push(renderList(next, next.type === 'ol' ? 'steps' : ''));
          i++;
        }
        out.push(`<div class="howto">\n<p class="tag">How to apply it</p>\n${inner.join('\n')}\n</div>`);
        continue;
      }
      const goodFor = /^\*Good for:\*\s*(.+)$/.exec(b.text);
      if (goodFor) {
        const tags = goodFor[1].replace(/\.$/, '').split(/,\s*/).map((t) => `<li>${renderInline(capitalize(t))}</li>`);
        out.push(`<ul class="chips" aria-label="Good for">${tags.join('')}</ul>`);
        continue;
      }
      if (MYTH.test(b.text)) {
        const myths = [];
        while (i < blocks.length && blocks[i].type === 'p' && MYTH.test(blocks[i].text)) {
          myths.push(`<li>${renderInline(blocks[i].text.replace(/^\*\*Myth: (.)/, (_, c) => `**${c.toUpperCase()}`))}</li>`);
          i++;
        }
        i--;
        out.push(`<ul class="myths">\n${myths.join('\n')}\n</ul>`);
        continue;
      }
      if (/^\*\*Avoid\b/.test(b.text)) { out.push(`<p class="avoid">${renderInline(b.text)}</p>`); continue; }
      if (/^\*\*(Best combination|Consistency beats duration)/.test(b.text)) { out.push(`<p class="best">${renderInline(b.text)}</p>`); continue; }
      out.push(`<p>${renderInline(b.text)}</p>`);
      continue;
    }

    if (b.type === 'quote') { out.push(renderQuote(b.text)); continue; }

    if (b.type === 'table') {
      if (ctx.section === FINDER_SECTION) {
        const tables = [];
        while (i < blocks.length && blocks[i].type === 'table') tables.push(renderTable(blocks[i++].rows));
        i--;
        out.push(`<div class="finder-tables" data-finder>\n${tables.join('\n')}\n</div>`);
        continue;
      }
      if (isCalendar(b.rows)) { out.push(renderTimeline(b.rows)); continue; }
      if (b.rows.head.join('|') === 'Stop doing|Start doing') { out.push(renderStopStart(b.rows)); continue; }
      if (b.rows.head[0] === 'Time') { out.push(renderTable(b.rows, 'schedule')); continue; }
      out.push(renderTable(b.rows));
      continue;
    }

    if (b.type === 'ol' && ctx.section === GLANCE_SECTION) { out.push(renderGlance(b.items)); continue; }
    out.push(renderList(b));
  }
  return out.join('\n');
}

function renderSection(s, card, ctx) {
  const numbered = card && /^(\d+)\.\s+(.+)$/.exec(s.title);
  const step = /^Step (\d+):\s+(.+)$/.exec(s.title);
  const named = card && !numbered && /^([^:]+):\s+(.+)$/.exec(s.title);
  let head;
  if (numbered) head = `<span class="numeral" aria-hidden="true">${numbered[1]}</span>\n<h3>${renderInline(numbered[2])}</h3>`;
  else if (step) head = `<p class="step-label">Step ${step[1]}</p>\n<h3>${renderInline(step[2])}</h3>`;
  else if (named) head = `<h3>${renderInline(named[1])}<span class="h3-sub">${renderInline(capitalize(named[2]))}</span></h3>`;
  else head = `<h3>${renderInline(s.title)}</h3>`;
  let body = renderBlocks(s.blocks, { ...ctx, section: s.id });
  if (s.id === CHEATSHEET_CALENDAR && ctx.calendar) body = `${renderTimeline(ctx.calendar)}\n${body}`;
  return card
    ? `<article class="card${numbered ? ' technique' : ''}" id="${s.id}">\n${head}\n${body}\n</article>`
    : `<section class="topic" id="${s.id}">\n${head}\n${body}\n</section>`;
}

const PRINT_BUTTON = '<button class="print-cheatsheet" type="button" data-print-cheatsheet>Print the cheat sheet</button>';

function renderChapter(ch, index, chapters, ctx) {
  const cfg = CHAPTERS[ch.id] || {};
  const inCards = cfg.layout === 'cards' || cfg.layout === 'grid';
  const isCard = (s) => inCards && !PLAIN_SECTIONS.has(s.id);
  const out = [
    `<section class="chapter" id="${ch.id}">`,
    `<header class="chapter-head">\n<p class="chapter-num">Chapter ${index + 1}</p>\n<h2>${renderInline(ch.title)}</h2>${cfg.printable ? `\n${PRINT_BUTTON}` : ''}\n</header>`,
  ];
  if (ch.intro.length) out.push(renderBlocks(ch.intro, { ...ctx, section: null }));
  for (let i = 0; i < ch.sections.length;) {
    if (cfg.layout === 'grid' && isCard(ch.sections[i])) {
      const group = [];
      while (i < ch.sections.length && isCard(ch.sections[i])) group.push(renderSection(ch.sections[i++], true, ctx));
      out.push(`<div class="card-grid">\n${group.join('\n')}\n</div>`);
      continue;
    }
    out.push(renderSection(ch.sections[i], isCard(ch.sections[i]), ctx));
    i++;
  }
  const next = chapters[index + 1];
  if (next) out.push(`<p class="chapter-next"><a href="#${next.id}">Next chapter: ${renderInline(next.title)}</a></p>`);
  out.push('</section>');
  return out.join('\n');
}

function metaLine(guide) {
  const parts = [];
  for (const [id, one, many] of COUNTS) {
    const ch = guide.chapters.find((c) => c.id === id);
    if (!ch) continue;
    const n = ch.sections.filter((s) => !PLAIN_SECTIONS.has(s.id)).length;
    parts.push(`${n} ${n === 1 ? one : many}`);
  }
  if (guide.chapters.some((c) => (CHAPTERS[c.id] || {}).printable)) parts.push('a one-page cheat sheet');
  return parts.join(' · ');
}

export function renderGuide(guide) {
  const blocks = guide.chapters.flatMap((c) => [...c.intro, ...c.sections.flatMap((s) => s.blocks)]);
  const calendar = blocks.find((b) => b.type === 'table' && isCalendar(b.rows));
  const ctx = { calendar: calendar ? calendar.rows : null };
  const tabs = guide.chapters.map((c) => `<li><a href="#${c.id}">${renderInline((CHAPTERS[c.id] || {}).tab || c.title)}</a></li>`);
  return {
    title: renderInline(guide.title),
    subtitle: renderInline(guide.subtitle),
    meta: metaLine(guide),
    nav: `<nav class="chapters" aria-label="Chapters">\n<div class="wrap">\n<ol>\n${tabs.join('\n')}\n<li class="all"><a href="#all">Whole guide</a></li>\n</ol>\n</div>\n</nav>`,
    html: guide.chapters.map((ch, i, all) => renderChapter(ch, i, all, ctx)).join('\n'),
  };
}

// ---------- page ----------

function embedFonts(css, fonts) {
  return css.replace(/url\((["']?)fonts\/([^"')]+)\1\)/g, (_, _quote, name) => {
    const data = fonts[name];
    if (!data) throw new Error(`${STYLESHEET} uses fonts/${name}, but that font was not provided`);
    return `url("data:font/woff2;base64,${Buffer.from(data).toString('base64')}")`;
  });
}

const stripTags = (html) => html.replace(/<[^>]+>/g, '');

// Chapters as tabs, the technique finder, and the cheat-sheet print button. Without this
// script the guide still works: every chapter shows, one after another, and the finder's
// tables stand in for it.
const GUIDE_SCRIPT = `<script>
(function () {
  var doc = document;
  doc.documentElement.classList.add('js');

  var chapters = [].slice.call(doc.querySelectorAll('.chapter'));
  var tabs = [].slice.call(doc.querySelectorAll('.chapters a'));
  var bar = doc.querySelector('.chapters');
  if (chapters.length > 1 && bar) {
    doc.documentElement.classList.add('tabbed');
    var untilFound = 'onbeforematch' in doc.body;
    var show = function (target) {
      doc.documentElement.classList.toggle('show-all', target === 'all');
      chapters.forEach(function (c) {
        if (target === 'all' || c === target) c.removeAttribute('hidden');
        else if (untilFound) c.setAttribute('hidden', 'until-found');
        else c.hidden = true;
      });
      tabs.forEach(function (a) {
        var id = a.getAttribute('href').slice(1);
        if (target === 'all' ? id === 'all' : id === target.id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    };
    // Show the chapter the address points to. A link to a section scrolls to it; switching
    // chapters scrolls only when the reader is already past the header.
    var route = function () {
      var id = decodeURIComponent(location.hash.slice(1));
      var el = id && id !== 'all' ? doc.getElementById(id) : null;
      var chapter = el ? (el.classList.contains('chapter') ? el : el.closest('.chapter')) : null;
      show(id === 'all' ? 'all' : (chapter || chapters[0]));
      if (el && el !== chapter) { el.scrollIntoView({ block: 'start', behavior: 'instant' }); return; }
      var barTop = bar.getBoundingClientRect().top + window.pageYOffset;
      if (id && window.pageYOffset > barTop) window.scrollTo({ top: barTop, behavior: 'instant' });
    };
    tabs.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        history.pushState(null, '', a.getAttribute('href'));
        route();
      });
    });
    chapters.forEach(function (c) {
      // Find-in-page reveals a hidden chapter; switch to it.
      c.addEventListener('beforematch', function () {
        show(c);
        history.replaceState(null, '', '#' + c.id);
      });
    });
    window.addEventListener('hashchange', route);
    window.addEventListener('popstate', route);
    route();
  }

  [].forEach.call(doc.querySelectorAll('[data-finder]'), function (box) {
    var tables = box.querySelectorAll('table');
    if (tables.length < 2) return;
    var questions = ['What are you studying?', 'How much time do you have?'];
    var hint = 'Pick one from each row for a plan.';
    var chosen = [null, null];
    var finder = doc.createElement('div');
    finder.className = 'finder';
    var answer = doc.createElement('div');
    answer.className = 'answer';
    answer.setAttribute('aria-live', 'polite');
    answer.textContent = hint;
    var render = function () {
      if (!chosen[0] || !chosen[1]) { answer.textContent = hint; return; }
      var what = chosen[0].cells, time = chosen[1].cells;
      var when = time[0].textContent;
      var title = doc.createElement('strong');
      title.textContent = what[0].textContent + ', ' + when.charAt(0).toLowerCase() + when.slice(1);
      answer.innerHTML = what[1].innerHTML + ' ' + time[1].innerHTML;
      answer.insertBefore(title, answer.firstChild);
    };
    [0, 1].forEach(function (g) {
      var q = doc.createElement('p');
      q.className = 'q';
      q.textContent = questions[g];
      var row = doc.createElement('div');
      row.className = 'picks';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', questions[g]);
      [].forEach.call(tables[g].tBodies[0].rows, function (tr) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'pick';
        b.setAttribute('aria-pressed', 'false');
        b.textContent = tr.cells[0].textContent;
        b.addEventListener('click', function () {
          [].forEach.call(row.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          chosen[g] = tr;
          render();
        });
        row.appendChild(b);
      });
      finder.appendChild(q);
      finder.appendChild(row);
    });
    finder.appendChild(answer);
    box.parentNode.insertBefore(finder, box);
    box.classList.add('enhanced');
  });

  var printButton = doc.querySelector('[data-print-cheatsheet]');
  if (printButton) {
    printButton.addEventListener('click', function () {
      doc.body.classList.add('cheatsheet-only');
      window.print();
    });
    window.addEventListener('afterprint', function () { doc.body.classList.remove('cheatsheet-only'); });
  }
})();
</script>`;

export function buildPage({ variant, md, css, fonts }) {
  const g = renderGuide(parseGuide(md));
  const site = variant === 'site';
  const description = stripTags(g.subtitle);

  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${stripTags(g.title)}</title>`,
    `<meta name="description" content="${description}">`,
    `<link rel="icon" href="${FAVICON}">`,
  ];
  if (site) {
    head.push(
      `<link rel="canonical" href="${SITE_URL}study-guide/">`,
      `<meta property="og:title" content="${stripTags(g.title)}">`,
      `<meta property="og:description" content="${description}">`,
      '<meta property="og:type" content="article">',
      `<meta property="og:url" content="${SITE_URL}study-guide/">`,
      '<link rel="preload" href="../fonts/source-serif-4-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>',
      '<link rel="stylesheet" href="../site.css">',
    );
  } else {
    head.push(`<style>\n${FONT_NOTICE}${embedFonts(css, fonts)}</style>`);
  }

  const nav = site ? `<header class="site-nav">
  <div class="wrap nav-inner">
    <a class="wordmark" href="../">Socrates</a>
    <nav class="nav-links" aria-label="Site">
      <a href="./" aria-current="page">The study guide</a>
      <a href="../#using">Using Socrates</a>
      <a href="../#install">Install</a>
      <a href="${REPO_URL}">Source</a>
    </nav>
  </div>
</header>
` : '';

  const footer = site
    ? `<footer class="site-foot">
  <div class="wrap foot-inner">
    <span>${renderInline('How to Actually Study, the study guide that comes with Socrates')}</span>
    <span><a href="../">Socrates</a> · <a href="${REPO_URL}">Source on GitHub</a></span>
  </div>
</footer>`
    : `<footer class="site-foot">
  <div class="wrap">
    <p>${renderInline("To print the whole guide, use your browser's Print command; the cheat sheet has a button that prints just that page.")}</p>
  </div>
</footer>`;

  return `<!doctype html>
<html lang="en">
<head>
${head.join('\n')}
</head>
<body class="guide-page">
${nav}
<header class="guide-head">
  <div class="wrap">
    <p class="kicker">${renderInline("A student's guide")}</p>
    <h1>${g.title}</h1>
    <p class="subtitle">${g.subtitle}</p>${g.meta ? `\n    <p class="meta">${g.meta}</p>` : ''}
  </div>
</header>

${g.nav}

<div class="wrap">
<article class="guide">
${g.html}
</article>
</div>

${footer}

${GUIDE_SCRIPT}
</body>
</html>
`;
}

// ---------- files ----------

export function buildAll(root = ROOT) {
  const md = readFileSync(join(root, SOURCE), 'utf8');
  const css = readFileSync(join(root, STYLESHEET), 'utf8');
  const fonts = {};
  for (const [, , name] of css.matchAll(/url\((["']?)fonts\/([^"')]+)\1\)/g)) {
    fonts[name] = readFileSync(join(root, FONT_DIR, name));
  }
  return {
    [OUTPUTS.local]: buildPage({ variant: 'local', md, css, fonts }),
    [OUTPUTS.site]: buildPage({ variant: 'site', md, css, fonts }),
  };
}

export function staleOutputs(built, root = ROOT) {
  return Object.entries(built)
    .filter(([rel, html]) => {
      const path = join(root, rel);
      return !existsSync(path) || readFileSync(path, 'utf8') !== html;
    })
    .map(([rel]) => rel);
}

function main(args) {
  const built = buildAll();
  if (args.includes('--check')) {
    const stale = staleOutputs(built);
    if (stale.length) {
      console.error(`Out of date: ${stale.join(', ')}\nRun: node tools/build-guide.mjs`);
      process.exit(1);
    }
    console.log('The study guide HTML copies are up to date.');
    return;
  }
  for (const [rel, html] of Object.entries(built)) {
    const path = join(ROOT, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, html);
    console.log(`wrote ${rel} (${Math.round(Buffer.byteLength(html) / 1024)} KB)`);
  }
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (invokedDirectly) main(process.argv.slice(2));
