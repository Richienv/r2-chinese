# Mandarin production practice

`DialoguePractice` and `SentencePractice` in `src/components/ProductionPractice.tsx`
use actual curriculum text. Reuse these components with another course's source
text rather than copying its lesson UI or generating replacement sentences.

The dialogue lets the learner choose a source speaker and produce up to three
replies. The partner's Mandarin is visible and audible; the learner's reply is
hidden. Sentence creation starts from the source English. Both activities reveal
meaning clues, then source Hanzi, then pinyin/audio only on an explicit hint tap.
Hints, correction-based retries, and opening an answer-bearing vocabulary tracker
make the result assisted. A reply with a known mistake requires a retry or an explicit
review-and-continue action.

## Assessment and evidence

- `source-match`: Hanzi matches the curriculum after whitespace and punctuation
  normalization. This is the only way a reply is confirmed correct, and the only
  evidence that can be graded.
- `practice`: any other wording. The free grammar classifier (below) may name a
  known mistake, which is useful feedback, but nothing can confirm that a
  different sentence is right. It never counts as either a grammar error on the
  learner's record or mastery evidence.

The `ProductionResult.outcomes` array preserves each word's result for each
attempted turn. Consumers should use these outcomes and skip `practice` evidence;
the aggregate result cannot describe mixed successful and difficult replies.
Only words actually used in an accepted response earn successful word outcomes.

Speech recognition transcribes Mandarin through the browser's SpeechRecognition
service. It begins only on a microphone tap, shows interim and final Hanzi, and
aborts when the activity closes. Unsupported browsers, permission failures, and
unreachable speech services retain the typed exercise. Recognition is **not** a
pronunciation or tone score. The visualization uses real microphone input when
available and has a static fallback.

## Grammar checking

There is no grammar service, key or network call. `src/lib/grammar/` is a typed,
rule-based classifier that runs in the browser: see `docs/grammar-checker.md` for
what it checks and, as important, what it cannot. `assessProduction` compares with
the book first, then asks the classifier about any other wording. A known mistake
is named with the fix and why; "no known mistakes" is reported as exactly that and
the reply stays unverified.

Source-grounded grammar coaching (`grammarCoach.ts`) is separate and also local: it
explains the order and purpose of each part of a supported textbook structure and
specific particle or transcription differences without turning a string comparison
into a grammar verdict. Unknown structures receive no invented decomposition.

Browser speech services manage audio processing according to the browser's own
behavior. The app does not upload microphone audio anywhere itself.
Typed and recognized Hanzi stay on the device: nothing is sent for grammar checking.

## Review display

Pinyin and English switches are available in the response review and persist with
the existing reading preferences. They control the reference pinyin, translation,
and coaching explanations; the Hanzi pattern remains visible. The English cue
before answering remains available because it defines the recall task. Detailed
wording comparison is collapsed by default, and “Why this order?” expands the
reason each sentence part occupies its position. The raw difference display is
optional supporting information rather than the lesson itself.

## Verification

Run `npm run typecheck` and
`node --experimental-strip-types --test tests/production.test.mjs`.
Tests cover source matching, valid paraphrases, source differences, role selection,
classifier feedback on a different wording, and the speech lifecycle. Real browser
microphone access requires a separate end-to-end check.

Primary references:

- [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
