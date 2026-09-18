# Lesson 2 gaps — 真正的朋友

Confirmed from `src/data/hsk4a.json` (标准教程 HSK 4上). No book PDF in the repo.

## Overlay coverage

- **40 words** in `lesson-02.json`: all 35 `lessons[1].vocab` entries (30 teachable 生词 + 5 专有名词) plus 5 known-char 补充生词.
- 生词: 适应、交、平时、逛、短信、正好、聚会、联系、差不多、专门、毕业、麻烦、好像、重新、尽管、真正、友谊、丰富、无聊、讨厌、却、周围、交流、理解、镜子、而、当、困难、及时、陪.
- 专有名词 (overlay only; `teachableVocab` still skips `pr.n.`): 夏、马克、林、张远、上海.
- 补充生词: 不同、感到、街、身边、校园.

## Sitting map (`attachVocab` + known-char + `TEXT_WORD_CAP = 10`)

After wiring, known-char words join the sitting whose 课文 contains them as a real token.

| Sitting | Words attached | Cap drop? |
| --- | --- | --- |
| 课文1 | 适应、交、平时、逛、短信、正好、街 (7) | no |
| 课文2 | 聚会、联系、差不多、专门、毕业、麻烦 (6) | no |
| 课文3 | 好像、重新、尽管、真正、友谊、校园 (6) | no |
| 课文4 | 丰富、无聊、讨厌、却、周围、交流 (6) | no |
| 课文5 | 理解、镜子、而、当、困难、及时、陪、不同、感到、身边 (10) | no |

专有名词 never sit.

## `exampleFor()` vs this overlay

Substring search would steal later/shorter lines (or false hits). This file pins the first 课文 that actually teaches the word.

| Word | Risk without overlay | Overlay pins |
| --- | --- | --- |
| 当 | 当然了 (课文3) | 课文5 当你遇到困难 |
| 而 | 而且必须 (课文5 line 1) or later 语言点 | 课文5 而我的理解是 |
| 马 / 马克 | 马上 (other lessons) | 马克 overlay; 马上 is a different word |
| 街 | none if 逛街 is the only hit | 课文1 逛街 |
| 交 | 交流 (same lesson, 课文4) | 课文1 交了一个中国朋友 |

## Not in this overlay

- 热身 picture-match and friend table
- 语言点 正好 / 差不多 / 尽管 / 却 / 而 (sitting grammar notes)
- 比一比 差不多—几乎, 同字词 系, 文化「在家靠父母，出门靠朋友」, 练习 prompts
- Combinatorial `supplementary` 友情 (友谊+爱情) — not a Lesson 2 补充生词 row
