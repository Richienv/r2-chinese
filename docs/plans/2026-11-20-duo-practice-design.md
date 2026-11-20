# Yulu: mixed practice, visible progress, motion (20 Nov 2026)

Richie asked for a Duolingo-like experience: many exercise types in one session ("susun kata, pilih kata yang cocok, lanjutkan kalimat", like the Jiaocheng midterm), Indonesian meanings first, words that come back often enough to become familiar, a clear picture of where he is and where he is going, and the animations we already know how to make. He delegated approval for this release, so this design is self-approved and shipped to `main`.

## What he experiences today (walkthrough on 390 px, 20 Nov)

1. Home shows one next-session card. No streak, XP, daily goal or map. Those numbers exist in the store but only appear on the Progress tab.
2. A sitting is 7 passive word cards in a row, then a long dialogue, then 7 typed-Hanzi recalls.
3. The first thing he must *produce* is the hardest task in the app (type the Hanzi from the meaning). If he can't, the only way forward is the hint ladder to "Show answer". Getting stuck there is the discouragement he described.
4. The end screen says "A good place to stop." There is no sense of reward.
5. The 14 Nov "design unity" pass removed the path, motion and celebration on purpose (calm, no streak pressure). That was the right call for clutter. It went too far for a morning habit.

## Layer 1: the psychology we design for

| Need | Mechanism | Where it shows |
| --- | --- | --- |
| Start without friction | One obvious action; the first 3 questions are easy wins | Home hero "Mulai", recognition first |
| Competence (≈85% success) | Difficulty ramps: recognise → choose in context → build → produce | Session composer stages |
| Never dead-end | A miss shows the answer with its Indonesian meaning, then the item returns two steps later in an easier form | Feedback sheet, requeue, "Susun" input in recall |
| Encoding variety | The same word appears 3–4 times in different forms (meaning, sound, sentence, characters) | Interleaved exercises |
| Goal gradient | Bars that visibly fill; "2 lagi" | Session bar, daily ring, lesson map |
| Momentum | Combo counter for first-try answers | Session header |
| Peak-end | The session ends on a win and a celebration that counts up what changed | Victory screen |
| Daily cue | Streak and daily ring on Home, both kind (no guilt copy) | Home HUD |

The honesty rules from LEARNING_ENGINE_V2 stay: easy multiple choice never counts as unaided production; tiles count as assisted; sentence assembly records no per-word recall.

## Layer 2: exercise system

`src/lib/exercises.ts` is a pure composer. It takes a sitting's words (with examples), its text lines, a distractor pool and a segmenter. It returns exercises in three stages:

1. **Kenali (recognise)**, right after a group of up to 4 new words: `meaning-pick` (汉字 → arti), `listen-pick` (sound → 汉字), `hanzi-pick` (arti → 汉字), and `match` (4–5 pairs).
2. **Pakai (use in context)**, after reading: `cloze` (choose the word that fits the sentence), `continue` (choose how the sentence continues), `arrange` (put the tiles in order, with the Indonesian sentence as the cue).
3. **Ingat (produce)**: `char-build` (assemble the word from character tiles), then the existing typed/drawn/spoken recall. Recall gains a third input, *Susun*, which offers tiles and records the answer as assisted.

Exercises are interleaved: two of the same kind or the same word never sit next to each other when that can be avoided. Distractors prefer the sitting's own words, then the same part of speech.

Evidence recorded:

| Exercise | Store event |
| --- | --- |
| meaning-pick, hanzi-pick, cloze, match | `recognition` |
| listen-pick | `listening` |
| char-build, recall via tiles | `recall`, assisted |
| arrange, continue | none per word (XP and daily credit only) |

All three courses (HSK 4, Jiaocheng 2, 1000 words) build the same step objects. `duoLessonSteps()` replaces `compactLessonSteps()`, so the change is one composer plus one renderer shared by all three.

## Layer 3: meanings, Indonesian first

The prompt shows the **core meaning**: the first sense of the localized gloss, without parentheticals. The full gloss, usage note and part of speech stay as the small second line after answering. Meaning options are de-duplicated on the core meaning, so two options never read the same.

## Layer 4: structure and progress

- **Home HUD:** streak flame, total XP, daily ring (today's practice steps / 12). Tapping the HUD opens Progress.
- **Home map:** the current lesson's sittings as a winding path of nodes (done ✓, current pulsing with *MULAI*, locked). Above it: "Pelajaran N dari M" and a course bar for sittings done.
- **Session header:** an animated progress bar, a combo badge, and a "+10" XP float.
- **Victory screen:** check burst and fireworks, XP gained (count-up), accuracy, best combo, streak (+1 when today is new), daily ring, words practised.

## Layer 5: motion

CSS transforms and opacity only, 120–420 ms, with spring easing for wins and a short shake for misses. Every animation sits behind `prefers-reduced-motion: no-preference`. The existing sfx/haptics (`playCorrect`, `playWrong`, `playComplete`, `haptic`) are reused.

## Data safety

- No store schema, key or scheduler change.
- Resume checkpoints get a new namespace, so an old numeric position is never applied to the new order; that only loses the position inside an unfinished sitting.
- XP uses the existing `awardXp`/`practiceLog`; node completion uses `markNodeDone`.

## Verification

- Unit tests for the composer (every lesson in all three courses produces valid exercises; answers are among the options; no adjacent duplicates; tiles reassemble the sentence).
- Existing 302 tests still pass; typecheck and build pass.
- Browser walkthrough at 390 px: one full HSK sitting, one Jiaocheng and one Kerja sitting, plus Home and the victory screen.

## Not in this release

- R2 Fit. Its daily loop already has rings and a level avatar. The same HUD/victory ideas can follow later.
- Hearts/lives (punitive), leagues, notifications.
