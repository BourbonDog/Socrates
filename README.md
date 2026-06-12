# Socrates

A Socratic study coach — a [Claude Code](https://claude.com/claude-code) skill that helps students from high school through grad school actually *learn* their material instead of just rereading it. It diagnoses what you're studying, picks a technique backed by cognitive science (active recall, spaced repetition, the Feynman technique, and more), and either studies **with** you or coaches you while **you** drive — and it never just hands over the answer, because being handed the answer is exactly what *doesn't* build memory.

It also remembers each learner and runs **spaced-repetition reviews** — so days later it can say "time to review Ch. 6" and actually make the spacing happen.

**Website:** [bourbondog.github.io/Socrates](https://bourbondog.github.io/Socrates/) — overview, install, and the [study guide readable online](https://bourbondog.github.io/Socrates/study-guide/).

## What's in here

- `skills/socrates/` — the skill itself (this is the part you install).
- `docs/how-to-actually-study.md` — the evidence base behind the coaching.
- `docs/design.md` — how the skill is put together.

## Requirements

- **[Claude Code](https://claude.com/claude-code).** That's the only requirement.
- No Python, Node, scripts, accounts, or internet needed at runtime. The skill is pure markdown, so it runs anywhere Claude Code runs — Windows, macOS, or Linux.

## Install

Copy the `skills/socrates` folder into your personal Claude skills directory.

**Windows (PowerShell):**
```powershell
Copy-Item -Recurse -Force ".\skills\socrates" "$env:USERPROFILE\.claude\skills\socrates"
```

**macOS / Linux:**
```bash
mkdir -p ~/.claude/skills && cp -R skills/socrates ~/.claude/skills/socrates
```

(Clone or download this repo first, then run the copy from inside it.)

Then open Claude Code and just say what you're studying.

## Using it

Start however feels natural:

- "Help me study for my biology test on cell respiration."
- "I don't get this." *(then paste notes, a link, or a photo of the problem)*
- "Quiz me on the French Revolution."
- "Make me a study plan for finals."

The first time, it asks four quick questions (name, grade/year, subjects, anything about how you learn) and saves a profile. After that it greets you, runs any reviews that are due, and picks up where you left off.

## Where your progress is saved

Profiles and review schedules live **outside** the skill, so updating or reinstalling never wipes them:

- **Windows:** `%USERPROFILE%\.claude\socrates\profiles\`
- **macOS / Linux:** `~/.claude/socrates/profiles/`

They're plain markdown — a parent or student can open and read them anytime.

## Updating

Pull the latest and re-run the install copy above. Your profiles are untouched.

---

Built on the "How to Actually Study" guide in [`docs/how-to-actually-study.md`](docs/how-to-actually-study.md).
