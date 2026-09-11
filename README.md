# Handoff: Yǔlù — Mandarin Learning App (mobile)

## Overview
Yǔlù (语录) is a mobile Mandarin-learning app for **intermediate–advanced learners (HSK 4–6)**. It combines a structured HSK course, spaced-repetition review, and real Chinese handwriting practice (live stroke-order) with a warm, encouraging tone. The prototype covers six connected screens plus two full task flows (a lesson and a review session), all with working state.

Signature visual identity: a **3D "metallic red" theme** — deep glossy red gradients with baked-in highlights and inner shadows — used for every primary surface (hero cards, lesson rows, stat cards, streak calendar, character tiles). Neutral surfaces sit on a warm **cream** background (#F4EFE4).

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing the intended look, layout, and behavior. **They are not production code to copy directly.**

The prototype is authored as a single "Design Component" (`.dc.html`) that depends on a proprietary runtime (`support.js`) — a lightweight template + logic-class renderer. **Do not ship `support.js` or the `.dc.html` format.** They are included only so you can open the prototype in a browser and inspect exact markup, inline styles, and logic.

Your task: **recreate these designs in the target codebase's existing environment** (React Native, Flutter, SwiftUI, React web, etc.) using its established component patterns, navigation, and styling system. If no codebase exists yet, React Native (Expo) or SwiftUI are both good fits for this mobile design. The logic class in the prototype (state, flows, handlers) is a faithful behavioral spec — translate it to your framework's idioms.

### How to open the prototype
Open `Yulu Chinese App.dc.html` in a browser (it self-loads `support.js` and streams the UI). Use the on-screen bottom nav and buttons to move between screens. There is a **Tweaks/props panel** exposing: `startScreen` (jump to any screen), `learnerName`, `showPinyin`, `soundOn`.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, shadows, copy, and interactions are all specified. Recreate the UI pixel-accurately using your codebase's libraries. Exact hex values and measurements are in **Design Tokens** below.

---

## Device frame & canvas
- The prototype renders inside a **392 × 840 px** phone screen (inside a dark bezel — the bezel is prototype chrome only; **do not build the bezel**, your app runs fullscreen on a real device).
- A **status bar** (height 50px, 9:41 + signal/wifi/battery glyphs) and a **notch pill** are prototype chrome — replace with the platform's real safe-area/status bar.
- Root layout: vertical flex column. A scrollable content area between a fixed status bar (top) and a fixed **floating bottom tab bar** (bottom). Content horizontal padding is **22px**.
- App background: cream `#F4EFE4`.

---

## Screens / Views

### 1. Onboarding (3 steps)
- **Purpose**: First-run setup — welcome, pick a goal, pick a daily pace.
- **Layout**: Full-screen column with a top row (back button on steps 2–3 + a 3-dot progress indicator centered) and a bottom full-width primary button. Middle area vertically centered.
- **Step 0 — Welcome**: 116×116 rounded-square (radius 34) app icon with metallic-red gradient + floating animation, displaying the character **语** (Noto Serif SC, 62px, white). Title "Yǔlù" (Plus Jakarta Sans 800, 36px). Subtitle paragraph (500, 16px, #8A8A90). Button: "Get started".
- **Step 1 — Goal**: Title "What's your goal?". A vertical list of 5 selectable chips (see *Goal chip* component). Button: "Continue".
- **Step 2 — Daily goal**: Title "Daily goal". A 2×2 grid of 4 selectable pace tiles (10/15/20/30 min, tags Casual/Steady/Serious/Intense). Button: "Start learning".
- **Progress dots**: inactive = 6×6 #E7E2DB; active = 22×6 metallic-red gradient pill. Transition .3s.

### 2. Home / Dashboard (tab)
- **Purpose**: Daily hub — resume learning, see streak/goal, jump to review & focus areas.
- **Layout**: Scrolling column, 22px side padding. Order:
  1. **Header row**: 46×46 avatar (rounded 15, metallic-red gradient, white initial) + greeting ("早上好 👋" small, learner name 800/19). (Notification bell was removed — do not add.)
  2. **Continue-learning hero** (metallic-red card, radius 26): kicker "CONTINUE LEARNING", lesson title 工作与生活 (Noto Sans SC 700, 27px), subtitle "HSK 5 · Unit 3 · Lesson 4", circular white play button, progress bar (40%), "4 of 10 lessons · 40%". Tapping opens the Lesson flow.
  3. **Daily-goal + streak card** (metallic-red, radius 24): left = "DAILY GOAL", "{done} of {total} lessons", "{n} more to reach today's goal ✨", and a streak pill with animated flame; right = a **104px circular progress ring** (SVG) with animated flame + streak count in the center.
  4. **Streak calendar** (metallic-red card): a **GitHub-style monthly contribution grid** showing which days were practiced/missed (see *Streak calendar* below).
  5. **Review CTA** card: "{n} cards due for review", "~5 min". Opens Review flow.
  6. **"Today's focus"** 2×2 grid of 4 tiles: Reading / Speaking / HSK prep / Handwriting (metallic-red tiles, centered white icon + centered label).
  7. **Character of the day** tile: big serif hanzi 效, pinyin xiào, meaning, "10 strokes · Practice handwriting →". Opens Character detail.

### 3. Learn / Course (tab)
- **Purpose**: Browse the HSK 5 course unit and pick a lesson.
- **Layout**: Title "HSK 5 Course" (800/25). A course progress bar (62%). An **"UP NEXT" hero** (metallic-red, radius 24) with 工作与生活 / "Lesson 4 · New vocabulary + writing" + circular play button. Section label "Unit 3 · 工作与生活". A vertical list of **lesson rows** (metallic-red cards) — states: done (glass check badge + "Done"), current (white play badge + "Start", extra ring highlight), locked (lock icon, 50% opacity, non-interactive).

### 4. Progress / Stats (tab)
- **Purpose**: Show streak, XP, words, time, weekly activity and per-level HSK completion.
- **Layout**: Title "Progress". A 2×2 grid of **stat cards** (metallic-red): day streak / total XP / words learned / min this week — each a glass icon chip + big white number + light label. A **"This week"** card (metallic-red) with a 7-bar weekly activity chart (bars = translucent white, today's bar = white gradient) and an "18%" up indicator. An **"HSK levels"** card (metallic-red) with 6 labeled progress bars (HSK 1–3 = 100%, HSK 4 = 78%, HSK 5 = 62% highlighted, HSK 6 = 12%).

### 5. Profile (tab)
- **Purpose**: Identity, achievements, settings.
- **Layout**: Centered avatar (84×84, rounded 28, metallic-red) + name + "HSK 5 · Intermediate" pill + "Learning since January 2026". A 3-up mini stat row (streak / words / rank). **Achievements** grid (3 columns): 3 earned (metallic-red circular medals) + 3 locked (grey, 55% opacity). **Settings** list card: Character set (Simplified), Daily reminder (8:00 PM), Sound effects (toggle — bound to `soundOn`), Replay onboarding (re-enters onboarding), Help & support. "Sign out" text button (#E0521C).

### 6. Character detail (overlay)
- **Purpose**: Study one character — stroke order, pronunciation, example words.
- **Layout**: Header (back / "Character" / star). Centered pinyin (800/32, red) + meaning. A row of 3 pills: HSK level, stroke count, radical. A **220–230px writing grid** (rice-grid guides) hosting a live **HanziWriter** canvas. Buttons: **Animate** (metallic-red), **Practice** (dark, runs HanziWriter quiz — user traces), **Reset** (icon). "Hear pronunciation" button (TTS). "Words with {char}" list — each row: hanzi + pinyin + meaning + a round speak button.

---

## Task flows

### Lesson flow (opened from Home hero / Learn)
Sequence of 5 steps with a top progress bar ("{step}/{total}") and back button:
1. **Vocab (效率 xiàolǜ)** — a **flip flashcard**: front shows hanzi only; **tap flips** (3D rotateY, .6s) to reveal pinyin + meaning. A small **"See example"** pill button opens a **modal popup** (backdrop blur) with the example sentence, pinyin, translation, and a **Listen** button (TTS). Bottom "Next".
2. **Vocab (平衡 pínghéng)** — same pattern.
3. **Multiple-choice quiz** — "Which word means 'efficiency'?" 4 options; selecting shows correct (green)/incorrect (red) states + an explanation panel; "Next" is disabled until answered.
4. **Cloze (fill-in-the-blank)** — same answer mechanic, options carry English glosses.
5. **Handwriting (write 效)** — HanziWriter quiz on a rice-grid; Animate / Practice / Reset controls; "Finish".
- **Complete screen**: big animated check medal, "Lesson complete!", stat chips (+40 XP, +2 new words, streak), "Continue" (returns Home and increments lessonsDone/xp/words).

### Review flow (SRS, opened from Home review CTA)
- Top: close (×), "Review", "{n}/{total}", progress bar.
- A large card centered on a rice-cream surface: front = hanzi only + "Tap to reveal"; **"Show answer"** reveals pinyin + meaning + example. Then a 2×2 rating grid: **Again** (red) / **Hard** (amber) / **Good** (green) / **Easy** (blue).
- 5 cards total. **Complete screen**: check medal, "Review complete!", stats (reviewed / recalled % / +XP), "Done" (zeroes reviewsDue, adds XP).

---

## Interactions & Behavior
- **Navigation**: bottom tab bar switches Home/Learn/Stats/Profile. Overlays (Lesson, Review, Character) render above the tab layer and return via back/close. All state is in-memory (no routing/URL).
- **Flip card**: 3D `rotateY(180deg)` over `transform-style: preserve-3d`, transition `.6s cubic-bezier(.4,.15,.2,1)`. ⚠️ **Implementation note**: a transformed 3D subtree can swallow taps — the prototype puts a plain (non-transformed) transparent tap-catcher `<div>` over the card (`position:absolute; inset:0; z-index:5`) to receive the click reliably. Reproduce an equivalent hit target in your platform.
- **Quiz answer**: on select, lock options, color the chosen + correct answers, reveal explanation, enable Next.
- **HanziWriter**: `HanziWriter.create(el, char, {...})`; `.animateCharacter()` (Animate), `.quiz()` (Practice), and hide→show to reset. Config used: `showOutline:true, showCharacter:true, strokeColor:#26262B, outlineColor:#E7E1DA, radicalColor:#FA5A3C, drawingColor:#FA5A3C, highlightColor:#FFB13C, strokeAnimationSpeed:1.15, delayBetweenStrokes:170, drawingWidth:30`. Use the native equivalent or a WebView; stroke data loads from the hanzi-writer CDN.
- **Audio (TTS)**: Web Speech `SpeechSynthesisUtterance`, `lang:'zh-CN'`, `rate:0.8`, gated by `soundOn`. Replace with the platform's TTS (zh-CN) or prerecorded audio.
- **Animations**: `yl-pop` (scale-in .3–.45s) for medals/cards; `yl-float` (gentle 4.5s bob) for the app icon; **animated streak flame** — two SVG flame layers on `yl-flame`/`yl-flame2` (0.65s / 0.45s, out of phase) + a radial glow on `yl-glow` (0.9s). Keep flame animation GPU-driven (transform/opacity only).
- **Streak calendar**: tap a day to inspect; practiced vs missed vs future are visually distinct (see tokens). It's a month grid like GitHub contributions.
- **Toggles**: sound toggle animates the knob (justify-content flip, .2s).

## State Management
In-memory state (translate to your store / view-model). Key variables from the prototype:
- Navigation: `stage` ('onboarding' | 'app'), `tab` ('home'|'learn'|'stats'|'profile'), `overlay` (null|'lesson'|'review'|'character'), `onbStep` (0–2).
- Progress/gamification: `lessonsDone` (9), `goalTotal` (12), `streak` (7), `xp` (1240), `reviewsDue` (24), `wordsLearned` (842).
- Lesson: `lessonStep` (0..5), `lessonChoice`, `lessonAnswered`, `vocabFlipped`, `exampleOpen`.
- Review: `reviewIndex`, `reviewFlipped`, `reviewDone`, `reviewAgain`, `reviewComplete`.
- Onboarding selections: `goal` ('HSK 5'), `dailyGoal` (15).
- Prefs: `soundOn`, `activeChar` ('效'), plus prop `showPinyin`.
- Transitions: `onbNext/onbBack`; `openLesson→lessonNext(×5)→lessonFinish` (increments lessonsDone/xp/words); `openReview→flip→rate(×5)→reviewFinish` (zeroes reviewsDue, adds XP); `openChar(ch)`; `replayOnboarding`.
- **Content data** (vocab list, review cards, character dictionary with radical/stroke/HSK/example words, course lesson list) is defined as arrays/objects in the logic class of `Yulu Chinese App.dc.html` — lift these as your seed content/fixtures.

## Design Tokens

### Colors
- **Metallic-red surface** (the signature). Layered background:
  - Sheen overlay: `linear-gradient(179deg, rgba(255,242,234,.3) 0%, rgba(255,255,255,0) 52%, rgba(94,8,10,.2) 100%)`
  - Base gradient: `linear-gradient(158deg, #FFB983 0%, #F26236 16%, #E22C1C 37%, #C4171A 60%, #951117 84%, #6C0B12 100%)`
  - Shadow/emboss (radius-24 variant): `0 18px 34px -16px rgba(150,16,18,.5), inset 0 1px 1px rgba(255,232,224,.5), inset 0 -6px 12px rgba(94,6,10,.5), inset 0 0 0 1px rgba(255,224,216,.14)`
  - Radius-22 shadow variant: `0 16px 30px -14px rgba(150,16,18,.5), inset 0 1px 1px rgba(255,232,224,.5), inset 0 -5px 10px rgba(94,6,10,.5), inset 0 0 0 1px rgba(255,224,216,.14)`
- Solid red accents: `#D91E1E`, `#E22C1C`, `#C4171A`, `#951117`, `#6C0B12`; warm accent `#F06A2E` / `#FA5A3C`; link `#FA6A3C` (hover `#E0521C`).
- On-red text: white `#FFFFFF` (with `text-shadow:0 1px 2px rgba(94,8,10,.4)`), secondary `rgba(255,236,228,.82)`, tertiary `rgba(255,236,228,.72)`, gold highlight `#FFE3B0`.
- Glass-on-red: fill `rgba(255,255,255,.2)`, hairline `rgba(255,224,216,.14)`, bars/track `rgba(255,255,255,.22)`, bar fill `linear-gradient(90deg,#FFE0B0,#FFFFFF)`.
- Neutrals (cream theme): app bg `#F4EFE4`; white surfaces `#FFFFFF`; card bg `#F6F5F3`; borders `#EFEDEA` / `#EDEAE6` / `#EEE9E3`; ink `#1B1B1F`; muted `#8A8A90` / `#9A9AA0` / `#A8A5A0`; dark button `#161618`.
- Semantic (quiz/review ratings): success `#1B7A3E` on `#EAF7EE`/border `#BFE6CC`; error `#C23B3A` on `#FDECEC`/border `#F6C9C8`; warn `#C0651F` on `#FFF2E6`/border `#F8DCBE`; info `#2C63B8` on `#E9F1FD`/border `#C6DBF6`.
- Writing grid: paper `#FBFAF8`, border `#EEE9E3`, guide dashes `#E6DFD6`.

### Typography
- **UI / Latin**: `Plus Jakarta Sans` (weights 400/500/600/700/800).
- **Chinese (body)**: `Noto Sans SC` (400/500/700/900).
- **Chinese (display, app icon / character-of-day)**: `Noto Serif SC` (600/700).
- Scale seen: 11–13px labels/meta; 14–17px body; 19–27px titles; 30–36px headers; 40–66px display hanzi; 88px review hanzi. Letter-spacing: kickers `+1 to +1.5px` uppercase; big headers `-.2 to -.6px`.

### Spacing & radius
- Screen padding 22px; card padding 16–24px; gaps 10–16px.
- Radius: chips/pills 999px; small tiles 14–18px; cards 20–26px; hero 26px; app icon 34px; badges 13–15px.

### Shadows (neutral)
- Card float: `0 14px 34px -12px rgba(70,45,20,.22)` (bottom nav).
- Soft press: `0 6px 16px -8px rgba(120,60,30,.28)`.

### Motion
- Card/medal entrance `yl-pop` .3–.45s; icon bob `yl-float` 4.5s; flame `yl-flame` .65s + `yl-flame2` .45s + glow `yl-glow` .9s; flip `.6s cubic-bezier(.4,.15,.2,1)`; generic ease/transition .15–.3s.

## Assets
- **Fonts**: Google Fonts — Plus Jakarta Sans, Noto Sans SC, Noto Serif SC. Bundle equivalents in-app.
- **Icons**: inline SVG (stroke-based, ~1.8–2px) drawn in the markup — home/book/bars/user (tab bar), bell, speaker/volume, refresh, lock, check, star, flame, target, pencil, etc. Recreate with your icon set (e.g. Lucide/SF Symbols) at matching weights.
- **HanziWriter**: `hanzi-writer@3.7.0` (CDN in prototype) + its stroke-data CDN. Use a native stroke-order lib or embed HanziWriter in a WebView.
- **Chinese content**: vocab, example sentences, and a small character dictionary (效, 平, …) are inline in the prototype logic — reuse as seed data.
- No raster images or brand logos are used; the "logo" is the typeset character 语.

## Files
- `Yulu Chinese App.dc.html` — the full prototype (all screens + flows + logic). Open in a browser to inspect. **Reference only.**
- `support.js` — proprietary DC runtime required to render the prototype. **Do not ship. Reference only.**
