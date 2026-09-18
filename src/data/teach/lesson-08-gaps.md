# Lesson 8 gaps — 生活中不缺少美

Confirmed from `src/data/hsk4a.json` (标准教程 HSK 4上, p.90). No book PDF or extract is in the repo.

## Overlay coverage

- **36 words written** in `lesson-08.json`: 29 生词 from `lessons[7].vocab` + 7 补充生词 (`known-char` / `knownCharWords`).
- **36 book examples**, each a 课文 line (or the sentence inside a two-sentence 课文 line) from this lesson.
- 生词: 巧克力、亲戚、伤心、使、心情、愉快、景色、放松、压力、回忆、发生、成为、只要、师傅、大使馆、堵车、距离、耐心、生命、缺少、到处、态度、因此、科学、证明、往往、阳光、积极、特点.
- 补充生词: 女性、美、长期、堵、窗、得到、有关.

`lesson.vocab` has **no** `*` notes (unlike Lesson 1 星星 / 亮). Book-level `data.supplementary` (金钱, 里面, …) is not this lesson. `supraWords` and `properNouns` have no Lesson 8 rows.

## Sitting drops (`attachVocab` / `teachableVocab`)

`teachableVocab` only reads `l.vocab`, so the 7 补充生词 never join a sitting even though they appear in 课文:

| Word | First 课文 | Why dropped |
| --- | --- | --- |
| 女性 | 课文1 尤其是女性 | `known-char`, not in `l.vocab` |
| 美 | 课文2 景色真美 | `known-char`, not in `l.vocab` |
| 长期 | 课文3 长期这样 | `known-char`, not in `l.vocab` |
| 堵 | 课文3 心情也“堵” | `known-char`, not in `l.vocab` |
| 窗 | 课文4 窗外是什么样子 | `known-char`, not in `l.vocab` |
| 得到 | 课文5 眼睛得到休息 | `known-char`, not in `l.vocab` |
| 有关 | 课文5 与她们的性格有关 | `known-char`, not in `l.vocab` |

The 29 生词 all appear in a 课文 and stay under `TEXT_WORD_CAP` (10). No overflow to 课文5.

Current sittings (生词 only):

| Sitting | Words | 语言点 |
| --- | --- | --- |
| 课文1 李老师和高老师聊关于巧克力的事情 | 巧克力 亲戚 伤心 使 心情 愉快 (6) | 使 |
| 课文2 小夏和马克聊关于上次足球比赛的事情 | 景色 放松 压力 回忆 发生 成为 只要 (7) | 只要 |
| 课文3 马克和司机聊关于堵车的事情 | 师傅 大使馆 堵车 距离 耐心 (5) | 可不是 |
| 课文4 (heading empty) | 生命 缺少 到处 态度 因此 (5) | 因此 |
| 课文5 (heading empty) | 科学 证明 往往 阳光 积极 特点 (6) | 往往 |

`心情` / `只要` / `态度` also return in later 课文; the sitting keeps only the first hit.

## Not 生词 — left out of the JSON on purpose

- **可不是** — 语言点 3 (课文3). Sitting 课文3 already teaches it as grammar, not a 4-beat word. Not in `vocabIndex`.
- 热身 pictorial words **大使馆 / 师傅 / 景色 / 生命 / 巧克力 / 堵车** — all are 生词, so they are in the overlay (warmup pictures themselves are unused).
- 课文 props from earlier lessons: 味道 / 尤其 (L5), 空气 / 烦恼 / 窗户 / 研究 / 感情 (L7), 性格 / 脾气 / 浪漫 (L1), 另外 (L3), 浪费 (L5). Not re-taught here.
- Unindexed 课文 words (国外, 礼物, 大多, 难过, 足球, 比赛, 准备, 上班, 迟到, 下班, 休息, 音乐, 颜色, 大自然, 发现, 眼睛, 有心, 无法, 快乐, 选择, 白色 / 红色 / 黄色 / 黑色 / 蓝色 / 绿色, 热情, 安静) — not in this lesson’s 生词 / 补充 lists.
- 比一比 往往—经常, 同字词 要（重要、主要、只要、要是）, 文化「中国人眼中的“红”与“白”」, 热身, 练习 — extras, not teach-word overlays.

## JSON omissions vs the printed lesson

- 课文4 and 课文5 have empty `heading_zh` / `heading_en`. Dialogues 1–3 are titled.
- Per-word 生词 例句 printed beside each entry in the book are not in `hsk4a.json` (vocab objects have no `example` field). Overlays use 课文 lines instead.
- `伤心` pinyin is `shāng xīn` (space); `堵车` is `dǔ chē` (space). Overlay keeps the book/JSON spacing.
- `阳光` is listed `adj.` “optimistic, cheerful” — 课文5 性格比较阳光. Lesson 9’s title 阳光总在风雨后 is the noun/metaphor; this overlay pins the adjective.
- `使` must not be taught off 课文3 大使馆 (substring). Overlay pins 使人的心情变得愉快.
- `堵` highlight also hits inside 堵车 on the pun line 心情也“堵”. That is the book’s joke.
- `窗` highlight also hits the 窗 in 窗户 on the 窗外 / 窗户 line.
- `有关` is 与……有关 in 课文5. A naive `includes("有关")` on later 没有关系 lines is a false friend — overlay stays on this lesson.
- No printed-page 补充生词 list to cross-check beyond `knownCharWords` (长期、窗、得到、堵、美、女性、有关).

## `exampleFor()` vs this overlay

`exampleFor()` takes the **shortest** book sentence containing the substring, across all 10 lessons. For Lesson 8 that often leaves this 课文:

| Word | `exampleFor()` risk | Overlay pins |
| --- | --- | --- |
| 使 | **大使馆** line (false substring) | 使人的心情变得愉快 |
| 心情 / 愉快 / 态度 / 只要 / 证明 / 亲戚 | shorter lines from later lessons | this lesson’s first 课文 |
| 阳光 | L9 title / 阳光总在风雨后 | 性格比较阳光 |
| 得到 | later 得到保证 / 得到了就很幸福 | 眼睛得到休息 |
| 美 | later 心里别提多美了 | 景色真美 |
| 堵 | every 堵车 line | 心情也“堵” |
| 窗 | L7 打开窗户 | 窗外是什么样子 |
| 有关 | 没有关系 (false substring) | 与她们的性格有关 |

伤心 / 使 / 心情 / 愉快 examples are the **sentence** inside the two-sentence 课文1 line that actually contains the words (still book text, not invented). 回忆 / 发生 / 成为 / 只要 / 耐心 / 长期 / 得到 are the same kind of split. 阳光 / 积极 / 特点 use the full 课文5 sentence.
