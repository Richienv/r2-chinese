# Lesson 10 gaps — 幸福的标准

Confirmed from `src/data/hsk4a.json` (标准教程 HSK 4上, p.116). No book PDF or extract is in the repo. A public Lesson 10 vocab list (hanzistroke) matches the same **30** 生词.

## Overlay coverage

- **30 words written** in `lesson-10.json`: all 30 生词 from `lessons[9].vocab`.
- **30 book examples**, each a 课文 line or the book’s own 注释 excerpt of that line.
- 生词: 礼拜天、空儿、母亲、不过、永远、方向、优秀、硕士、翻译、确实、兴奋、拉、建议、职业、关键、将来、发展、躺、困、经济、条件、富、穷、等、由于、比如、橡皮、糖、低、答案.
- **补充生词: none in the extract.** `lesson.vocab` has no `*`-tagged notes (Lesson 1 has 星星 / 亮). `knownCharWords` and `supraWords` have **zero** `lesson: 10` rows. `vocabIndex` lesson 10 is the same 30 words. Combinatorial `supplementary` (金钱、优质…) is a later 扩展, not this lesson’s 补充生词.

## Sitting drops (`attachVocab` / `teachableVocab`)

No overflow. Every 课文 bucket is 5–7 words, under `TEXT_WORD_CAP` (10). Nothing is spliced onto 课文5.

`teachableVocab` keeps all 30 (every entry has `zh` + `en`, none are `pr.n.`).

| Sitting | Words | 语言点 |
| --- | --- | --- |
| 课文1 孙月和王静聊王静的生活情况 | 礼拜天 空儿 母亲 不过 永远 方向 (6) | 不过 |
| 课文2 高老师和李老师在谈幸福 | 优秀 硕士 翻译 确实 兴奋 拉 (6) | 确实 |
| 课文3 小雨和小夏聊找工作的事情 | 建议 职业 关键 将来 发展 躺 困 (7) | 在……看来 |
| 课文4 (heading empty) | 经济 条件 富 穷 等 由于 (6) | 由于 |
| 课文5 (heading empty) | 比如 橡皮 糖 低 答案 (5) | 比如 |

## Not 生词 — left out of the JSON on purpose

- **在……看来** — 语言点 3 (课文3), a pattern, not a 生词.
- 热身 pictorial words **兴奋 / 硕士 / 困 / 翻译 / 拉 / 躺** — already the 生词; warmup only adds the match-to-picture task.
- Recycled earlier 生词 inside these 课文: 幸福 (L1), 羡慕 (L1), 理解 (L2), 标准 (L5), 教授 (L8), 感情 (L8), 压力 (L8), 态度 (L8), 工资 (L4), 保证 (L4). Not re-taught here.
- Known-char from other lessons that appear in L10 课文: 商场 (L5, 课文2), 感到 (L2, 课文3 感到累), 得到 (L8, 课文5 得到了), 街 (L2, inside 逛街), 美 (L8, 心里别提多美了). Not L10 补充生词.
- Names used as speakers only: 高老师、李老师、王老师、小夏. `properNouns` has 高 / 李 / 孙月 / 王静 / 小雨 from earlier lessons; **小夏** is not in `properNouns`.
- 比一比 不过—但是, 同字词 经（经济、经验、经历）, 文化「知足常乐」, 热身, 练习 — extras, not teach-word overlays.

## JSON omissions vs the printed lesson

- 课文4 and 课文5 have empty `heading_zh` / `heading_en`. Dialogues 1–3 are titled. `sittingHint` therefore falls back to 经济 / 比如.
- No printed-page 补充生词 list in the JSON to cross-check. If the paper book marks * items, they were not extracted.
- Per-word 例句 next to each 生词 are not stored on vocab objects (same as other lessons).
- `发展` is tagged `v.` but 课文3 uses it as a noun (更好的发展). Overlay keeps the book pos and says so in `usage`.
- `翻译` / `建议` are tagged `n.`; speakers also verb them. Overlay keeps the book pos.
- `等` is tagged `part.` “etc.” — not the verb “to wait.”
- `低` only appears inside **高低** in 课文5.

## `exampleFor()` vs this overlay

`exampleFor()` takes the **shortest** book sentence containing the substring, across all 10 lessons. Several L10 words would get the wrong line (or a false hit):

| Word | `exampleFor()` currently | Overlay pins |
| --- | --- | --- |
| 不过 | 我们不过谈了点儿工作方面的问题… (L10 语言点, adv. “only”) | 课文1 conjunction 不过现在我很幸福 |
| 确实 | 爱情确实是结婚的重要原因… (L10 语言点 / L1 leftover) | 课文2 我女儿确实不错 |
| 关键 | shorter 语言点 A/B line | 课文3 兴趣才是关键 |
| 将来 | L4 人们将来做什么工作… | 课文3 将来也会有更好的发展 |
| 由于 | 由于种种原因… (L10 语言点) | 课文4 由于缺钱 |
| 比如 / 橡皮 / 糖 | same 注释5 clause (OK) | that 注释5 clause (first half of 课文5) |
| **困** | **困难** line in L9 (false substring) | 课文3 困了睡睡觉 |
| **富** | **丰富** line in L2 (false substring) | 课文4 富人 |
| **等** | **等你身体出现问题了** L7 (verb “wait”) | 课文4 listing 等 |
| **低** | **降低** line in L6 (false substring) | 课文5 高低 |

Because those four false hits would skip or mis-teach the example beat, this file pins the 课文/注释 sentence even when it is longer.
