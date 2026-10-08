# Grammar checker

A free, offline checker for the Mandarin a learner writes or says. No model, no API key, no server, nothing
leaves the device. It lives in `src/lib/grammar/` and is pure TypeScript.

## What it is, and what it is not

It does not understand a sentence. It looks for a fixed set of mistakes that learners make over and over, each
written as a **typed rule**, and says nothing about anything else.

- A **finding** is reliable feedback: this exact shape is wrong, here is the fix, here is why.
- **"No known mistakes"** only means none of the rules matched. It is **never** reported as "correct". The
  interface says how many patterns were checked and that a clean result is not proof.
- It cannot tell you whether a sentence means what you meant, sounds natural, or fits the situation.
  An AI reviewer could. This trades that reach for being free, instant, private, deterministic and testable.

## Severity

| Severity | Meaning | Effect |
| --- | --- | --- |
| `error` | Wrong in standard Mandarin and on the HSK | Counts against the sentence; its fix is written into the corrected sentence |
| `check` | Usually wrong, but it depends on what was meant or on register | Shown as "worth a second look"; never fails a task; its fix is offered, not applied |

## The rules

`RULE_IDS` in `types.ts` is the list (`CORE_RULE_IDS` plus `TRANSFER_RULE_IDS`). `createRules` in `rules.ts` returns a
`RuleSet`, a mapped type over `RuleId`, so adding an id without a rule, or a rule without an id, does not compile.

| Rule | Catches | Example |
| --- | --- | --- |
| `place-after-verb` | place after an action verb | 我学习在图书馆 → 我在图书馆学习 |
| `time-after-verb` | time word at the end | 我去北京明天 → 我明天去北京 (check) |
| `hen-after-adj` | degree word after the adjective | 他高很 → 他很高 |
| `degree-after-verb` | degree word after a feeling verb | 我喜欢很 → 我很喜欢 |
| `bi-hen` | 很 in a 比 sentence | 他比我很高 → 他比我高 |
| `bi-bu` | 比 … 不 + adjective | 他比我不高 (check, reword) |
| `shi-adj` | 是 before a bare adjective | 我是饿 → 我很饿 |
| `shi-age` | 是 before an age | 我是二十岁 → 我二十岁 (check) |
| `meiyou-le` | 没(有) + verb + 了 | 我昨天没吃饭了 → 我昨天没吃饭 |
| `negation-choice` | 不有, 没是, 不 + verb + 过 | 我不有钱 → 我没有钱 |
| `you-guo` | 有 + verb + 过 | 我有去过北京 → 我去过北京 (check) |
| `ma-question-double` | A-not-A together with 吗 | 你是不是学生吗 → 你是不是学生 |
| `question-or` | 或者 in a choice question | 你喝茶或者咖啡？ → 还是 (check) |
| `er-liang` | 二 before a measure word | 二个朋友 → 两个朋友 |
| `men-plural` | number + noun + 们 | 三个学生们 → 三个学生 |
| `measure-word` | 个 with a noun that has its own | 一个书 → 一本书 |
| `de-for-de` | 的 for 得 after a verb | 他跑的很快 → 他跑得很快 |
| `verb-object-de` | verb + object + 得 without repeating the verb | 说汉语得很好 → 说汉语说得很好 |
| `repeated-word` | a function word typed twice | 我的的书 → 我的书 |
| `zai-zai` | 再 for 在, 在见 for 再见 | 我再家学习 → 我在家学习 |
| `degree-stack` | 很 with 有点 | 我很有点累 → 我有点累 |
| `ba-bare-verb` | 把 + object + bare verb | 你把书看 (check, reword) |
| `conjunction-pair` | 虽然 … 所以, 因为 … 但是 | 虽然他很累，所以他去了 (check) |

### Mistakes that come from translating word for word

Ten more rules (`rules-transfer.ts`) target what an Indonesian or English speaker writes when each word is carried
over in the same order. The explanations name the Indonesian habit, so the learner sees why it feels natural.

| Rule | Catches | Example |
| --- | --- | --- |
| `date-order` | day-month-year | 8号10月2026年 → 2026年10月8号 |
| `together-after-verb` | 一起 left at the end ("bersama") | 我们去北京一起 → 我们一起去北京 |
| `de-missing` | no 得 before how well or how fast | 他跑很快 → 他跑得很快 |
| `ganxingqu-order` | 感兴趣 with the topic after it, no 对 | 我感兴趣中文 → 我对中文感兴趣 |
| `double-degree` | two degree words | 我很非常高兴 → 我非常高兴 |
| `place-li` | 里 after a city or country | 在北京里工作 → 在北京工作 |
| `adverb-after-verb` | 也 or 都 after the verb | 我去也 → 我也去 |
| `bu-shi-missing` | 不 before a noun, no 是 ("bukan") | 我不学生 → 我不是学生 |
| `bi-order` | the comparison put last | 我高比他 → 我比他高 |
| `measure-missing` | number straight onto the noun | 我有三书 → 我有三本书 |

`time-after-verb` also covers questions about time (你去什么时候 → 你什么时候去, an `error`) and habits such as 每天
and 经常 at the end of the sentence (a `check`).

## How a rule stays precise

False alarms are worse than silence for a learner, so each rule is narrow on purpose:

- It matches closed word lists (`tables.ts`), not "any verb". A word goes on a list only when the mistake is
  unambiguous for it. 住在 and 放在 are correct, so 住 and 放 are not in the `place-after-verb` list.
- A single-character verb only counts after a pronoun or an adverb, so 同学在家 is never read as 学 + 在家.
- Valid look-alikes are excluded by name: 比如, 比较, 不过, 只有看过, 没有了, 好得很, 他不是很高.
- The course vocabulary adds adjectives (`lexiconFrom`), only words whose part of speech is exactly "adj.", so a
  noun is never taken for an adjective.

## How it is tested

`tests/grammar-check.test.mjs`:

1. **Every rule has at least three mistakes** with the exact fixed sentence, and the fixed sentence must itself be clean.
2. **Every rule has correct look-alikes** that it must not flag.
3. **Zero false positives over the whole course**: every Chinese sentence in `src/data` (about 3,900) is correct
   Mandarin, so the checker must report nothing on any of them. (Scanning every Chinese string in the data, not only
   sentences, also reports only the book's own "avoid" examples.)
4. A list of natural HSK 3-4 sentences that must stay clean.

Adding a rule means adding its examples there first. Widening a word list means adding a look-alike that it must
not flag. The corpus test is the guard against a rule that fires on good Chinese.

Limits of that evidence: the corpus is textbook Chinese. It shows the rules do not fire on correct sentences in
that register. It does not show they never fire on a correct learner sentence of a different shape.

## Where it is used

- **Make it yours** (`HskComposition`): the grammar line of the checklist is live while typing. Pressing
  "Check my sentences" opens the explanations, the fixed sentence and credits the practice.
- **Reply and sentence practice** (`assessProduction`): the book's sentence is confirmed. A different wording gets
  the classifier's findings as feedback, and stays `practice` evidence, never graded.

## Adding a rule

1. Add the id to `RULE_IDS` (`types.ts`). The compiler now fails until a rule exists.
2. Write the rule in `rules.ts`: a regex over a closed table in `tables.ts`, a `Hit` with the span, the fix (or
   `null` when the learner has to reword), the pattern to keep, and why. Every learner-facing string goes through `t()`.
3. Add an entry per string to `src/i18n/id/grammar.ts`.
4. Add the examples and look-alikes to `MISTAKES` in the test, then run the corpus test.
