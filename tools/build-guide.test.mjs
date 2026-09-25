// Tests for build-guide.mjs. Run with: node --test tools/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  slugify, renderInline, parseGuide, renderGuide, buildPage, buildAll, staleOutputs, CHAPTERS, PLAIN_SECTIONS,
} from './build-guide.mjs';

test('slugify makes stable heading ids', () => {
  assert.equal(slugify('The core techniques'), 'the-core-techniques');
  assert.equal(slugify('1. Active recall (self-testing)'), '1-active-recall-self-testing');
  assert.equal(slugify('Step 1: Weekly planning'), 'step-1-weekly-planning');
  assert.equal(slugify('8. Elaborative interrogation (ask "why?")'), '8-elaborative-interrogation-ask-why');
});

test('renderInline handles emphasis, links, and escaping', () => {
  assert.equal(
    renderInline('**bold**, *em*, and [a link](#x)'),
    '<strong>bold</strong>, <em>em</em>, and <a href="#x">a link</a>',
  );
  assert.equal(renderInline('a < b & c > d'), 'a &lt; b &amp; c &gt; d');
  assert.equal(renderInline('*Journal, 14*(1), 4–58.'), '<em>Journal, 14</em>(1), 4–58.');
});

test('renderInline curls quotes and apostrophes, even next to markup', () => {
  assert.equal(renderInline(`"Hi," she said. It's done.`), '“Hi,” she said. It’s done.');
  assert.equal(renderInline('ask ("why?") now'), 'ask (“why?”) now');
  assert.equal(renderInline('**"If it\'s 4 p.m."**'), '<strong>“If it’s 4 p.m.”</strong>');
  assert.equal(renderInline('the *fluency* "illusion"'), 'the <em>fluency</em> “illusion”');
  assert.equal(renderInline("students' learning"), 'students’ learning');
});

// A miniature guide with the real guide's shape and headings.
const MINI = `# How to Study

A guide.

## Start here

Intro text.

> Time spent is not learning.

### Myths that waste your time

**Myth: re-reading works.** It doesn't.

**Myth: cramming works.** Not for long.

### Quick technique finder

Pick one of each.

| If you're studying | Do this |
|---|---|
| Math | Do problems. |

| If you have | Do this |
|---|---|
| A few minutes | Do a Blurt. |

## The core techniques

These are methods.

### 1. Active recall (self-testing)

Retrieve it.

**How to apply it.** Close the book.

*Good for:* vocabulary, history facts.

> **ADHD adaptation.** Keep it short.

### 3. The Feynman technique

Explain it.

**How to apply it.**

1. **Choose a concept.** Pick one.
2. **Explain it.** Simply.

> **Caution.** Careful.

## Matching techniques to subjects

Subjects differ.

### Mathematics

- Practice problems

**Avoid** flashcards.

### History

- Timelines

**Best combination:** Cornell, then Blurt.

### When a technique isn't working, switch it up

Swap it.

## Neurodivergent learners

### ADHD: studying with an interest-based nervous system

- Gamify it.

## Building your study system

### Step 2: A sample study day

| Time | Block | What to do |
|---|---|---|
| 4:00–4:10 | Review yesterday | A quick Blurt. |
| 4:35–4:40 | Break | Stand up. |

### Step 3: The review calendar

| Day | What to do |
|---|---|
| Day 1 | Learn it |
| Day 2 | Review |

## The one-page cheat sheet

Everything.

### The 14 techniques at a glance

1. **Active recall** — close the book.
2. **Spaced repetition** — review at intervals.

### Stop doing, start doing

| Stop doing | Start doing |
|---|---|
| Re-reading | Testing yourself |

### The review calendar

Learn it on Day 1.
`;

const mini = renderGuide(parseGuide(MINI));

test('parseGuide splits the title, subtitle, chapters, and sections', () => {
  const g = parseGuide(MINI);
  assert.equal(g.title, 'How to Study');
  assert.equal(g.subtitle, 'A guide.');
  assert.deepEqual(g.chapters.map((c) => c.id), [
    'start-here', 'the-core-techniques', 'matching-techniques-to-subjects',
    'neurodivergent-learners', 'building-your-study-system', 'the-one-page-cheat-sheet',
  ]);
  assert.deepEqual(g.chapters[1].sections.map((s) => s.id), ['1-active-recall-self-testing', '3-the-feynman-technique']);
});

