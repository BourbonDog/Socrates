#!/usr/bin/env node
// Builds the study guide's two HTML copies from skills/socrates/study-guide.md:
//   skills/socrates/study-guide.html  ships with the skill; self-contained, works offline
//   docs/study-guide/index.html       the website copy; uses docs/site.css
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

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='10' fill='%231c1b19'/%3E%3Ctext x='32' y='46' font-size='40' text-anchor='middle' fill='%23ffffff' font-family='Georgia,serif'%3E%CE%A3%3C/text%3E%3C/svg%3E";

const FONT_NOTICE = "/* Source Serif 4 is embedded below. Copyright 2014 - 2023 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'. Licensed under the SIL Open Font License 1.1: https://openfontlicense.org */\n";

// ---------- markdown (the subset study-guide.md uses) ----------

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[*_`"“”'’()[\]]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

function renderTable(rows) {
  const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const [head, separator, ...body] = rows;
  if (!separator || !/^[\s|:-]+$/.test(separator)) {
    throw new Error(`A table needs a header separator row (|---|) after: ${head}`);
  }
  const th = cells(head).map((c) => `<th>${renderInline(c)}</th>`).join('');
  const trs = body.map((r) => `<tr>${cells(r).map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`);
  return `<div class="table-wrap">\n<table>\n<thead>\n<tr>${th}</tr>\n</thead>\n<tbody>\n${trs.join('\n')}\n</tbody>\n</table>\n</div>`;
}

const BLOCK_START = /^(#{1,3}\s|>|\||- |\d+\. )/;

export function renderMarkdown(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  const toc = [];
  const seen = new Map();
  let title = '';
  let subtitle = '';
  let expectSubtitle = false;
  let i = 0;

  const uniqueId = (text) => {
    const base = slugify(text) || 'section';
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
  const take = (re) => {
    const block = [];
    while (i < lines.length && re.test(lines[i])) block.push(lines[i++]);
    return block;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const heading = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      i++;
      const level = heading[1].length;
      const text = heading[2];
      if (level === 1) { title = text; expectSubtitle = true; continue; }
      expectSubtitle = false;
      const id = uniqueId(text);
      if (level === 2) toc.push({ id, text: renderInline(text) });
      html.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
      continue;
    }

    if (line.startsWith('>')) {
      expectSubtitle = false;
      const inner = take(/^>/).map((l) => l.replace(/^>\s?/, '')).join(' ').trim();
      const kind = /^\*\*[^*]+\*\*/.test(inner) ? 'callout' : 'pullquote';
      html.push(`<blockquote class="${kind}"><p>${renderInline(inner)}</p></blockquote>`);
      continue;
    }

    if (line.startsWith('|')) {
      expectSubtitle = false;
      html.push(renderTable(take(/^\|/)));
      continue;
    }

    const list = /^- /.test(line) ? ['ul', /^- /] : /^\d+\. /.test(line) ? ['ol', /^\d+\. /] : null;
    if (list) {
      expectSubtitle = false;
      const [tag, marker] = list;
      const items = take(marker).map((l) => `<li>${renderInline(l.replace(marker, ''))}</li>`);
      html.push(`<${tag}>\n${items.join('\n')}\n</${tag}>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) para.push(lines[i++].trim());
    const text = renderInline(para.join(' '));
    if (expectSubtitle) { subtitle = text; expectSubtitle = false; }
    else html.push(`<p>${text}</p>`);
  }

  return { title: renderInline(title), subtitle, html: html.join('\n'), toc };
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

const SCROLL_SPY = `<script>
(function () {
  var links = document.querySelectorAll('.toc a');
  if (!links.length || !('IntersectionObserver' in window)) return;
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) { a.removeAttribute('aria-current'); });
      var a = byId[e.target.id];
      if (a) a.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '0px 0px -75% 0px' });
  document.querySelectorAll('.prose h2[id]').forEach(function (h) { spy.observe(h); });
})();
</script>`;

export function buildPage({ variant, md, css, fonts }) {
  const g = renderMarkdown(md);
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
    <span>${renderInline("How to Actually Study, the study guide that comes with Socrates")}</span>
    <span><a href="../">Socrates</a> · <a href="${REPO_URL}">Source on GitHub</a></span>
  </div>
</footer>`
    : `<footer class="site-foot">
  <div class="wrap">
    <p>${renderInline("To print this guide, use your browser's Print command. The cheat sheet prints on a page of its own.")}</p>
  </div>
</footer>`;

  const toc = g.toc.map((t) => `      <li><a href="#${t.id}">${t.text}</a></li>`).join('\n');

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
    <p class="subtitle">${g.subtitle}</p>
  </div>
</header>

<div class="wrap guide-layout">
  <nav class="toc" aria-label="Contents">
    <p class="toc-title">Contents</p>
    <ol>
${toc}
    </ol>
  </nav>
  <article class="prose">
${g.html}
  </article>
</div>

${footer}

${SCROLL_SPY}
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
