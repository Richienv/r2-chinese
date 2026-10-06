# A source-first learning system

The curriculum provides the content. Shared activities provide the experience.
Keep explanations, examples, vocabulary, and source provenance in the course JSON;
build a sequence of stable activity IDs rather than copying a screen per book.

## The loop

1. Encounter: introduce a word or idea with its actual source context.
2. Understand: read the source, hear it, and connect its explanation to an example.
3. Retrieve: hide the answer and ask for production before offering hints or choices.
4. Produce: use the material in a dialogue or build a sentence from its English meaning.
5. Revisit: return to difficult words after intervening activities and on later days.

HSK, Kerja, and Jiaocheng now compose this loop from their existing source content.
HSK appends an additional recall of difficult words after the other activities.
Magang, Interview, and Books share the visual and feedback system; their existing
source reading and choice checks remain knowledge checks, not verified production.

## Reusable parts

- `WordRecall`: English meaning to typed or freely drawn Hanzi, progressive hints, explicit next.
- `HandwritingPad`: finger/pen/mouse stroke input and an independent character classifier;
  candidate selection is input, like an IME, and receives no expected-answer hint.
- `StrokeWord`: genuine animated stroke order, one character at a time, replay/stop,
  reduced-motion support and visible fallback if data is unavailable.
- Memory coaching: use the curriculum's context plus shape/sound/use cues and a
  hidden-answer cloze; personal practice cues are separate from source quotations.
- `StudyDisplayControls`: persistent pinyin and English switches beside the lesson;
  required English recall prompts remain visible regardless of reading preferences.
- `Glossed` / dictionary: natural word segmentation, course-first definitions,
  CC-CEDICT fallback and refreshed online definitions; learned words glow in context.
- `DialoguePractice`: actual source roles, up to three replies, speech or typed input.
- `SentencePractice`: source English to the learner's Chinese; accepted alternatives
  require the configured text evaluator rather than exact-string grading.
- `DrillFlow`: the standalone recall drill, built on `WordRecall`. Each pass over a word
  asks it differently (`src/lib/drillRounds.ts`): from the meaning, from hearing it
  (the textbook's own recording when it has one), from its pinyin. The answer is always
  the Hanzi, typed or drawn. There is no multiple choice. A missed word returns a few
  rounds later, asked by its meaning. The screen reacts (word dots, an unaided-run
  counter, a glow and shake on the result, stroke order when a word is recalled, haptics
  on phones) and ends with a per-word breakdown and a drill of just the words to revisit.
- `ReviewReport`, `HanziDrawing`, `DialogueRecheck`: the validation loop above.
- `MasteryTracker`: current word states and the evidence behind them.
- `RecallFeedback` / `VoiceWaveform`: finite feedback animation and real input visualization.
- `sfx`: interaction, hint, listening, success, repair, and completion cues under one mute preference.
- Semantic checkpoints: stable activity IDs and assistance scopes, with separate account namespaces.

## The validation loop

Every graded task closes the same loop: instruction, task, result, check, feedback,
correction, retest. A task turns its result into `ReviewCheck`s (`src/lib/review.ts`),
each tagged with the stage it tests (followed the instruction, recalled the details,
made the choice, produced the result), what the learner did, what was needed, and the
concrete fix. `buildReview` gives the verdict and one next step; `compareReviews` says
what a retest fixed, what is still wrong and what newly broke. `ReviewReport` renders it.

- Verdicts are `passed`, `revise` and `unverified`. `unverified` is never a pass: it is what a
  grammar check says when no reviewer is connected, or a drawing says when it cannot be read.
- Coaching checks (a stroke that looks out of place, how close the wording is to the book) never
  change the verdict. A check that would print the answer is hidden until it is revealed.
- The checks never change the evidence rules above. They explain a result; they do not make one.

Where it applies:

| Task | Checks | Correction | Retest |
| --- | --- | --- | --- |
| Draw a word (`HanziDrawing`) | every character drawn; each character reads as the lesson word's; the stroke count; which stroke is missing or extra (`handwriting-review.ts`, only when it is certain) | redraw only the characters that failed, keeping ink that is one stroke off; the correct strokes are shown on request and count as help | check again, with what was fixed |
| Type a word | Hanzi not pinyin, right length, each character (without printing the answer) | retype; the text stays | same |
| Reply in a dialogue | in Mandarin; the key words from the line; the book's wording or a verified correction (`reply-review.ts`) | "Fix and check again" keeps the reply and lists what to fix | same |
| Dialogue recall check (`DialogueRecheck`) | what came next, who said it, which key word fits, built from the dialogue itself (`dialogue-check.ts`) | each wrong choice is answered with the book's own line | the misses again, options reordered |
| Make it yours | Mandarin, two or three sentences, every word used, grammar by the reviewer (`writing-review.ts`) | live checklist while writing; "Fix it and check again" | same |

Handwriting pass or fail still comes from the blind corpus classifier. The stroke diagnosis
only explains it, and says "one of these" rather than guessing when strokes are alike.

## Evidence rules

Exposure automatically creates a learning-trail entry and review card, but no
retrieval success. Multiple choice records recognition only. Assisted answers
and misses return the word to needs practice. A mastered word needs three unaided
production successes across two distinct days since its latest miss or hint.
This is a transparent product threshold, not a claim of measured fluency.

In the drill, every hint (including the meaning on a listening or pinyin round) is
assistance, a wrong check makes the round a miss even if the learner then succeeds with
help, and a word that needed help stays assisted for the rest of that session, so the
summary shows "With help", never "Recalled", for it.

Hints and revealed corrections persist across close/reopen. Dialogue hints apply
to their specific reply. A progress peek that exposes all vocabulary assists the
whole word set. A scored word cannot be reopened to manufacture another unaided
success from its displayed answer. Unverified alternative sentences remain
ungraded practice and never become incorrect grammar events or mastery evidence.

## Authoring another curriculum

Implement a small content adapter with source examples and stable IDs. Render the
shared activities and record only the evidence the activity actually checks.
For non-language subjects, replace Hanzi production with a subject-specific
response/evaluator; preserve the same hint, assistance, feedback, and revisit
contracts. Do not manufacture new examples or infer mastery from chapter completion.

## Verification

`npm test` covers retrieval evidence, source fidelity across the Mandarin curricula,
speech lifecycle, evaluator failures, and semantic checkpoints. `npm run build`
checks the app. See `production-practice.md` for server setup and browser boundaries.
