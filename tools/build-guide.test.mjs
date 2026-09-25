// Tests for build-guide.mjs. Run with: node --test tools/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, renderInline, renderMarkdown, buildPage, buildAll, staleOutputs } from './build-guide.mjs';

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

test('renderMarkdown splits title, subtitle, sections, and contents', () => {
  const md = '# Title\n\nThe subtitle.\n\n## First part\n\nBody text.\n\n### A detail\n\n## Second part\n';
  const g = renderMarkdown(md);
  assert.equal(g.title, 'Title');
  assert.equal(g.subtitle, 'The subtitle.');
  assert.match(g.html, /<h2 id="first-part">First part<\/h2>/);
  assert.match(g.html, /<h3 id="a-detail">A detail<\/h3>/);
  assert.match(g.html, /<p>Body text\.<\/p>/);
  assert.doesNotMatch(g.html, /The subtitle/);
  assert.deepEqual(g.toc, [
    { id: 'first-part', text: 'First part' },
    { id: 'second-part', text: 'Second part' },
  ]);
});

test('renderMarkdown gives repeated headings unique ids', () => {
  const g = renderMarkdown('# T\n\n## Setting\n\n## Setting\n');
  assert.match(g.html, /id="setting"/);
  assert.match(g.html, /id="setting-2"/);
});

test('renderMarkdown renders lists', () => {
  const g = renderMarkdown('# T\n\n- one\n- **two**\n\n1. first\n2. second\n');
  assert.match(g.html, /<ul>\s*<li>one<\/li>\s*<li><strong>two<\/strong><\/li>\s*<\/ul>/);
  assert.match(g.html, /<ol>\s*<li>first<\/li>\s*<li>second<\/li>\s*<\/ol>/);
});

test('renderMarkdown renders tables with a header row', () => {
  const g = renderMarkdown('# T\n\n| Day | What |\n|---|---|\n| Day 1 | Learn it |\n| Day 2 | Review |\n');
  assert.match(g.html, /<table>\s*<thead>\s*<tr><th>Day<\/th><th>What<\/th><\/tr>\s*<\/thead>/);
  assert.match(g.html, /<tbody>\s*<tr><td>Day 1<\/td><td>Learn it<\/td><\/tr>\s*<tr><td>Day 2<\/td><td>Review<\/td><\/tr>\s*<\/tbody>/);
});

test('renderMarkdown tells labeled callouts from pull quotes', () => {
  const g = renderMarkdown('# T\n\n> **Tip.** Do it.\n\n> Time spent is not learning.\n');
  assert.match(g.html, /<blockquote class="callout"><p><strong>Tip\.<\/strong> Do it\.<\/p><\/blockquote>/);
  assert.match(g.html, /<blockquote class="pullquote"><p>Time spent is not learning\.<\/p><\/blockquote>/);
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
});

test('the site page links the shared stylesheet and the site navigation', () => {
  const html = buildPage({ variant: 'site', ...fixture });
  assert.match(html, /<link rel="stylesheet" href="\.\.\/site\.css">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/bourbondog\.github\.io\/Socrates\/study-guide\/">/);
  assert.match(html, /<a class="wordmark" href="\.\.\/">Socrates<\/a>/);
  assert.doesNotMatch(html, /data:font\/woff2/);
});

test('both pages carry the same guide text', () => {
  const article = (html) => html.slice(html.indexOf('<article'), html.indexOf('</article>'));
  assert.equal(article(buildPage({ variant: 'local', ...fixture })), article(buildPage({ variant: 'site', ...fixture })));
});

test('the committed HTML copies are up to date with study-guide.md', () => {
  assert.deepEqual(staleOutputs(buildAll()), [], 'run: node tools/build-guide.mjs');
});
