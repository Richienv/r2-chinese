# Chapter journal

`useBookJournal(part, index)` returns `entry`, `update(patch)`, `markTried()`, `markRevisit()`, and `saveStatus`. All seven reflection fields autosave separately from course progress under `yulu.books.journal.v1`, in a version-1 envelope keyed by `part:index`.

`BookJournal` accepts the source chapter plus `teachBackPrompt`, `actionPrompt`, and `reviewPrompt`. `BookJournalReview` accepts `onOpen(part, index)` and lists deliberately kept actions. A kept action uses `actionSavedAt`; changing its `nextAction` returns it to an unkept planned draft. Other journal fields remain available.

`hasMeaningfulBookReflection(entry)` checks draft completeness only: a substantive own-words explanation and next action. It does not grade accuracy, understanding, or real-world transfer. Action statuses are self-reports. Optional `completionMode` records an explicit `reading-only` or `reflection-drafted` choice without modifying course progress.

Unknown storage versions or damaged JSON are preserved verbatim. Storage failures retain session drafts and expose `saveStatus: 'session-only'`; a later successful write recovers those edits. Valid legacy chapter maps normalize to the current envelope. No journal operation awards points, schedules a word card, or marks mastery.
