# Yulu design unity — 14 November 2026

## Contract

The interface uses one sage background, matte cards, teal actions and a dark teal recall field. The shared tokens and compatibility rules live in `src/styles/design-system.css`. Legacy token names remain aliases to prevent course components from drifting while they are gradually consolidated.

Home offers the current session and due recall. Materials owns the complete lesson sequence, listening and sentence practice. Progress owns activity and mastery; Profile owns preferences, account status and backup export. Course, word, node, draft and progress IDs are unchanged.

## Before / after

| Area | Before | After |
| --- | --- | --- |
| Palette and surfaces | Independent cream, orange, red, sage and blue styles | Shared sage, teal, matte surfaces, 24px cards and 14px controls |
| Base buttons and forms | Mixed metallic shadows, heights and focus colours | Shared 52px main actions, restrained press feedback and visible focus |
| Library | Large slogan and widely spaced rows | Compact title, three readable course cards, secondary reading link |
| Language selector | 32×22px controls | Separate 44×44px targets; plain Indonesia label |
| Home | Full lesson path, memory statistics and duplicated practice doors | Next lesson only, due recall and two shortcuts |
| Memory card | Large decorative statistics always visible | Clear due status; optional details retain intervals and placement access |
| Materials | Long, expanded paths with alternating 3D plaques | Current lesson expanded; other lesson groups open on demand |
| Shared lesson component | Pointer springs, SVG connector geometry and moving rails | Simple semantic list with current, complete and locked states |
| Book Home | Entire chapter path | Current chapter; full sequence remains in Materials |
| Navigation | Learn label; bouncing/rotating icons and delayed text | Materials label; short settle, immediate text, no repeat animation on current tab |
| Labels | Word trail / Learning trail, Listening room, Make it yours | My words, Listening, Sentence practice; Indonesian entries included |
| Profile | Duplicate learning shortcuts, ornaments and tiny text | Settings-focused layout, readable labels and neutral avatar |
| Profile data | Reset adjacent to normal account tasks | Export visible; reset tucked under Start over, original confirmation retained |
| Optional music | Lazy-loaded styles could float over Profile | In-flow Profile control; source, volume and playback untouched |
| Progress | Decorative hero, repeated navigation and long copy | Shared cards, shorter summary and readable activity labels |
| Teaching | Warm surfaces, stacked depth and red display controls | Matte teaching cards, teal toggles and cues; normal-weight explanatory text |
| Listening | Settings and display controls always occupy the footer | Play/skip stay visible; existing settings expand under Playback options |
| Writing | Separate brown/gold control style | Shared teal buttons and sage surfaces; correct/repair semantics retained |
| Recall and repair | Blue focus field and tiny supporting labels | Dark teal field, larger labels, matching action shape and explicit correct/repair colours |
| Browser chrome | Old cream theme and internal project title | Sage theme and Yulu title |
| Motion | Decorative path motion and repeated initial entrances | Short opacity/transform transitions; no animated blur; reduced-motion rules retained |

## Data and audio boundary

No changes to store, scheduler, learning engine, sync, storage, database, recorded audio, neural voice mapping, playback code, API, server or dependencies. Listening defaults and callbacks are unchanged; only the settings container and labels changed. Old origin aliases must remain in place because browser progress is origin-specific. Never clear site data as an upgrade step.

## Verification

Browser checks use a separate localhost origin, with test learning activity only. Check library, Home, Materials, Profile, Progress, HSK lesson, recall/partial repair, listening, Books, Jiaocheng and workplace Mandarin. Inspect 390×844 and 320×740 viewport layouts; verify no horizontal overflow, 44px language targets, accordion states, preserved locks and return focus. Physical iPhone keyboard/safe-area behaviour and frame-rate profiling are not claimed.

Build and regression outcomes are recorded in the release handover. Large pre-existing course chunks still produce Vite warnings; this release is not a bundle optimisation.
