# Mandarin production practice

`DialoguePractice` and `SentencePractice` in `src/components/ProductionPractice.tsx`
use actual curriculum text. Reuse these components with another course's source
text rather than copying its lesson UI or generating replacement sentences.

The dialogue lets the learner choose a source speaker and produce up to three
replies. The partner's Mandarin is visible and audible; the learner's reply is
hidden. Sentence creation starts from the source English. Both activities reveal
meaning clues, then source Hanzi, then pinyin/audio only on an explicit hint tap.
Hints, correction-based retries, and opening an answer-bearing vocabulary tracker
make the result assisted. Invalid reviewed grammar requires a retry or an explicit
review-and-continue action.

## Assessment and evidence

- `source-match`: Hanzi matches the curriculum after whitespace and punctuation
  normalization. No network request is needed.
- `verified`: optional server assessment reviews the recognized or typed Hanzi's
  meaning and grammar. Equivalent natural paraphrases can pass.
- `practice`: no grammar assessment is available. Different wording is explicitly
  unverified and does not count as either a grammar error or mastery evidence.

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

## Optional grammar service

Configure `OPENAI_API_KEY` in the server environment. `OPENAI_ASSESS_MODEL` can
override the default `gpt-4.1-mini`. Neither value belongs in a `VITE_` variable.
Vercel serves `api/assess.ts`; the Vite API middleware serves the same handler
locally. The Vite configuration loads these two server keys from `.env.local` or the
launch environment. Copy `.env.example` to `.env.local` for local setup; the
secret is never exposed to the browser.

Without a server key, book comparison still works and alternatives remain
unverified. Source-grounded grammar coaching is available locally, including
the order and purpose of each part. It explains supported textbook structures
and specific particle or transcription differences without turning a string
comparison into a grammar verdict. Unknown structures receive no invented
decomposition. The endpoint bounds inputs, accepts same-origin JSON requests,
uses strict structured output, times out, and sets response storage to false.
It never logs transcripts. Its in-memory request limits are per server instance;
a shared deployment should add platform authentication and shared rate limiting
before enabling a paid key.

Browser speech services manage audio processing according to the browser's own
behavior. The app does not upload microphone audio to its grammar endpoint.
That endpoint sends only the submitted Hanzi and source context for text review.

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
optional-service fallback, speech lifecycle, origin/configuration checks, and
structured assessment responses. Real browser microphone access and live model
assessment require separate end-to-end checks.

Primary references:

- [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
