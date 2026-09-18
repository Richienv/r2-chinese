# Lesson 7 gaps — 最好的医生是自己

Confirmed from `src/data/hsk4a.json` (标准教程 HSK 4上, p.78). No book PDF or extract is in the repo.

## Overlay coverage

- **37 words written** in `lesson-07.json`: 33 生词 from `lessons[7].vocab` + 4 补充生词 (`known-char` / `knownCharWords`).
- **37 book examples**, each a 课文 line or the book’s own 语言点 sentence cut from that 课文.
- 生词: 流血、擦、气候、估计、咳嗽、严重、窗户、空气、抽烟、动作、帅、出现、后悔、来不及、反对、大夫、植物、研究、超过、散步、指、精神、教授、数字、说明、要是、既、减肥、辛苦、肚子、感情、烦恼、掉.
- 补充生词: 保、处、加、纸.

## Sitting drops (`attachVocab` / `teachableVocab`)

`teachableVocab` only reads `l.vocab`, so the 4 补充生词 never join a sitting even though they appear in 课文:

| Word | First real 课文 | Why dropped |
| --- | --- | --- |
| 纸 | 课文1 快用纸擦擦 | `known-char` (from 报纸), not in `l.vocab` |
| 保 | 课文1 一定要多注意保暖 | `known-char` (from 保证), not in `l.vocab` |
| 处 | 课文3 多向远处看看 | `known-char` (from 到处), not in `l.vocab` |
| 加 | 课文5 能加深感情 | `known-char` (from 增加), not in `l.vocab` |

The 33 生词 all appear in a 课文 and stay under `TEXT_WORD_CAP` (10). No overflow to 课文5.

Current sittings (生词 only):

| Sitting | Words | 语言点 |
| --- | --- | --- |
| 课文1 小李和小林聊天气和身体情况 | 流血 擦 气候 估计 咳嗽 严重 窗户 空气 (8) | 估计 |
| 课文2 小夏和小雨聊小雨抽烟的事情 | 抽烟 动作 帅 出现 后悔 来不及 反对 (7) | 来不及 |
| 课文3 小李和小林聊电脑对身体的影响 | 大夫 植物 研究 超过 散步 (5) | 离合词重叠 |
| 课文4 (heading empty) | 指 精神 教授 数字 说明 要是 (6) | 要是 |
| 课文5 (heading empty) | 既 减肥 辛苦 肚子 感情 烦恼 掉 (7) | 既……又/也/还…… |

`流血` / `既` / `精神` are tagged `supra` (`精神` is 五级) but they are in `l.vocab`, so the sittings do teach them.

If 处 were later added to `l.vocab`, `attachVocab` would first-hit 课文2 via 好处 (false substring) and sit it in the smoking dialogue, not 远处.

## Not 生词 — left out of the JSON on purpose

- **离合词重叠** — 语言点 3 (课文3), a pattern (散散步 / 帮帮忙 / 睡睡觉), not a 生词. Sitting 课文3 already teaches it as grammar.
- **可能** — 比一比 pair with 估计, wrap-only.
- 热身 picture words 流血 / 咳嗽 / 减肥 / 抽烟 / 植物 / 烦恼 are already 生词; the photos and the 跑步/游泳 table are warmup only.
- 课文 props not in this lesson’s 生词表: 鼻子、天气、干、感冒、头疼、保暖、换、老样子、好处、周围、长时间、跳、远处、静坐、健康、生病、锻炼、公园.
- 同字词 气：生气、脾气 are earlier-lesson words; 空气、气候 are this lesson’s 生词 (already overlaid).
- 文化「太极和太极拳」, 热身, 练一练 / 做一做 / 运用 / 复述 — extras, not teach-word overlays.

## JSON omissions vs the printed lesson

- 课文4 and 课文5 have empty `heading_zh` / `heading_en`. Dialogues 1–3 are titled.
- `抽烟` has an empty `pos` in `hsk4a.json` (verb-object; book often leaves POS blank). Overlay keeps the empty pos.
- `烦恼` is `adj.` in the 生词表; 课文5 uses it as a noun (一天的烦恼).
- `估计` / `气候` overlays use the first sentence of 课文1 line 2 (also 语言点 估计 example 1). The printed line continues: 今天天气不是很冷，你怎么穿这么多？
- `要是` overlay uses the book’s 语言点 sentence 要是健康是1，其他都是1后面的0 — the same clause inside 课文4’s long 教授 line.
- `保` 课文 sense is 保暖 (keep warm), not the * gloss “to guarantee.”
- `处` 课文 sense is 远处 (a place far off), not 好处 and not standalone “someplace.”
- `加` 课文 sense is 加深 (deepen), not the * gloss “to add.”
- `散步` is taught on 散散步 (highlight still hits). Title-essay 课文5 is the richer 散步 text, but first sit is 课文3.
- `减肥` is in 热身 but first 课文 hit is 课文5, so the sitting is 课文5, not 课文1.
- No printed-page 补充生词 list to cross-check beyond `knownCharWords` (保、处、加、纸). Combinatorial `supplementary` has no Lesson 7 row.
