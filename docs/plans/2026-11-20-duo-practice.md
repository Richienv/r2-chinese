# Duo practice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mixed Duolingo-style exercises in every Mandarin sitting, Indonesian-first meanings, visible progress on Home, and celebratory motion. See `2026-11-20-duo-practice-design.md`.

**Architecture:** A pure composer (`src/lib/exercises.ts`) turns a sitting's words, examples and lines into `exercise` steps. `duoLessonSteps()` in `sessionRoute.ts` interleaves them with the existing teach, read and practice steps. One renderer (`components/Exercises.tsx`) and one momentum context are shared by the HSK, Jiaocheng and Kerja runners. Home gets a HUD and a path map. The session summary becomes a victory screen.

**Tech Stack:** React 18, Vite 5, TypeScript, node:test with `--experimental-strip-types`, plain CSS with tokens from `design-system.css`.

Run all tests with `npm test`, types with `npm run typecheck`, and the bundle with `npm run build`.

---

### Task 1: Exercise composer

**Files:** create `src/lib/exercises.ts` and `tests/exercises.test.mjs`.

Pure functions with `.ts` relative imports only, so node can load them directly:

- `coreMeaning(gloss)`: the first sense, without parentheticals.
- `interleave(items, keyOf, wordOf)`
- `composeRecognise(words, ctx)`: stage 1. `meaning-pick`, `listen-pick` and `hanzi-pick` rotate per word; `match` when there are 3 or more words.
- `composeContext(words, lines, ctx)`: stage 2. `cloze` (≤3), `continue` (≤1), `arrange` (≤2).
- `composeProduce(words, ctx)`: stage 3. `char-build` for up to 4 multi-character words.
- `ctx` carries `{ pool, segment, seed }`.

Tests:

- The answer is always among the options.
- Options are unique by core meaning.
- Arrange tiles minus distractors rejoin to the sentence.
- `continue` heads end at a comma.
- `interleave` leaves no adjacent equal kinds when that is avoidable.
- Determinism under the same seed.

### Task 2: Route integration

**Files:** modify `src/lib/sessionRoute.ts`; create `tests/duo-route.test.mjs`.

- `isPracticeStep` includes `exercise`.
- `practiceRound` order: stage-1/2 exercises, ≤2 quiz, stage-3 exercises, recalls for words not char-built (shuffled), 1 produce, 1 dialogue.
- `duoLessonSteps(steps, compose)` returns, for each group of up to 4 meets, `[meets, its stage-1 exercises]`, then `read`/`note`, then the final practice (stage 2/3 exercises plus the original practice steps), then `complete`.

The existing `compactLessonSteps` tests must still pass.

### Task 3: Monotonic progress

**Files:** modify `src/components/useSessionRoute.ts`.

The bar counts finished practice items across waves, so it never jumps backwards when a second wave starts.

### Task 4: Exercise UI, momentum, styles

**Files:** create `src/components/Exercises.tsx`, `src/components/Momentum.tsx` and `src/styles/duo.css`; create `src/i18n/id/duo.ts` and register it in `src/i18n/id.ts`.

- `ExerciseView` reports `onRecord(zh, correct, assisted, mode)` once per target word and calls `onDone(missed)`.
- A bottom feedback sheet shows the result, the answer, its pinyin and its Indonesian meaning, with a Lanjut button.
- Momentum: `register(correct)` returns the combo; a ComboBadge and an XP float sit in the header.

### Task 5: Runners

**Files:** modify `src/screens/WordsSession.tsx`, `src/screens/Jiaocheng.tsx`, `src/screens/Kerja.tsx`, `src/lib/wordsSession.ts`, `src/lib/jiaocheng.ts` and `src/lib/kerja.ts`.

- Add `ExerciseStep` to the step unions.
- Build steps with `duoLessonSteps`.
- Render `ExerciseView` and record evidence through `store.recordRecall`.
- `credit(step.id)`, then `goForward(missed)`.
- New resume namespace `*:duo-v1`.
- Wrap each runner in `MomentumProvider`.

### Task 6: Recall improvements

**Files:** modify `src/components/WordRecall.tsx`.

- The heading shows `coreMeaning`, with the full gloss below when it differs.
- A *Susun* input mode uses `CharTiles` and scores as assisted.

### Task 7: Victory screen

**Files:** modify `src/components/SessionFlow.tsx`.

`SessionSummary` shows a burst, the XP count-up from momentum, accuracy, best combo, the streak and the daily ring. Fireworks play once.

### Task 8: Home HUD and map

**Files:** create `src/components/TodayHud.tsx`; modify `src/screens/Home.tsx` and `src/components/LearningPath.tsx` (fill mode becomes a winding node map); styles go in `duo.css`.

### Task 9: Verify and ship

1. `npm test`, `npm run typecheck`, `npm run build`.
2. Browser QA at 375×812 for the three courses and Home.
3. Commit, merge to `main`, push, and confirm the Vercel production deployment.
