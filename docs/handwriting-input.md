# Blind Hanzi handwriting recall

The recall activity supports optional finger, pen and mouse input. Draw one
character at a time, then select “Next character” for the second or third Hanzi.
Each numbered position retains its own ink and can be revisited. Undo removes
the last stroke, clear resets that position, and restart clears the full word.
Typed input stays available. No recognition candidate, entered Hanzi, or expected
Hanzi is shown before the full word is checked, except an explicit assisted hint.

This is a real, target-independent local stroke-template classifier. Neither the
expected Hanzi nor the English prompt enters the recognizer. It compares the
whole drawing with a universal corpus of **9,574 simplified and traditional
characters**. Character placement, stroke curves, direction, sequence and count
affect distance. Hungarian minimum-cost stroke assignment tolerates changed pen
order; connected-stroke variants allow one legitimate joined or split pair, and
local shape matching tolerates bounded proportion differences. Crossing and
component connectivity, complete stroke coverage, and original-stroke residual
checks prevent missing strokes from passing as joins. Recognition ranks the
corpus independently of the expected answer. Only afterward does the assessment
compare a sufficiently confident independent result with the expected character.
Geometric distance is not a calibrated probability.

The 3.65 MB corpus loads only when handwriting is opened. Classification runs in
a Web Worker, keeping pointer drawing responsive. A local main-thread fallback
supports environments that cannot create workers. No drawing goes to a server,
and no key is required. Once the corpus is loaded, recognition requires no
network; loading the app itself offline still depends on the app/browser cache.

The check returns correct, incorrect, or uncertain for each captured position.
Every position must pass for the word to pass; uncertain ink records no mastery
or hard-word evidence. Incorrect and uncertain feedback identifies positions
without revealing candidate or expected Hanzi. A learner can redraw or switch
to typing. Multiple cursive joins, uncommon glyphs outside the corpus and highly ambiguous
shapes can still be missed. The recognizer is not a claim of Pleco-level accuracy.

## Data and license

The corpus is derived only from median geometry in pinned
[hanzi-writer-data 2.0.1](https://www.npmjs.com/package/hanzi-writer-data), which
derives from [Make Me a Hanzi](https://github.com/skishore/makemeahanzi).
The source data is under the **Arphic Public License**, derived from Arphic PL
KaitiM GB and Arphic PL UKai. The original English license, source integrity,
modification notice and output hash accompany the local data under
`src/assets/handwriting`. The binary embeds the modification/attribution notice;
the UI exposes the license. The data remains freely redistributable under that
license. No GPL HanziLookupJS recognizer code or dictionary definitions are used.

The recognizer and corpus-conversion code are independently implemented here.
Rebuild the asset using `scripts/build-handwriting-corpus.py` with the pinned npm
tarball; its SHA-512 integrity is checked before processing. No dependency or
global build configuration change is required.

## Verification

`node --experimental-strip-types --test tests/handwriting.test.mjs` checks corpus
integrity, translation/scale invariance, empty/corrupt input, and rankings for
noisy, translated and differently sized traces of 法、律、俩、三、我、你 against the
full corpus. Independent hand-authored 三、十、人、木 and screenshot-derived loose
five-stroke 好 traces test real geometric classification without passing an
expected answer. Jittered and reordered versions of that sketch also pass.
Wrong neighboring glyphs, every single-stroke deletion in the representative
法、律、俩、我、你、好 fixtures, partial ink, scribbles, and reversed
word positions test assessment boundaries. Blind recall tests cover multi-position
navigation, immutable captured ink and withholding knowledge evidence for
uncertainty. These are regression fixtures, not a statistical evaluation of human
handwriting accuracy.

Primary license evidence: [Make Me a Hanzi COPYING](https://github.com/skishore/makemeahanzi/blob/master/COPYING),
[original Arphic license](https://github.com/skishore/makemeahanzi/blob/master/APL/english/ARPHICPL.TXT).
