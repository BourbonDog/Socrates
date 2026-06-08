# Socrates — Design (v1)

## What it is

A Claude Code skill that coaches students (high school through graduate school) through studying material they bring — a document, a link, or a problem — using evidence-based techniques from `how-to-actually-study.md`. It diagnoses the material and goal, picks the right technique, and runs a study session. It never just hands over answers; it builds retrieval.

## Principles

- **Never do the work for them.** Socratic, retrieval-first. A handed-over answer produces the fluency illusion, not learning.
- **Calibrate to level.** Same techniques, different register for a 9th grader vs. a grad student.
- **Start from the profile.** Persistent per-learner profiles make spaced repetition real and let coaching adapt to the person.

## Architecture — lean router + bundled references

The skill is **pure markdown with zero runtime dependencies**, so it runs anywhere Claude Code runs.

```
Socrates/
├─ README.md                       what it is, per-OS install, usage
├─ docs/
│  ├─ how-to-actually-study.md     the methodology (evidence base)
│  └─ design.md                    this file
└─ skills/socrates/                the installable skill
   ├─ SKILL.md                     the flow/router (kept lean)
   ├─ references/
   │  ├─ techniques.md             the 14 techniques: when + how to COACH each
   │  ├─ by-subject.md             subject → technique, plus goal/format guidance
   │  └─ adaptations.md            ADHD / dyslexia / anxiety / autism / dyscalculia
   └─ profile-template.md          copied to the learner's data dir on first run
```

`SKILL.md` handles the session flow and loads a reference file only when needed (progressive disclosure), keeping the always-loaded surface small.

## Portability & dependencies

- **Only requirement: Claude Code**, any OS. No Python, Node, scripts, network, or external services.
- **No configuration.** On first run the skill creates the profile directory and writes the profile there.
- **Profiles live outside the skill** so reinstalling/updating never erases progress:
  - Windows: `%USERPROFILE%\.claude\socrates\profiles\`
  - macOS / Linux: `~/.claude/socrates/profiles/`
- **Install** = copy `skills/socrates/` into the machine's `~/.claude/skills/`. (Future option: package as a one-command Claude Code plugin.)
- **Spaced repetition** uses the current date at day granularity — no timezone setup.

## Session flow

1. **Load the learner** — auto-use the single profile, or ask who; first run is a 4-question setup.
2. **Run due reviews first** — compare the profile's review dates to today; surface due items before new material.
3. **Take in the material** — document / link (fetched) / problem / bare topic.
4. **Diagnose subject + goal → pick a technique** (via `by-subject.md` + `techniques.md`), adapted by the profile.
5. **Pick the mode** — study-*with*-me (skill runs it) or coach-me (learner drives).
6. **Run the session** — retrieval-first, answers earned not given.
7. **Close the loop** — log it; schedule next reviews at +2d / +5d / +12d / +30d, then monthly — collapsed into a daily runway when a test is sooner than the first interval.

## Profile format

Human-readable markdown: name, level, subjects, adaptations, mode preference, what works / doesn't, a dated **Review schedule**, and a running **Log**. See `skills/socrates/profile-template.md`.

## Repo / hosting notes

- The repo lives in OneDrive for backup. To avoid the known OneDrive-vs-git corruption (files dehydrated to cloud-only placeholders mid-operation), the repo folder is pinned **"Always keep on this device"** (`attrib +P -U`). Avoid running git on this repo from two synced machines at once.
- `.gitattributes` normalizes line endings to LF so the kids' different OSes don't create churn.

## Out of scope for v1 (possible later)

- A one-command plugin installer / marketplace entry.
- A helper script for spaced-repetition scheduling (not needed — the skill does the date math).
- Parent-facing progress reports.
- An automated eval / description-optimization pass (skill-creator's optimizer is Unix-only; the description was hand-tuned for triggering).
