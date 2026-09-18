# Lesson 9 gaps — 阳光总在风雨后

Confirmed from `src/data/hsk4a.json` (p.102). No book PDF/extract lives in the repo, so printed-page extras beyond the JSON cannot be checked.

## Overlay coverage

- **36 words written** in `lesson-09.json`: 33 生词 + 3 补充生词 (known-char).
- **36 examples**: every entry has a book line that contains the headword.
- **0 生词 skipped** in the overlay file.

## Sitting drops (app will not teach these)

`teachableVocab` + `attachVocab` only read `lesson.vocab`, skip `pr.n.`, and cap a 课文 at 10 words. Lesson 9 never hits the cap (6–7 each). These still fall out of sittings:

| Word | Why it drops | Where the book uses it |
| --- | --- | --- |
| 王红 | `pr.n.` filtered out | 课文3 opener |
| 爱迪生 | `pr.n.` filtered out | 课文5 Edison line |
| 餐 | known-char 补充, not in `lesson.vocab` | no 课文9 line (see below) |
| 父母 | known-char 补充, not in `lesson.vocab` | 课文3 当时她的父母和亲戚都不支持她 |
| 奖 | known-char 补充, not in `lesson.vocab` | 课文2 国际大奖 |

Sittings that *do* play (31 teachable 生词):

- 课文1 (6): 饼干、难道、得、坚持、放弃、主意 — 语言点 难道
- 课文2 (7): 网球、国际、轻松、赢、随便、汗、通过 — 语言点 通过
- 课文3 (6): 篇、作家、当时、可是、正确、理想 — 语言点 可是
- 课文4 (6): 勇敢、结果、失败、过程、至少、总结 — 语言点 结果
- 课文5 (6): 取、经历、许多、区别、暂时、面对 — 语言点 上
- 整理: 通过—经过, 同字词 果, 文化「成功的秘诀」

课文3 never teaches 王红 even though the sitting is her story. 课文5 never teaches 爱迪生 even though the sitting is his lamp.

## Example notes

- **餐**: no 课文 / 语法 / 练习 sentence in the whole extract contains 餐. Closest book hit is Lesson 5 culture 「餐饮」. Overlay uses that line; it is not a Lesson 9 课文 example. `exampleFor("餐")` would also land here.
- **得**: overlay locks the modal 就得少吃东西. A shortest-match `exampleFor("得")` can hit 打得 / 得过 / 得到 instead.
- **取**: 课文5 sense is 取得成功. 练习2 blank ⑦ is 取行李箱 (pick up a suitcase) — second sense, not in the overlay example.
- **结果**: overlay uses the 课文4 noun (不要担心结果). 语言点 also teaches conjunction 结果 (“as it turned out”).
- **汗 / 轻松 / 随便**: 课文 writes 汗水, 轻轻松松, 随随便便. Headword still sits inside those lines.
- Several examples are the second sentence of a two-sentence speaker turn (饼干 / 难道, 网球 / 轻松). Still book text.

## 语言点 not a 生词

**上** (“reach / over a quantity”: 上千种材料) is 注释5 and the 课文5 grammar card. It is not in `lesson.vocab` or `knownCharWords`. No teach overlay.

难道 / 通过 / 可是 / 结果 are both 生词 and 语言点; overlays cover the 课文 sense, not the full grammar page.

## JSON / extract omissions

- 课文4 and 课文5 headings are empty in `hsk4a.json`. Printed titles (if any) are missing.
- Warm-up picture keys are not printed (A–F unlabeled).
- Most 练习 / 练一练 blanks have no answer key in the extract.
- No PDF in the repo to confirm extra 补充生词, footnotes, or audio scripts beyond the JSON.
- 面对 is also listed under `supraWords` as 五级. It is still a Lesson 9 生词 and is in the overlay.

## Book material the overlays do not teach

By design (words only): 热身, 五篇课文 as reading, 语言点 explanations, 比一比 通过—经过, 同字词 果 (如果 / 结果 / 效果), 文化「成功的秘诀」, and all 练习 / 运用.

Title words **阳光** (Lesson 8 生词) and **风雨** are not Lesson 9 生词. 课文1–5 also reuse earlier words (巧克力, 减肥, 亲戚, 律师, 小说, 材料, …) that belong to other lessons.
