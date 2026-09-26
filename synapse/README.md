# Synapse

A learning workstation for self-learners who study across many fields, built on six well-tested findings from cognitive science. Everything runs in the browser, and data stays on your device.

```bash
cd synapse
npm install
npm run dev        # http://localhost:5174
npm test           # unit tests for the scheduling, scanner, recall, interleaving and import code
npm run build      # typecheck + production build to dist/
```

On first launch Synapse loads three sample subjects: **Occam's Razor** (Philosophy), **Backpressure** (Systems Architecture) and **Neuroplasticity** (Physiology). It also generates about 9 days of made-up review history, so every dashboard metric has data. Settings → *Erase everything* removes it all.

## Modules

| Module | Principle | What it does |
| --- | --- | --- |
| **Dashboard** | — | Streak, retention health (forgetting-curve estimate), 30-day accuracy, calibration curve, 7-day review forecast, Leitner box distribution, topic mastery, suggested next moves |
| **Daily Deck** | Spaced repetition · Interleaving · Calibration | Adapted SM-2 + Leitner boxes. Interleave Mode mixes ≥3 topics (pulling cards forward if needed) so two cards in a row never come from the same topic when avoidable. You rate confidence *before* the reveal and accuracy *after* it. Confident misses cost extra ease, and correct-but-unsure answers get shorter intervals |
| **Retrieval Gym** | Blurting | Timed free-recall canvas (default 3:00) in a focus session, then Reveal & Diff: master notes highlighted with recalled vs. missed key terms, a suggested grade, a High/Medium/Low self-grade, and missed terms turned into cards |
| **Feynman Studio** | Simplicity check | "Explain it to a 10-year-old" editor with a live jargon & complexity scanner (long sentences, jargon with plain-English swaps, undefined acronyms, hand-waving words, multi-syllable words, reading grade, clarity score). Knowledge Gap Highlighter turns the spots where you got stuck into cards. Drafts are versioned |
| **Synthesis Bridge** | Elaborative interrogation | Question generator: bridge, failure mode, counter-argument, mechanism, analogy, transfer, prediction. Pairs ideas from different fields that aren't linked yet. Answers can become cards |
| **Topics & Models** | — | Core tenet, source summary, mental models, cross-domain links (with backlinks), concept map, per-card SRS details |

## Keyboard

`⌘/Ctrl K` capture & command palette (type `Question :: Answer` to create a card) · `?` help · `G` then `D/R/B/F/E/T/S` to navigate ·
review: `1–4` confidence → `Space` reveal → `1–4` grade · `Esc` exits dialogs and focus sessions.

## Architecture

```
src/
  types/        Type definitions for every stored record (Topic, Card, ReviewLog, FeynmanDraft, BlurtSession, …)
  utils/        Plain logic with no React: srs, interleave, jargon, recall, prompts, metrics, storage, audio, seed
  hooks/        useStore (reducer + IndexedDB autosave), useNav (hash routing), useHotkeys, useTimer, useTheme, useAudioCue
  components/   ui/ primitives · layout/ · dashboard/ · topics/ · feynman/ · gym/ · review/ · synthesis/ · focus/ · capture/ · settings/
```

Data is saved to IndexedDB (falling back to localStorage) about 350 ms after each change. Settings → Export/Import JSON makes a backup. Imports are validated and filled in with defaults before they replace current data.
