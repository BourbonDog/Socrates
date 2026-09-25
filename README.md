# Socrates

A study coach for [Claude Code](https://claude.com/claude-code), for students from high school through graduate school. It works out what you're studying and what you need from it, picks a technique from the learning research — active recall, spaced repetition, the Feynman technique, and others — and either studies *with* you or coaches you while *you* drive. It doesn't hand over answers: retrieving an answer yourself is what builds the memory.

It remembers each student and schedules spaced reviews, so a few days later it opens with "your Bio Ch. 6 review is due" before anything new.

## The study guide

Socrates is built on *How to Actually Study*, a practical guide to studying well: fourteen techniques and how to apply each one, what works for each subject, adaptations for ADHD, dyslexia, anxiety, autism, and dyscalculia, how to build a study system, and a one-page cheat sheet.

The guide installs with the skill, so every student has their own copy, offline:

- `study-guide.html` — the readable copy. Double-click it to open it in any browser; it prints cleanly.
- `study-guide.md` — the same text, which Socrates reads when it explains a technique.

After installing, the guide is at `%USERPROFILE%\.claude\skills\socrates\study-guide.html` on Windows, or `~/.claude/skills/socrates/study-guide.html` on macOS and Linux. You can also just ask Socrates: "show me the study guide." In this repository it's [`skills/socrates/study-guide.md`](skills/socrates/study-guide.md).

## Requirements

- [Claude Code](https://claude.com/claude-code). That's all.
- No Python, Node, scripts, accounts, or internet connection are needed to use it. The skill is plain text, so it runs anywhere Claude Code runs: Windows, macOS, or Linux.

## Install

Clone this repository (or download it as a ZIP from GitHub and unzip it), then run the copy from inside it.

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills\socrates" | Out-Null
Copy-Item -Recurse -Force ".\skills\socrates\*" "$env:USERPROFILE\.claude\skills\socrates"
```

**macOS / Linux:**

```bash
mkdir -p ~/.claude/skills/socrates && cp -R skills/socrates/. ~/.claude/skills/socrates/
```

This puts one folder, `socrates`, into your Claude skills folder: the coaching instructions (`SKILL.md`), their reference notes, and the study guide. Then open Claude Code and say what you're studying.

## Using it

Start however feels natural:

- "Help me study for my biology test on cellular respiration."
- "I don't get this." *(then paste your notes, a link, or a photo of the problem)*
- "Quiz me on the French Revolution."
- "Make me a study plan for finals."
- "Show me the study guide."

What happens in a session:

1. **It loads your profile.** The first time, it asks four quick questions — your name, your grade or year, your subjects, and anything about how you learn — and saves a profile.
2. **Reviews come first.** Anything due for review gets a short retrieval check before new material.
3. **It takes in what you brought** — notes, a reading, slides, a photo, a link, a problem set (which it won't solve for you), or just a topic.
4. **It chooses a technique** for the subject and your goal, and tells you which one, why, and where it is in the study guide. If there's a test, the date shapes the plan.
5. **You choose the mode.** *Study with me:* it runs the technique and quizzes you as you go. *Coach me:* you do the work; it sets up the practice and checks what you produce.
6. **The session runs retrieval-first.** Gaps get worked, and answers get earned. "I get it" is checked with recall, notes closed.
7. **It closes the loop.** The session is logged and the next reviews are scheduled — Day 2, 5, 12, and 30, then monthly, or a short review every day when a test is sooner than that.

## Where your progress is saved

Profiles and review schedules live **outside** the skill's folder, so updating or reinstalling never touches them:

- **Windows:** `%USERPROFILE%\.claude\socrates\profiles\`
- **macOS / Linux:** `~/.claude/socrates/profiles/`

They're plain markdown. A parent or student can open one and read it at any time.

## Updating

Pull the latest version (or download it again) and run the same copy commands. They overwrite the skill's files in place; your profiles are untouched.

## What's in this repository

- `skills/socrates/` — the skill. This is the part you install, and it includes the study guide.
- `docs/` — the website at [bourbondog.github.io/Socrates](https://bourbondog.github.io/Socrates/), which publishes the same guide online, and [`design.md`](docs/design.md), which explains how the skill is put together.
- `tools/build-guide.mjs` — for maintainers: after editing `study-guide.md`, run `node tools/build-guide.mjs` to rebuild the guide's two HTML copies, and `node --test tools/*.test.mjs` to check them.
