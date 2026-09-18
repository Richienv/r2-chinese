# Lesson 5 gaps — 只买对的，不买贵的

Confirmed from `src/data/hsk4a.json` (标准教程 HSK 4上, p.52). No book PDF or extract is in the repo.

## Overlay coverage

- **35 words written** in `lesson-05.json`: 31 生词 from `lessons[5].vocab` + 4 补充生词 (`known-char` / `knownCharWords`).
- **35 book examples**, each a 课文 line from this lesson.
- 生词: 家具、沙发、打折、价格、质量、肯定、流行、顺便、台、光、实在、制冷、效果、现金、邀请、葡萄、艺术、广告、味道、优点、实际、考虑、标准、样子、年龄、浪费、购物、尤其、受到、任何、寄.
- 补充生词: 购买、商场、咱、做客.

## Sitting drops (`attachVocab` / `teachableVocab`)

`teachableVocab` only reads `l.vocab`, so the 4 补充生词 never join a sitting even though they appear in 课文:

| Word | First 课文 | Why dropped |
| --- | --- | --- |
| 商场 | 课文2 咱家的冰箱太旧了，商场正好打折… | `known-char`, not in `l.vocab` |
| 咱 | 课文2 咱家的冰箱… | `known-char`, not in `l.vocab` |
| 做客 | 课文3 李老师邀请咱们去他家做客… | `known-char` (`zuò kè`), not in `l.vocab` |
| 购买 | 课文5 …这是吸引人们购买的主要原因 | `known-char`, not in `l.vocab` |

The 31 生词 all appear in a 课文 and stay under `TEXT_WORD_CAP` (10). No overflow to 课文5.

Current sittings (生词 only):

| Sitting | Words | 语言点 |
| --- | --- | --- |
| 课文1 王静在家具店买沙发 | 家具 沙发 打折 价格 质量 肯定 流行 (7) | 肯定 |
| 课文2 王静和李进在商场买东西 | 顺便 台 光 实在 制冷 效果 现金 (7) | 再说 |
| 课文3 李进和王静在超市买礼物 | 邀请 葡萄 艺术 广告 味道 优点 实际 (7) | 实际 |
| 课文4 (heading empty) | 考虑 标准 样子 年龄 浪费 (5) | 对……来说 |
| 课文5 (heading empty) | 购物 尤其 受到 任何 寄 (5) | 尤其 |

`制冷` is tagged `supra` (above HSK 4) but it is in `l.vocab`, so 课文2 does teach it.

## Not 生词 — left out of the JSON on purpose

- **再说** — 语言点 2 (课文2), not in the 生词 list. Sitting 课文2 already teaches it as grammar, not a 4-beat word.
- **对……来说** — 语言点 4, a pattern, not a 生词.
- 热身 pictorial words **葡萄酒** and **信用卡** — warmup only. 葡萄 is the 生词; 葡萄酒 is the 课文3 gift. 信用卡 is recycled (HSK 3), opposite 现金 in 课文2.
- **售货员** — speaker in 课文1; book 生词 is Lesson 6.
- **冰箱** — 课文2 prop, not a Lesson 5 生词.
- **缺点** — 课文3 pair with 优点; Lesson 1 生词.
- 比一比 尤其—特别, 同字词 准（准时、准备、标准）, 文化「中国人的购物习惯」, 热身, 练习 — extras, not teach-word overlays.

## JSON omissions vs the printed lesson

- 课文4 and 课文5 have empty `heading_zh` / `heading_en`. Dialogues 1–3 are titled.
- `购物` has an empty `pos` in `hsk4a.json` (book lists it as a verb). Overlay keeps the empty pos.
- `葡萄` is taught on a 葡萄酒 line — the highlight lands inside 葡萄酒.
- `实际` is taught on an 实际上 line — first 课文 form is the adverb, while the gloss is n. “reality”.
- `做客` is written `zuò kè` (space); 课文3 is `做客` with no space, so `splitOnWord` still hits.
- No printed-page 补充生词 list to cross-check beyond `knownCharWords` (购买、商场、咱、做客). Combinatorial `supplementary` 葡萄汁 is a later 扩展, not this lesson’s 补充生词.
