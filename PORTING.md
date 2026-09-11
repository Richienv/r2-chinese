# Port notes — prototype → React, on real HSK 4A content

Implementation of the design in [README.md](README.md), with the placeholder
HSK 5 fixtures replaced by the extracted contents of *标准教程 HSK 4上*
(HSK Standard Course 4A, Beijing Language and Culture University Press).

The prototype (`Yulu Chinese App.dc.html`) and its runtime (`support.js`) stay
in the repo as the visual reference. Neither is imported, bundled or deployed —
`.vercelignore` excludes both.

Live: <https://r2-learn-chinese.vercel.app>

## Stack

React 18 + TypeScript + Vite. `hanzi-writer` 3.7 from npm (the prototype used a
CDN tag). Pronunciation is neural Mandarin (see **Audio** below); the browser's
Web Speech `zh-CN` is the offline fallback.

```
npm install
npm run dev        # http://localhost:5174
npm run build      # tsc -b && vite build
```

## Audio

Pronunciation uses **Microsoft's neural Mandarin voice** (`zh-CN-XiaoxiaoNeural`)
instead of the robotic browser default. `api/tts.ts` is a Vercel serverless
function that speaks Edge's "Read Aloud" WebSocket protocol directly — the same
Azure neural engine, reachable with no API key and no per-character cost. It
signs the request with the `Sec-MS-GEC` DRM token (SHA-256 of a 5-minute-rounded
Windows filetime + Microsoft's trusted-client token) and pins the current Edge
version string; both must stay current or the endpoint 403s.

`src/lib/speech.ts` fetches `/api/tts`, caches each phrase's audio for the
session, and plays it through one shared `<audio>` element that is **unlocked on
the first tap** (iOS only allows playback on an element first started inside a
user gesture, so this is what makes audio work after the awaited fetch on
mobile). If the endpoint is unreachable it falls back to Web Speech. Output is
deterministic per (text, voice), so responses are cached hard at the CDN — a word
spoken twice is instant. `setVoice()` can switch to `zh-CN-YunxiNeural` (male) or
`zh-CN-XiaoyiNeural`.

## The data

`src/data/hsk4a.json` (427 KB) is bundled and read through `src/lib/content.ts`,
which builds the indexes the UI needs:

- 10 lessons — each with 3 dialogues + 2 passages, 29–37 new words, 5 grammar
  points with the book's own example sentences, a 刚—刚才-style comparison note,
  a same-character cluster, and a culture article.
- 361-entry vocabulary index, tagged `known-char` / `proper` / `supra`.

Two derived pieces do real work:

- **`segment()`** — greedy longest-match (≤4 chars) over the book vocabulary,
  so any Chinese line renders with its known words individually tappable and
  still reassembles to the original text. This is what makes tap-to-gloss work
  inside dialogue and grammar examples without pre-annotating the corpus.
- **`exampleFor()`** — the shortest sentence anywhere in the book containing a
  given word. Review cards show it, so a word is always revised in the context
  the learner first met it.

## Lesson flow

The handoff's 5-step flow assumed vocabulary-only content. HSK 4A carries a
textbook lesson, so the flow is built from the lesson itself — 8 steps:

课文1 dialogue → vocab deck → 课文2 dialogue → grammar (5 points, paged) →
3 generated MCQs → cloze → handwriting → 提示 → complete.

- **Quizzes are generated, not authored.** `lib/quiz.ts` builds "which word
  means X?" from the lesson's own new words and draws distractors from the same
  part of speech across the book. The cloze blanks a grammar keyword out of one
  of the book's real example sentences; wrong options are grammar keywords from
  other lessons, so the question tests the pattern rather than the vocabulary.
  Generation is seeded off the content, so a question never reshuffles between
  renders.
- **提示 is a step, not a footnote.** The comparison note, same-character
  cluster and culture article are book material an evaluator would expect to
  see used; they close the lesson instead of being dropped.

## Save a word & rapid drill (added after the first pass)

The goal of this pass was one-tap "save a word and drill it 5–10×", plus removing
friction anywhere it blocked continued practice. A 122-agent friction audit
(verified against the real source) surfaced ~110 issues; the highest-leverage set
was implemented:

- **Save from anywhere a word appears.** A star (`SaveStar`) sits in the gloss
  sheet, the vocab flashcard, every character-screen word row, and the review
  card. Starring is also the cheapest path into the SRS deck — `toggleStar`
  seeds an SM-2 card on save (`store.tsx`), so a word you flag while reading is
  drillable immediately, without finishing the lesson.
- **Rapid Drill** (`screens/Drill.tsx`, `lib/drill.ts`). Pick 5/8/10 reps; the
  word (or a saved set) cycles with a two-tap *reveal → again / got it* verdict.
  *Again* re-queues the word a couple of positions later so it genuinely comes
  back in-session. Drilling credits the daily goal + streak (`logDrill`) but
  never mutates an SRS schedule — massed practice and spaced review stay
  independent. Entry points: "Drill this" in the gloss sheet, "Drill all" on the
  Saved-words screen, and per-word from Saved.
- **Saved words screen** (`screens/SavedWords.tsx`) — everything starred in one
  place, tap a row to drill it, "Drill all" for the whole set. Reached from the
  Home "Saved · N" tile.

### Friction removed alongside it

- **The review queue is now live, not frozen.** The old `useMemo`-frozen queue
  meant an `Again` rating never resurfaced the card in-session (contradicting the
  60 s reschedule the notes advertised). The queue is state; `Again` re-inserts
  the word; a **Keep going — N more** button continues past the session cap
  (raised 5 → 8); XP is credited per card in `rate()` instead of a lump sum that
  vanished if you closed early.
- **Nothing is lost mid-practice.** Vocab cards are banked as the deck advances
  (`addCards`, previously dead code), an interrupted lesson persists its position
  (`inProgress`) and resumes from Home ("Resume · step N"), and the lesson has an
  explicit ✕ close instead of only step-by-step Back.
- **Reveal is tappable.** Both the review and drill cards reveal on a tap of the
  card itself (the old "Tap to reveal" hint pointed at a dead element), and the
  ratings are briefly guarded after reveal so a fast double-tap can't misfire.
- **Ergonomics.** 44 px hit targets on the small controls (`.tap44`), `lang`
  attributes on Chinese text, pinch-zoom re-enabled, and `:active` press states
  on the controls a drill hammers.

## The rest of the audit (second friction pass)

A 122-agent audit had surfaced ~110 verified friction points; the first pass took
the top ~30. This pass worked the remainder, grouped into five batches, then ran
an adversarial review over the diff and fixed every confirmed bug.

- **Lesson flow completeness.** The 8-step flow became a controlled-cursor
  architecture: a single footer now owns sub-paging, so it steps through every
  one of a lesson's ~35 vocab cards, all 5 grammar points and every quiz
  question instead of skipping them (the old flow had a duplicate in-body pager
  *and* a footer that jumped past it). All five book texts per lesson are now
  steps — the two passages, previously unreachable, are in. Quiz answers are
  retryable (wrong marks red, you try again; correct speaks the answer and
  reveals the note), the cloze sentence is tap-to-gloss, and the pinyin/English
  toggles persist through `prefs`. Sub-step state and scroll survive a Back
  press because the cursor lives in the parent, not in a remounted child.
- **Review / SRS.** Undo (restores the exact card schedule, XP, day-credit *and*
  the queue an "Again" mutated), a glossed + speakable example on the review
  card, a "Review these N words" hand-off from the lesson-complete screen, and a
  distinct **Practice** mode for not-yet-due cards that logs the rep without
  pushing the SRS interval out.
- **Progress & Profile screens** replace the two "coming soon" stubs — real
  stats (streak / XP / words / est. minutes), a 7-day activity chart and the
  per-lesson course bar; identity, data-derived achievements, and settings that
  write straight to `prefs` (sound, pinyin, English) plus a guarded reset.
- **Content unlock.** A searchable **Vocabulary** browser over all 361 book
  words (filter by tag and lesson, tap to gloss/save/drill) — the app's first
  search field. Locked lessons open for browsing. Proper nouns are filtered out
  of quiz answers and distractors. Same-character pills are cleaned of the raw
  pinyin / em-dash / JSON pollution in the source, and their example sentences
  are surfaced.
- **Nav & a11y.** Active tab restores on reload; XP sits in the Home header;
  overlays trap focus (`inert` on the shell) and close on Escape; the flip card
  hides its off-face from screen readers and carries a speaker on both faces;
  the app shell is the scroller so scroll position no longer leaks between tabs.

**Bugs the adversarial review caught (all fixed and re-verified):** Undo after an
"Again" left a phantom duplicate in the queue (now snapshots and restores the
queue); "Keep going" could pull real due cards into a non-scheduling practice
session (now gated to real sessions); the double-tap rating guard wasn't re-armed
on card 2+ (now armed synchronously on reveal); Undo didn't reverse the daily
card-count (now does); and quitting a drill early credited the full planned total
rather than the reps actually done.

Deferred (in the audit, still not built): single-character tap-to-gloss over
every hanzi (risks making dialogue text noisy), the book's exercises / warm-ups
as interactive practice, and swipe-between-cards gestures.

## Deliberate changes from the handoff

- **Onboarding is not built.** It sets `goal` and `dailyGoal`, neither of which
  the HSK 4A course branches on — the book has one fixed sequence. Progress and
  Profile are likewise deferred; both are readouts over state the core loop
  already produces.
- **SRS is real.** The prototype's review flow was five hard-coded cards and a
  `reviewsDue` counter it zeroed on completion. Cards here are SM-2 scheduled
  (`lib/srs.ts`), seeded from the words of each finished lesson, and the Home
  "due" count is computed rather than stored. `Again` re-queues in 60 s instead
  of a day, so a lapse is actually re-tested in-session.
- **Progress persists.** One `localStorage` key holds lessons done, XP, the
  per-day practice log and every card's schedule. Streak is derived from the
  log rather than stored, so it cannot drift out of sync with the calendar.
- **Daily goal counts cards, not lessons.** A lesson contributes all its new
  words at once, so the display clamps at the goal — the underlying count keeps
  the true figure for the weekly chart in the next pass.
- **Dialogue lines have per-line pinyin and English toggles.** The handoff had a
  single global `showPinyin` prop; in a 6-line dialogue the useful control is
  local and immediate.
- **No device bezel or fake status bar** — those were prototype chrome. The app
  is a fullscreen column capped at 440 px, centred on desktop.

## Faithful to the handoff

The metallic-red stack is carried over verbatim — sheen overlay, the six-stop
158° base gradient, and both emboss shadow variants live as CSS custom
properties in `src/styles.css` and nothing hard-codes them. Cream `#F4EFE4`,
Plus Jakarta Sans / Noto Sans SC / Noto Serif SC, the radius and shadow scales,
`yl-pop` / `yl-float` / the two-layer `yl-flame` + `yl-glow` animation, the
`.6s cubic-bezier(.4,.15,.2,1)` flip with its flat tap-catcher overlay, the
rice-grid writing surface, and the exact HanziWriter config all match.

## Before production

- **Neural audio depends on Edge's undocumented endpoint.** `api/tts.ts` relies
  on Microsoft's free Read-Aloud service and its `Sec-MS-GEC` token + Edge
  version string. Microsoft can change either, and the version needs periodic
  bumping (it's `1-143.0.3650.75` today). The app degrades to the browser voice
  when the endpoint fails, but for a guaranteed-uptime product move to Azure
  Speech (same voices, paid, stable API) or prerecord the fixed lesson audio.
- **HanziWriter stroke data** loads from the hanzi-writer CDN. Self-host it if
  the app must work offline — the writer degrades to a plain glyph on failure,
  which is a fallback, not a feature.
- **Fonts** come from Google Fonts; self-host for production.
- **Copyright.** The lesson text, vocabulary and culture notes are the
  publisher's. This build is fine as a personal study tool; distributing it
  needs permission from Beijing Language and Culture University Press.
