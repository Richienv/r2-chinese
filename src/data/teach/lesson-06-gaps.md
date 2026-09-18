# Lesson 6 gaps — 一分钱一分货

Confirmed from `src/data/hsk4a.json` (标准教程 HSK 4上, p.66). Title: 一分钱一分货 / Yì fēn qián yì fēn huò / The higher the price, the better the quality. No book PDF or extract is in the repo.

## Overlay coverage

- **36 words written** in `lesson-06.json`: 31 生词 from `lessons[6].vocab` + 5 补充生词 (`known-char` / `knownCharWords`).
- **36 book examples**: 35 are 课文 lines from this lesson; **价钱** has no 课文 hit (see below).
- 生词: 果汁、售货员、袜子、打扰、竟然、西红柿、百分之、倍、皮肤、好处、尝、轻、方面、值得、活动、内、免费、修理、支持、举行、满、其中、小说、会员卡、所有、获得、情况、例如、举办、各、降低.
- 补充生词: 购、货、价钱、小朋友、折.
- 会员卡 is tagged `supra` (above HSK 4) but it is in `l.vocab`, so 课文4 does teach it. `lesson.vocab` does not mark any item with the `* / supplementary` note used in Lesson 1.

## Sitting drops (`attachVocab` / `teachableVocab`)

`teachableVocab` only reads `l.vocab`, so the 5 补充生词 never join a sitting even though four of them appear in 课文:

| Word | First real 课文 | Why dropped |
| --- | --- | --- |
| 购 | 课文4 购书满… / 欢迎大家选购 | `known-char` (from 购物), not in `l.vocab` |
| 货 | 课文2 一分钱一分货 | `known-char` (from 售货员), not in `l.vocab`. If it were attached by `includes`, 课文1’s 售货员 would steal it as a false substring. |
| 价钱 | none in any 课文 | `known-char` (from 价格、钱), not in `l.vocab` |
| 小朋友 | 课文4 …所有的小朋友还可以获得一份小礼物 | `known-char` (from 小、朋友), not in `l.vocab` |
| 折 | 课文3 打折活动, then 课文4 7.5折 / 8折 / 6折 | `known-char` (from 打折), not in `l.vocab` |

The 31 生词 all appear in a 课文 and stay under `TEXT_WORD_CAP` (10). No overflow to 课文5.

Current sittings (生词 only):

| Sitting | Words | 语言点 |
| --- | --- | --- |
| 课文1 张远和李进聊李进昨晚的购物经历 | 果汁 售货员 袜子 打扰 竟然 (5) | 竟然 |
| 课文2 王静在商店买西红柿 | 西红柿 百分之 倍 皮肤 好处 尝 (6) | 倍 |
| 课文3 李进在商场买行李箱 | 轻 方面 值得 活动 内 免费 修理 (7) | 值得 |
| 课文4 (heading empty) | 支持 举行 满 其中 小说 会员卡 所有 获得 (8) | 其中 |
| 课文5 (heading empty) | 情况 例如 举办 各 降低 (5) | (在)……下 |

## 价钱 — no 课文 sentence

`价钱` never appears in Lesson 6 课文, 语言点 examples, or 同字词 lines. The only book mention is inside extras.compare 值得—值: 这个沙发价钱不贵，质量又好，值得买. Overlay uses that line; pinyin is reconstructed from the note’s English, not a printed pinyin field.

## Not 生词 — left out of the JSON on purpose

- **(在)……下** — 语言点 5 (课文5), a pattern, not a 生词. 情况 is the 生词 inside 一般情况下.
- **值** — 比一比 pair with 值得, not a Lesson 6 生词.
- 热身 pictorial words **裤子、衬衫、行李箱** — warmup + 课文 props. 裤子 / 衬衫 ride the 售货员 line; 行李箱 is the 课文3 product. None are this lesson’s 生词.
- **绿色** — 课文2 “绿色” tomatoes and 文化「绿色食品」. Not a 生词.
- Recycled earlier 生词 in the 课文: 商场、打折、价格、质量、超市 (L5 and before).
- 比一比 值得—值, 同字词 其（其次、其中、其实、其他、尤其）, 文化「绿色食品」, 热身, 练习 / 运用 — extras, not teach-word overlays.
- Combinatorial `supplementary` 葡萄汁 (葡萄 + 果汁) is a later 扩展, not this lesson’s 补充生词.

## JSON omissions vs the printed lesson

- 课文4 and 课文5 have empty `heading_zh` / `heading_en`. Dialogues 1–3 are titled.
- `百分之` has an empty `pos` in `hsk4a.json`. Overlay keeps the empty pos.
- `免费` is written `miǎn fèi` (space); 课文3 is `免费` with no space, so `splitOnWord` still hits.
- `尝` is taught on a 尝尝 line — the highlight lands twice inside the reduplication.
- `各` is taught on 各种各样 — the highlight lands on each 各.
- `购` is taught on 购书 — the highlight is the first character of the compound.
- `折` is taught on a line that also contains 打折, so the highlight hits the 折 in 打折 and the measure 7.5折 / 8折 / 6折.
- No printed-page 补充生词 `*` list to cross-check beyond `knownCharWords` (购、货、价钱、小朋友、折) and `supraWords` (会员卡).
- 练一练 / 练习1–2 / 做一做 / 运用1–2 live in `extras.exercises` only. The app sittings do not play them.
