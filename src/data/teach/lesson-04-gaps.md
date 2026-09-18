# Lesson 4 gaps — 不要太着急赚钱

Confirmed from `src/data/hsk4a.json` (标准教程 HSK 4上, p.40). No book PDF/extract in the repo.

## Overlays written

34 words in `lesson-04.json`: all 32 `lesson.vocab` 生词 plus the two Lesson 4 补充生词 / known-char items **按** (from 按照) and **成** (from 成功).

34 / 34 have a book example. **王** is the only weak one (heading, not a 课文 line).

## Sitting assignment (`attachVocab` / `TEXT_WORD_CAP` 10)

No cap overflow. Max sitting is 7 words.

| Sitting | Words taught | Count |
| --- | --- | --- |
| 课文1 | 提、以为、份、完全、赚 | 5 |
| 课文2 | 调查、原来、计划、提前、保证、提醒、乱 | 7 |
| 课文3 | 生意、谈、并、积累、经验、一切 | 6 |
| 课文4 | 按照、成功、顺利、感谢、消息、按时、奖金 | 7 |
| 课文5 | 工资、方法、知识、不得不、甚至、责任 | 6 |
| 整理 | 比一比 原来—本来, 同字词 法, 文化 授人以鱼不如授人以渔 | — |

### Sitting drops (app will not 4-beat these unless overlays are wired in)

- **王** — in 生词 / `properNouns`, filtered by `teachableVocab` (`proper` / `pr.n`). Never attached to a sitting.
- **按** — `knownCharWords` Lesson 4, not in `lesson.vocab`, so `attachVocab` never sees it. Overlay is written.
- **成** — same as 按. Overlay is written.
- **并** is tagged `supra` (beyond HSK 4) but it *is* in `lesson.vocab`, so 课文3 already teaches it. Not a drop.

## JSON / app omissions vs the printed lesson

- **课文4 / 课文5 headings are empty** in `hsk4a.json`. Dialogues 1–3 have titles; the two passages do not. Cannot confirm printed titles without the PDF.
- **王 never appears inside a 课文 `zh` line.** Only 课文2/3 headings (`王经理和…`) and speaker labels. Overlay example is the 课文2 heading, flagged.
- **Warm-up picture words** 手忙脚乱, 谈生意, 赚钱 are taught as units in 热身1. JSON 生词 only stores 乱 / 谈+生意 / 赚. Did not add extra keys.
- **责任心** is the 课文5 compound; 生词 is 责任. Overlay example is the 责任心 line.
- **万事开头难** is spoken in 课文3 and used in 运用2; not a 生词. No overlay.
- **金钱** sits in the book-wide `supplementary` list (from 奖金+钱) with no lesson tag. Not treated as Lesson 4 补充生词.
- Warm-up, 练一练 / 做一做 / 复述 / 运用, 比一比, 同字词 drills, and the culture essay are in JSON extras but are not teach-overlay work. Sittings already surface 比一比 / 同字词 / 文化 on 整理.

## Example notes

- **以为** uses the book’s 语言点 citation of 课文1 (without 别提了), so the highlight is clean.
- **并** uses the book’s 语言点 shortening of 课文3 (`…其实并不容易。`).
- **成功 / 顺利** share the only 课文 hit: the long 课文4 thank-you sentence.
- **提 / 按 / 成** examples were chosen so the character is the word itself, not a substring of 提前、提醒、按照、按时、成功、完成、成绩.
- No repo PDF to check whether the printed 生词表 also lists 手忙脚乱 as its own row.

## Not skipped in the overlay file

Every Lesson 4 生词 + 按 + 成 has a `when` / `usage` / book `example`. The skips above are sitting/runtime drops, not missing JSON keys.