test('parseGuide gives repeated headings unique ids', () => {
  const g = parseGuide('# T\n\n## A\n\n### Setting\n\nx\n\n### Setting\n\ny\n');
  assert.deepEqual(g.chapters[0].sections.map((s) => s.id), ['setting', 'setting-2']);
});

test('each chapter is a numbered section with a tab and a link to the next', () => {
  assert.match(mini.html, /<section class="chapter" id="the-core-techniques">/);
  assert.match(mini.html, /<p class="chapter-num">Chapter 2<\/p>\s*<h2>The core techniques<\/h2>/);
  assert.match(mini.nav, /<a href="#the-core-techniques">Techniques<\/a>/);
  assert.match(mini.nav, /<a href="#all">Whole guide<\/a>/);
  assert.match(mini.html, /<a href="#the-core-techniques">Next chapter: The core techniques<\/a>/);
});

test('techniques become numbered cards', () => {
  assert.match(mini.html, /<article class="card technique" id="1-active-recall-self-testing">\s*<span class="numeral" aria-hidden="true">1<\/span>\s*<h3>Active recall \(self-testing\)<\/h3>/);
});

test('"How to apply it" becomes a panel, and a numbered list inside it becomes steps', () => {
  assert.match(mini.html, /<div class="howto">\s*<p class="tag">How to apply it<\/p>\s*<p>Close the book\.<\/p>\s*<\/div>/);
  assert.match(mini.html, /<div class="howto">\s*<p class="tag">How to apply it<\/p>\s*<ol class="steps">\s*<li><strong>Choose a concept\.<\/strong> Pick one\.<\/li>/);
});

test('"Good for" becomes tags', () => {
  assert.match(mini.html, /<ul class="chips" aria-label="Good for"><li>Vocabulary<\/li><li>History facts<\/li><\/ul>/);
});

test('callouts are typed by their label; a plain quote stays a pull quote', () => {
  assert.match(mini.html, /<aside class="callout adhd">\s*<p class="tag">ADHD adaptation<\/p>\s*<p>Keep it short\.<\/p>\s*<\/aside>/);
  assert.match(mini.html, /<aside class="callout caution">\s*<p class="tag">Caution<\/p>/);
  assert.match(mini.html, /<blockquote class="pullquote"><p>Time spent is not learning\.<\/p><\/blockquote>/);
});

test('myths become a marked list without the "Myth:" prefix', () => {
  assert.match(mini.html, /<ul class="myths">\s*<li><strong>Re-reading works\.<\/strong> It doesn’t\.<\/li>\s*<li><strong>Cramming works\.<\/strong> Not for long\.<\/li>\s*<\/ul>/);
});

test('subjects become a card grid; a closing section stays plain', () => {
  assert.match(mini.html, /<div class="card-grid">\s*<article class="card" id="mathematics">/);
  assert.match(mini.html, /<section class="topic" id="when-a-technique-isnt-working-switch-it-up">/);
  assert.match(mini.html, /<p class="avoid"><strong>Avoid<\/strong> flashcards\.<\/p>/);
  assert.match(mini.html, /<p class="best"><strong>Best combination:<\/strong> Cornell, then Blurt\.<\/p>/);
});

test('named cards split "Name: description" headings', () => {
  assert.match(mini.html, /<h3>ADHD<span class="h3-sub">Studying with an interest-based nervous system<\/span><\/h3>/);
});

test('step headings get a step label', () => {
  assert.match(mini.html, /<p class="step-label">Step 3<\/p>\s*<h3>The review calendar<\/h3>/);
});

test('the finder tables are marked for the interactive finder', () => {
  assert.match(mini.html, /<div class="finder-tables" data-finder>\s*<div class="table-wrap">\s*<table>[\s\S]*Math[\s\S]*A few minutes[\s\S]*<\/table>\s*<\/div>\s*<\/div>/);
});

