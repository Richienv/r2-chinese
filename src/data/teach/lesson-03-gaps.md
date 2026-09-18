# Lesson 3 gaps — 经理对我印象不错

Confirmed from `src/data/hsk4a.json` (标准教程 HSK 4上, p.26). No PDF/extract in the repo.

## Written in `lesson-03.json`

37 overlays, 37 book examples.

- 33 生词 from `lessons[3].vocab` (book order): 挺, 紧张, 信心, 能力, 招聘, 提供, 小雨, 负责, 本来, 应聘, 材料, 符合, 通知, 马, 律师, 专业, 另外, 收入, 咱们, 安排, 首先, 正式, 留, 其次, 诚实, 改变, 感觉, 判断, 顾客, 准时, 不管, 与, 约会
- 3 补充生词 / known-char (vocabIndex tag `known-char`, lesson 3): 面试, 笔试, 体育馆
- 1 title-word reuse: 印象 — printed lesson title and 课文4–5 theme; JSON files the 生词 under Lesson 1

## Sitting drops (`teachableVocab` + `attachVocab`, cap 10)

Current path never overflowed (largest bucket is 8). These words are in the book lesson but **not taught** in any 课文 sitting:

| Word | Why it drops |
|---|---|
| 小雨 | `proper noun` — `teachableVocab` skips names |
| 马 | `proper noun` — same |
| 面试 | known-char 补充生词, not in `lesson.vocab` |
| 笔试 | known-char 补充生词, not in `lesson.vocab` |
| 体育馆 | known-char 补充生词, not in `lesson.vocab` |
| 印象 | title of Lesson 3; `vocabIndex.lesson === 1`, so L3 sittings never meet it |

Sittings as the app attaches them today:

| Sitting | Words (first 课文 hit) | 语言点 |
|---|---|---|
| 课文1 | 挺, 紧张, 信心, 能力, 招聘, 提供 | 挺 |
| 课文2 | 负责, 本来, 应聘, 材料, 符合, 通知 | 本来 |
| 课文3 | 律师, 专业, 另外, 收入, 咱们, 安排 | 另外 |
| 课文4 | 首先, 正式, 留, 其次, 诚实 | 首先……其次…… |
| 课文5 | 改变, 感觉, 判断, 顾客, 准时, 不管, 与, 约会 | 不管 |
| 整理 | — | 另外—另; 同字词 时; 中山装和旗袍 |

`招聘` attaches to 课文1 only because 招聘会 contains 招聘. Verb-sense 这次招聘 is 课文2.

## Example problems (still used, flagged)

- **小雨** — no 课文 line contains the name. Only speaker labels (`小雨`) and the 课文1 heading. Overlay uses the heading. 比一比 also has「最近小雨太忙了…」inside a prose note, not a structured example.
- **马** — no 课文 line contains the surname. Speakers are `马经理`. The only line with 马 is「那我马上跟他们联系」= **马上**, a different word. Overlay uses the 课文2 heading. Do not feed `exampleFor("马")` — it will highlight 马上 or 马克.
- **其次** — `lesson.vocab` pinyin is `qící`; standard / 课文 line is `qícì`. Overlay teaches `qícì`.
- **留** — 课文 always uses the compound 留下. Overlay example is the 课文4 留下印象 line.
- **判断** — listed as `v.`; 课文5 is the noun 感觉和判断.
- Shared 课文 lines (same as the 法律 sitting: one book sentence, several words): 挺/紧张; 信心/能力; 符合/通知; 专业/另外/收入; 首先/正式/留; 感觉/判断; 准时/不管/与/约会; 招聘/体育馆; 材料/笔试.

## JSON / book omissions

No printed PDF in the repo. Gaps below are JSON vs what the extract already stored, plus words the 课文 uses that L3 never lists.

- **课文4 / 课文5 headings are empty** in JSON (`heading_zh` / `heading_en` blank). 课文1–3 have dialogue titles.
- **印象** is the lesson title and the 课文4–5 keyword, but the 生词 is stored on Lesson 1 (足球比赛「印象很深」).
- **判断力** is in `supplementary` (from 判断 + 能力) with **no sentence** anywhere in the book JSON. Not written as an overlay.
- 课文 words the JSON does **not** tag as L3 生词/补充生词: 招聘会, 机会, 住院, 办公室, 同事, 经理, 毕业 (L2), 聚会 (L2), 法律 (L1), 顺利 (L4), 困难 (L2), 面试者.
- Warm-up ① picture-match (紧张 / 面试 / 律师 / 笔试 / 应聘 / 通知) and ② ideal-job survey (月收入, 同事, 交通, 专业…) are stored as two prose strings, not cards.
- `extras.exercises` (练一练 挺/本来/另外/首先/不管, 选词填空, 根据课文回答, 复述, 运用 pair/group) never enter a sitting.
- 比一比 另外—另, 同字词 时（时候、时间、及时、平时、准时）, 文化「中山装和旗袍」 exist on 整理 only — not in teach overlays.

## Not skipped in the overlay file

Every L3 生词, the three known-char 补充生词, and the title word 印象 have a meet→hook→book-example→seal record. Names and 补充生词 are here so a later wire-up can stop dropping them.
