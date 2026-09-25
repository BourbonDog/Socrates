# Socrates — Design

## What it is

A Claude Code skill that coaches students (high school through graduate school) through studying material they bring — a document, a link, or a problem — using the evidence-based techniques in its study guide, *How to Actually Study* (`skills/socrates/study-guide.md`). It diagnoses the material and goal, picks the right technique, and runs a study session. It never just hands over answers; it builds retrieval.

## Principles

- **Never do the work for them.** Socratic, retrieval-first. A handed-over answer produces the fluency illusion, not learning.
- **Calibrate to level.** Same techniques, different register for a 9th grader vs. a grad student.
- **Start from the profile.** Persistent per-learner profiles make spaced repetition real and let coaching adapt to the person.
- **The guide is always at hand.** The student's own copy of the study guide installs with the skill, so learning to self-coach never depends on a website.

## Architecture — lean router + bundled references + the guide

The skill is **pure markdown with zero runtime dependencies**, so it runs anywhere Claude Code runs.

```
Socrates/
├─ README.md                        what it is, the guide, per-OS install, usage
├─ skills/socrates/                 the installable skill
│  ├─ SKILL.md                      the flow/router (kept lean)
│  ├─ references/
│  │  ├─ techniques.md              the 14 techniques: when + how to COACH each
│  │  ├─ by-subject.md              subject → technique, plus goal/format guidance
│  │  └─ adaptations.md             ADHD / dyslexia / anxiety / autism / dyscalculia
│  ├─ profile-template.md           copied to the learner's data dir on first run
│  ├─ study-guide.md                the full student guide — the source text
│  └─ study-guide.html              the same guide for the student to read (generated)
├─ docs/                            the website (GitHub Pages, main:/docs)
│  ├─ index.html, site.css          hand-written home page + shared styles
│  ├─ study-guide/index.html        the guide's web copy (generated)
│  ├─ fonts/                        Source Serif 4, self-hosted (OFL.txt)
│  └─ design.md                     this file
└─ tools/
   ├─ build-guide.mjs               builds both HTML copies from study-guide.md
   └─ build-guide.test.mjs          node --test tools/*.test.mjs
```

`SKILL.md` handles the session flow and loads a reference file only when needed (progressive disclosure), keeping the always-loaded surface small. The three reference files are coaching playbooks drawn from the guide; the guide itself is what the student reads.

## The study guide

- **It ships inside the skill folder** so every install carries it: the student can open `study-guide.html` offline, and Socrates can point to a section or answer from `study-guide.md`. The website publishes the same guide, but it is a copy, never the only place to read it.
- **`study-guide.md` is the source.** `tools/build-guide.mjs` renders it into `skills/socrates/study-guide.html` (self-contained: `docs/site.css` and the fonts are inlined, so it needs no network) and `docs/study-guide/index.html` (links `docs/site.css`). After editing the guide, run `node tools/build-guide.mjs`; the test suite fails if either copy is stale. The builder uses only Node built-ins, and nothing the student installs depends on it.
- **Socrates reads the markdown, never the HTML** — the HTML embeds a font and is large.
- **Evidence.** The guide was revised in June 2026 after a two-model evidence review; its named studies were checked against the original papers in September 2026 and are listed in its References.

## Portability & dependencies

- **Only requirement: Claude Code**, any OS. No Python, Node, scripts, network, or external services at runtime.
- **No configuration.** On first run the skill creates the profile directory and writes the profile there.
- **Profiles live outside the skill** so reinstalling/updating never erases progress:
  - Windows: `%USERPROFILE%\.claude\socrates\profiles\`
  - macOS / Linux: `~/.claude/socrates/profiles/`
- **Install / update** = copy the *contents* of `skills/socrates/` into `~/.claude/skills/socrates/` (`Copy-Item ".\skills\socrates\*"` on Windows, `cp -R skills/socrates/. …` elsewhere). Copying the folder itself onto an existing install would nest it (`socrates/socrates/`) and leave the old files in place.
- **Spaced repetition** uses the current date at day granularity — no timezone setup.

## Session flow

1. **Load the learner** — auto-use the single profile, or ask who; first run is a 4-question setup that ends by pointing to the study guide.
2. **Run due reviews first** — compare the profile's review dates to today; surface due items before new material.
3. **Take in the material** — document / link (fetched) / problem / bare topic.
4. **Diagnose subject + goal → pick a technique** (via `by-subject.md` + `techniques.md`), adapted by the profile, and say where it is in the guide.
5. **Pick the mode** — study-*with*-me (skill runs it) or coach-me (learner drives).
6. **Run the session** — retrieval-first, answers earned not given.
7. **Close the loop** — log it; schedule next reviews at +2d / +5d / +12d / +30d, then monthly — collapsed into a daily runway when a test is sooner than the first interval.

## Profile format

Human-readable markdown: name, level, subjects, adaptations, mode preference, what works / doesn't, a dated **Review schedule**, and a running **Log**. See `skills/socrates/profile-template.md`.

## Website

- GitHub Pages, deployed from `main:/docs` with no build step for the site itself (`.nojekyll`). Editing the home page = edit `docs/index.html` / `docs/site.css` and push to `main`.
- Typeset in Source Serif 4, self-hosted from `docs/fonts/` (SIL Open Font License; see `docs/fonts/OFL.txt`), with automatic dark mode and print styles. The design is deliberately plain: it should read like a well-set textbook, not a product page.

## Repo / hosting notes

- The repo lives in OneDrive for backup. To avoid the known OneDrive-vs-git corruption (files dehydrated to cloud-only placeholders mid-operation), the repo folder is pinned **"Always keep on this device"** (`attrib +P -U`). Avoid running git on this repo from two synced machines at once.
- `.gitattributes` normalizes line endings to LF so the kids' different OSes don't create churn; fonts are marked binary.

## Out of scope (possible later)

- A one-command plugin installer / marketplace entry.
- A helper script for spaced-repetition scheduling (not needed — the skill does the date math).
- Parent-facing progress reports.
- An automated eval / description-optimization pass (skill-creator's optimizer is Unix-only; the description was hand-tuned for triggering).