test('the review calendar becomes a timeline, in its step and on the cheat sheet', () => {
  const timelines = mini.html.match(/<ol class="timeline">\s*<li><b>Day 1<\/b><span>Learn it<\/span><\/li>\s*<li><b>Day 2<\/b><span>Review<\/span><\/li>\s*<\/ol>/g) || [];
  assert.equal(timelines.length, 2);
});

test('the sample day is a schedule with breaks marked', () => {
  assert.match(mini.html, /<div class="table-wrap schedule">/);
  assert.match(mini.html, /<tr class="break"><td>4:35–4:40<\/td><td>Break<\/td>/);
});

test('the cheat sheet gets a technique grid, stop/start cards, and a print button', () => {
  assert.match(mini.html, /<ol class="glance">\s*<li><b>Active recall<\/b><span>Close the book\.<\/span><\/li>/);
  assert.match(mini.html, /<div class="list-card stop">\s*<h4>Stop doing<\/h4>\s*<ul><li>Re-reading<\/li><\/ul>\s*<\/div>/);
  assert.match(mini.html, /<div class="list-card start">\s*<h4>Start doing<\/h4>\s*<ul><li>Testing yourself<\/li><\/ul>/);
  assert.match(mini.html, /<button class="print-cheatsheet" type="button" data-print-cheatsheet>Print the cheat sheet<\/button>/);
});

test('the header counts what the guide contains', () => {
  assert.equal(mini.meta, '2 techniques · 2 subjects · 1 neurodivergent profile · a one-page cheat sheet');
});

test('the layout config names only headings that exist in the real guide', () => {
  const md = readFileSync(new URL('../skills/socrates/study-guide.md', import.meta.url), 'utf8');
  const g = parseGuide(md);
  const chapterIds = new Set(g.chapters.map((c) => c.id));
  const sectionIds = new Set(g.chapters.flatMap((c) => c.sections.map((s) => s.id)));
  for (const id of Object.keys(CHAPTERS)) assert.ok(chapterIds.has(id), `no chapter "${id}" in study-guide.md`);
  for (const id of PLAIN_SECTIONS) assert.ok(sectionIds.has(id), `no section "${id}" in study-guide.md`);
  for (const id of ['quick-technique-finder', 'the-14-techniques-at-a-glance', 'the-review-calendar']) {
    assert.ok(sectionIds.has(id), `no section "${id}" in study-guide.md`);
  }
});

const fixture = {
  md: '# How to Study\n\nA guide.\n\n## Start here\n\nRead "this."\n',
  css: '@font-face { src: url("fonts/a.woff2") format("woff2"); }\nbody { color: black; }\n',
  fonts: { 'a.woff2': Buffer.from('FONTDATA') },
};

test('the local page is self-contained: inlined styles, embedded fonts, no external resources', () => {
  const html = buildPage({ variant: 'local', ...fixture });
  assert.match(html, /<style>[\s\S]*body \{ color: black; \}/);
  assert.match(html, /url\("data:font\/woff2;base64,Rk9OVERBVEE="\)/);
  assert.doesNotMatch(html, /url\("fonts\//);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /url\(["']?https?:/);
  assert.match(html, /<h1>How to Study<\/h1>/);
  assert.match(html, /Read “this\.”/);
  assert.match(html, /<nav class="chapters" aria-label="Chapters">/);
});

test('the site page links the shared stylesheet and the site navigation', () => {
  const html = buildPage({ variant: 'site', ...fixture });
  assert.match(html, /<link rel="stylesheet" href="\.\.\/site\.css">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/bourbondog\.github\.io\/Socrates\/study-guide\/">/);
  assert.match(html, /<a class="wordmark" href="\.\.\/">Socrates<\/a>/);
  assert.doesNotMatch(html, /data:font\/woff2/);
});

test('both pages carry the same guide text', () => {
  const guide = (html) => html.slice(html.indexOf('<article class="guide">'), html.lastIndexOf('</article>'));
  assert.equal(guide(buildPage({ variant: 'local', ...fixture })), guide(buildPage({ variant: 'site', ...fixture })));
});

test('the committed HTML copies are up to date with study-guide.md', () => {
  assert.deepEqual(staleOutputs(buildAll()), [], 'run: node tools/build-guide.mjs');
});
