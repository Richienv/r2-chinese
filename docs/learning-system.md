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
- `MasteryTracker`: current word states and the evidence behind them.
- `RecallFeedback` / `VoiceWaveform`: finite feedback animation and real input visualization.
- `sfx`: interaction, hint, listening, success, repair, and completion cues under one mute preference.
- Semantic checkpoints: stable activity IDs and assistance scopes, with separate account namespaces.

## Evidence rules

Exposure automatically creates a learning-trail entry and review card, but no
retrieval success. Multiple choice records recognition only. Assisted answers
and misses return the word to needs practice. A mastered word needs three unaided
production successes across two distinct days since its latest miss or hint.
This is a transparent product threshold, not a claim of measured fluency.

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
