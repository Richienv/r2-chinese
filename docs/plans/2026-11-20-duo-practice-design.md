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

Evidence recorded (revised after code review): every mixed exercise picks among offered answers, so it records `recognition` only, which never counts as production or mastery. Arrange and continue record nothing per word. Every word is still typed from memory (the existing recall) after its tile build. The recall's own *Susun* tiles count as help, like a hint.

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

## What shipped (20 Nov 2026)

- **Mixed practice in all three courses.** Eight exercise types: meaning, sound, Hanzi, match board, choose the word, continue the sentence, arrange the sentence, build the word. Across all sittings that comes to roughly 4,600 exercises.
- **Shorter teaching.** One card per word (Jiaocheng's first sitting used to show four cards per word). Words come in groups of up to four, each group recognised straight away. Long sittings (more than 12 new words) run in waves of eight and count "Kata 1 dari 4", not "dari 30".
- **Never a dead end.** Every miss shows the answer with its Indonesian meaning and comes back two steps later. Recall offers *Susun* tiles (recorded as assisted). A finished match board is a win even after a mix-up.
- **Meaning first.** The core sense is shown big and the other senses small, in recall, the review and the exercises. Long grammar paragraphs fold behind "Kenapa begitu?" after the example.
- **Visible progress.** The Home HUD shows streak, XP, today's ring and the week. A winding lesson map, "Pelajaran N dari M", a combo badge with milestone bursts, XP floats, and a progress bar that keeps growing across waves.
- **Peak-end.** A victory screen with fireworks, XP gained, accuracy, best combo, streak and the daily ring. The review ends with the streak and ring too.
- **Less friction.** The app opens on Home every launch, straight into the last course.
- **Fixes.** The Progress ring label no longer overflows. Arrange only uses lines with natural word tiles. After code review: "Finish practice" appears only once every word has been met. Builds and listening picks record recognition only. A match mix-up marks only the tapped word. The Continue button takes focus. Exercises don't flood history. The course chooser is skipped only after an explicit choice.

Verification: 20 new tests (composer, route, every real sitting in all three courses), the full suite, typecheck and production build. Browser walkthrough at 375×812 on a separate localhost origin with test data only.
