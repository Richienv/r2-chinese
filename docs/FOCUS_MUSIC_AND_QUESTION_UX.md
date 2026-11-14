# Focus music and easier chapter checks

Implemented 14 November 2026. Learning progress and the existing lesson voices are preserved.

## Music shipped

14 selectable items, approximately five hours in total, taken from Richie's Downloads:

- Lofi: the existing 91-minute local mix, copied without re-encoding.
- Pixar Jazz: the complete 173-minute mix, divided into three consecutive parts.
- Windburn, Magnolia, Ethereal, Daylight, Meaningful, Refreshed, Brahms' Lullaby, and three Chinese backing tracks.

Short tracks and jazz parts are AAC at 96 kbps with fast-start metadata. Approximately 198 MB across the whole library. Music streams on demand; rendering the player does not download this collection. Voiceovers, interviews and personal recordings were excluded. Original source files remain untouched. Track names are based on the supplied file names/metadata, not an identification or full listening audit.

Natural mode bypasses the filter. Muffled mode blends into a 1 kHz low-pass path. A separate music gain controls volume and ducks to 18% of the selected level during lesson speech; the Mandarin recordings and speech bus are untouched. Playback always starts with a tap. Preferences retain the existing `yulu.study-music.v1` key; an old saved playing state does not cause autoplay.

Home and Profile expose the library. Lesson, listening, sentence-practice and recall headers expose a compact music control. Music continues across in-app screen changes. Previous/next, a random selection, repeat, sequential playback and 15/30/60-minute sleep timers are available. Background playback still follows the phone/browser's media policies; this release does not promise uninterrupted lock-screen playback.

## Question audit and changes

The HSK, Jiaocheng and workplace-Mandarin screens had nearly identical choice renderers. The underlying question objects already contained an explanation, but these screens did not display it. A wrong choice became disabled and red; the learner often had to keep guessing. The guided sentence exercise also showed a disabled microphone and whole-reply instructions while asking for one missing word.

These are now shared, source-grounded chapter checks. Course content, correct answers, question order, source voice/rate, session IDs, saved step IDs and scheduling algorithms remain the same. Help is a presentation and evidence change, not a lower passing threshold.

### Information and interaction

| Before | After |
| --- | --- |
| Three separate choice screens in WordsSession, Jiaocheng and Kerja | One `ChapterCheck` component with the same question contracts. |
| Header, sentence and choices competed for attention | Short question header, quiet counter, context panel and clearly separated choices. |
| Wrong options alone provided the feedback | Text says what happened and offers a next action. |
| Four choices remained equally demanding | “Narrow to two” keeps the answer and one live distractor, in their original order. |
| Explanation data was not rendered | Worked answer with the actual source explanation, also shown after solving. |
| Translation only available after solving or absent | Optional “Show meaning” explicitly marks the attempt as helped. |
| All four disabled options remained after success | The correct answer remains; distractors clear away so the explanation has room. |
| Feedback could appear below the fold | Newly revealed/solved feedback is scrolled into view; reduced-motion users get an immediate scroll. |
| Lookup/help could be mistaken for independent recall | Current and persisted help are included in recall evidence. Wrong-answer exposure is also retained across resume. |
| No visible distinction between helped success and independent success | “Understood with help” and a short explanation of supported practice. |
| Guided blank exercise showed disabled speech controls and whole-reply instructions | A single missing-word input, “Check word”, and matching instructions; full-sentence mode remains available. |

### Music, motion and access

| Before | After |
| --- | --- |
| One optional local audio file, absent from the production library | Fourteen explicit, deployed tracks/mix parts. |
| One play button and volume control in Profile | Dedicated music sheet with track list, transport, tone, volume, repeat and timer. |
| No muffled setting | Smooth dry/filtered crossfade on the music bus only. |
| Music volume depended on media-element volume | Web Audio gain controls volume and speech ducking. |
| No playback-race protection | Latest play/pause/track request owns state; delayed promises cannot undo pause. |
| Interrupted playback could appear active | Audio-context interruption returns the player to paused. |
| Music controls unavailable inside practice | Compact header launcher; no controls floating over answers or the keyboard. |
| Generic dictionary close label on reused sheet | Optional close label, with music-specific accessible text. |
| No shared layout for the music library | Existing sage/teal tokens, concentric radii, 44 px controls, tabular times and explicit transitions. |
| New motion could ignore accessibility settings | Music/feedback transitions honor reduced motion. |
| English-only new controls | Complete English and Indonesian interface strings. |

## Next UX ideas, ranked

These are proposals, not features claimed as shipped.

1. **Recovery round, not a second exam.** At the end, offer a two-minute session containing only two or three unresolved targets. One worked example, one missing word, then an independent attempt after another question. Keep the existing partial-repair editor so correct text is not retyped. Success criterion: fewer exits after mistakes and better independent recall later, not merely more green answers.
2. **A support ladder that fades.** Start unfamiliar grammar with one blank. After independent success, move to a short reply, then a full sentence in a new context. Two genuine misses step back one level. Store recognition, completion and independent production as different evidence. Easy multiple choice must never automatically promote speaking mastery.
3. **A tiny contrast lesson for repeated confusion.** If the learner repeatedly confuses two words, show those two side by side in one source-backed example each, highlighting only the distinguishing character or meaning. Then ask one new question. Avoid an entire dictionary page.
4. **An explicit low-energy session.** “I have two minutes” creates a short due-review session with a clear stopping point. It should not silently remove overdue items or change the learner's memory score. No guilt messages or streak pressure.
5. **Explain why a word returned.** One quiet line such as “Last time: needed a clue” or “Checking after two weeks.” Show the next interval only after the learner answers. This makes long review gaps and selective repetition understandable.
6. **A worked example before difficult writing.** Offer a structurally similar source example, then remove the shared pattern step by step. Keep the test answer hidden until help is requested. This is preferable to beginning every chapter with a large empty textarea.
7. **A finish screen that closes the loop.** “These two improved; this one needs another try; next session is ready.” One main action to stop or continue, with details behind disclosure. Avoid a dashboard of unrelated scores.
8. **Remember a focus preset.** Favorite tracks plus preferred muffling/volume, optionally saved as a 15- or 30-minute preset. One tap restores it; never autoplay. Consider music fading out during listening questions where hearing details is the skill being assessed.

The pedagogical direction follows the IES practice guide's recommendations on spaced learning, worked examples interleaved with problems, and retrieval quizzes. Applying that combination to this app is a design proposal; its benefit should be measured in this learner's delayed independent recall, not assumed from animation quality. [IES practice guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/1)

The streaming media-element approach and user-gesture playback follow the platform's audio guidance. [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

## Validation and preservation

- Full existing suite plus initial new tests: 270 passed. Final targeted suite after audio-interruption handling: 14 passed, including one additional music test.
- Production build and TypeScript pass; existing large course-chunk warning remains.
- 1,013 tracked learning, storage, content, API and existing audio files matched their pre-change SHA-256 values. No migration or reset was added.
- Fourteen assets passed metadata/duration and end-of-file decode checks. This is technical audio validation, not a claim of listening to every track.
- Browser QA exercised track selection, playback status, tone selection, help, worked answers, supported success and close/resume. Actual CSS viewport widths of 320 and 390 were checked. The browser's existing 90% zoom was accounted for when setting viewport dimensions.
- Local QA used a separate localhost origin. Production learning records were not edited. Physical-iPhone playback and listening quality remain for device testing.
