# Lesson 1 gaps — 简单的爱情

Confirmed from `src/data/hsk4a.json` (no PDF or book extract in the repo).

- **Title:** 简单的爱情 / Jiǎndān de àiqíng / Simple Love (contents page: “Simple love”, p. 2)
- **Overlay written:** 37/37 `lessons[0].vocab` entries in `lesson-01.json` (32 teachable 生词 + 2 补充生词 + 5 专有名词). 37 examples.

## Sitting map (`attachVocab` + `TEXT_WORD_CAP = 10`)

No overflow this lesson. Every 课文 bucket is 6–7 words, so nothing is spliced onto 课文5.

| Sitting | Words attached | Cap drop? |
| --- | --- | --- |
| 课文1 | 法律、俩、印象、深、熟悉、不仅、性格 (7) | no |
| 课文2 | 开玩笑、从来、最好、共同、适合、幸福 (6) | no |
| 课文3 | 生活、刚、浪漫、够、缺点、接受 (6) | no |
| 课文4 | 羡慕、爱情、星星、即使、加班、亮、感动 (7) | no |
| 课文5 | 自然、原因、互相、吸引、幽默、脾气 (6) | no |

### Words the sitting currently drops

`teachableVocab` skips empty glosses and `/proper|pr\.n/i`. Lesson 1 drops all five 专有名词 — they never get meet/hook/example/seal:

- 孙月、王静、李进、李、高

补充生词 星星 and 亮 are tagged `supra` in the index and **are** taught (课文4). They are not dropped.

## Book / index content the app does not teach

These sit in `hsk4a.json` but are not 生词 overlays and are not a Words-path sitting.

### 热身 (2) — unused in `buildSteps`

1. Match six romantic-film titles to posters A–F (西雅图未眠夜, 诺丁山, 当男人爱上女人, 罗马假日, 罗密欧与朱丽叶, 泰坦尼克号).
2. Ideal-partner checkbox table (身高 / 体重 / 头发 / 眼睛 / 性格 / 爱好).

### 课文 headings the JSON left blank

- 课文4 and 课文5 are passages with `heading_zh` / `heading_en` empty. Dialogues 1–3 have titles. The app’s `sittingHint` therefore falls back to the first attached word (羡慕 / 自然), not a book title. No extra 课文 **lines** are missing versus the JSON (课文1–3: 6+6+6; 课文4: 7; 课文5: 6).

### 语言点 (5) — in the JSON and in each sitting’s grammar note, not in this overlay

1. 不仅……也/还/而且……
2. 从来
3. 刚
4. 即使……也……
5. (在)……上

Not missing from the app’s wrap/sitting notes. Missing from *this* file by design (vocab-only).

### 整理 extras — in wrap, not in this overlay

- 比一比：刚 — 刚才
- 同字词：感 → 感到、感动、感冒、感兴趣 (4 example sentences)
- 文化：中国的情人节——七夕节 / Qixi Festival
- 练习：13 prompt strings (课文问答, 练一练 × 语言点, 刚/刚才 选词, 复述, 选词填空, 感到/感动/感冒/感兴趣, 双人/小组运用). PORTING.md still lists book exercises as deferred — stored, not playable.

### Known-character words (index only, not in `lesson.vocab`)

`vocabIndex` lesson 1 has **41** rows vs **37** lesson 生词. The extra four are `known-char` and appear in 课文 but are never taught as 生词:

| Word | In 课文 | Note |
| --- | --- | --- |
| 变 | 课文4 慢慢变老; 课文5 变得很有意思 | related 改变 |
| 普通 | 课文5 即使是很普通的事情 | related 普通话 |
| 新鲜感 | 课文3 只有浪漫和新鲜感是不够的 | related 新鲜、感觉 |
| 祝 | 课文2 祝你们幸福！ | related 祝贺 |

`data.supplementary` has no Lesson 1 * 补充生词 pair (星星 / 亮 live under `supraWords` + lesson vocab notes).

## JSON vs printed 标准教程 HSK 4上 (no PDF in repo)

Inferred from contents notes + typical 4上 L1 list. Nothing in `lesson.vocab` looks skipped relative to the usual 30 生词 + 2 *补充 + 5 专有名词 set.

Likely book material the JSON never extracted:

- Per-word 例句 printed next to each 生词 (vocab objects have no `example` field).
- 课文4 / 课文5 titles (if the book labels the two passages).
- Warm-up poster art and the checkbox grid as UI.
- Full 李老师 / 高老师 as name entries (book lists family names 李, 高 only).
- Audio.

Small gloss drift (left as-is; `hsk4a.json` was not edited):

- 熟悉 pinyin `shúxi` (book usually `shúxī`).
- 开玩笑 `pos` is empty.
- 幸福 listed `adj.` only; 课文2 祝你们幸福 is noun-like.
- 自然 listed `adv.` only (课文5 很自然地); book often 形/副.
- 幽默 English “humourous”.

## `exampleFor()` vs this overlay

`exampleFor()` takes the **shortest** book sentence containing the substring, across all 10 lessons. For Lesson 1 that often leaves this 课文:

| Word | `exampleFor()` currently | Overlay pins |
| --- | --- | --- |
| 俩 / 性格 | 姐妹俩性格差不多 (later lesson) | 课文1 |
| 印象 / 深 / 熟悉 / 生活 / 刚 / 够 / 接受 / 原因 / 开玩笑 | shorter lines from later lessons or 语言点 | this lesson’s 课文 |
| 幸福 | 什么是幸福？ (L10) | 祝你们幸福！ |
| 浪漫 | 那什么是浪漫呢？ (课文4, OK-ish) | 课文3 只有浪漫和新鲜感是不够的 (first 生词 sitting) |
| 即使 | 课文5 即使是很普通的事情… | 课文4 即使晚上加班… (语言点 + first hit) |
| 亮 | **月亮** line (false substring) | 亮着灯 |
| 高 | **高兴** line (false substring) | 课文3 heading 高老师… |
| 李 | 李老师差不多六十岁了 (later) | 课文2 李老师，我下个月… |
| 孙月 | **null** (name never in `line.zh`) | 课文1 heading |
| 王静 | later-lesson 王静，好久不见了！ | 课文2 heading |

Because 孙月 / 王静 have no `line.zh` hit, today’s teach path would skip the example beat (`example ? 4 phases : 3`) even if they were not already dropped by `teachableVocab`.

## Overlay flags (closest book line, not a 课文 `lines[]` sentence)

Pinyin for these three headings is reconstructed; JSON headings have English but no pinyin.

- **孙月** — 课文1 `heading_zh`「孙月和王静聊王静的男朋友」
- **王静** — 课文2 `heading_zh`「王静跟李老师聊她要结婚的事情」
- **高** — 课文3 `heading_zh`「高老师和李老师聊结婚后的生活」(no 课文 line contains surname 高)

适合 / 幸福 / 生活 / 刚 / 接受 examples are the **sentence** inside a two-sentence 课文 line that actually contains the word (still book text, not invented).
