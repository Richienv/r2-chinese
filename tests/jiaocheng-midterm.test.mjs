import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  availableGrammarTags,
  buildExamPaper,
  buildHsk4Exam,
  buildJiaochengMidterm,
  partPoints,
} from '../src/lib/jiaochengMidterm.ts'
import { createEmptyGraph, recordExamOutcome } from '../src/lib/learnerGraph.ts'

const paper = buildJiaochengMidterm()

test('lessons 1 to 12 each have a textbook fill-in section', () => {
  const fillLessons = paper.filter((part) => part.kind === 'blanks').map((part) => part.lesson)
  for (let lesson = 1; lesson <= 12; lesson++) {
    if (lesson === 5) continue
    assert.ok(fillLessons.includes(lesson), `lesson ${lesson}`)
  }
  assert.ok(paper.some((part) => part.kind === 'choice' && part.lesson === 5))
})

test('every blank answer is one of the printed word-bank words', () => {
  for (const part of paper) {
    if (part.kind !== 'blanks') continue
    const marks = [...part.lines.join('\n').matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]))
    assert.deepEqual(marks, part.blanks.map((blank) => blank.n))
    for (const blank of part.blanks) assert.ok(part.bank.includes(blank.answer), `${part.id} ${blank.n}`)
    assert.equal(partPoints(part), part.blanks.length)
  }
})

test('single-choice answers are one of the options', () => {
  const choices = paper.filter((part) => part.kind === 'choice')
  assert.ok(choices.length >= 6)
  for (const part of choices) {
    assert.ok(part.options.includes(part.answer))
    assert.equal(partPoints(part), 1)
  }
})

function assertValidPart(part) {
  assert.ok(part.id && part.title && part.sectionZh, `missing metadata on ${part.id}`)
  assert.ok(part.breakdown, `missing breakdown on ${part.id}`)
  assert.ok(part.breakdown.pattern.trim().length > 0, `${part.id}: empty pattern`)
  assert.ok(part.breakdown.grammarTag.trim().length > 0, `${part.id}: empty grammarTag`)
  assert.ok(part.breakdown.whyRight.en.trim().length > 0, `${part.id}: empty whyRight.en`)
  assert.ok(part.breakdown.whyRight.id.trim().length > 0, `${part.id}: empty whyRight.id`)
  assert.notEqual(
    part.breakdown.whyRight.en.trim(),
    part.breakdown.whyRight.id.trim(),
    `${part.id}: Indonesian whyRight must differ from English`,
  )
  assert.ok(part.breakdown.distractorNotes.length >= 1, `${part.id}: expected distractor notes`)
  for (const note of part.breakdown.distractorNotes) {
    assert.ok(note.option.trim().length > 0, `${part.id}: empty distractor option`)
    assert.ok(note.whyWrong.en.trim().length > 0, `${part.id}: empty distractor whyWrong.en`)
    assert.ok(note.whyWrong.id.trim().length > 0, `${part.id}: empty distractor whyWrong.id`)
  }

  if (part.kind === 'blanks') {
    const marks = [...part.lines.join('\n').matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]))
    assert.deepEqual(marks, part.blanks.map((b) => b.n), `${part.id}: blank markers mismatch`)
    for (const b of part.blanks) {
      assert.ok(part.bank.includes(b.answer), `${part.id}: bank missing answer ${b.answer}`)
    }
    assert.equal(partPoints(part), part.blanks.length)
  } else if (part.kind === 'choice') {
    assert.ok(part.options.length >= 2, `${part.id}: too few options`)
    assert.equal(new Set(part.options).size, part.options.length, `${part.id}: duplicate options`)
    assert.ok(part.options.includes(part.answer), `${part.id}: answer not in options`)
    assert.ok(part.why.trim().length > 0, `${part.id}: empty why`)
    assert.equal(partPoints(part), 1)
  } else if (part.kind === 'order') {
    assert.ok(part.chunks.length >= 2, `${part.id}: too few chunks`)
    assert.equal(part.answerOrder.join(''), part.answer, `${part.id}: answerOrder does not join to answer`)
    assert.deepEqual(
      [...part.chunks].sort(),
      [...part.answerOrder].sort(),
      `${part.id}: chunks must be exact permutation of answerOrder`,
    )
    assert.equal(partPoints(part), 1)
  } else if (part.kind === 'error') {
    assert.ok(part.faultySentence.trim().length > 0, `${part.id}: empty faultySentence`)
    assert.ok(part.errorFocus.trim().length > 0, `${part.id}: empty errorFocus`)
    assert.ok(part.options.length >= 2 && part.options.includes(part.answer), `${part.id}: invalid error options`)
    assert.equal(partPoints(part), 1)
  } else if (part.kind === 'reading') {
    assert.ok(part.passage.trim().length > 0, `${part.id}: empty passage`)
    assert.ok(part.question.trim().length > 0, `${part.id}: empty question`)
    assert.ok(part.options.length >= 2 && part.options.includes(part.answer), `${part.id}: invalid reading options`)
    assert.equal(partPoints(part), 1)
  } else {
    assert.fail(`unexpected kind on ${part.id}`)
  }
}

test('Jiaocheng Midterm & Final covers Lessons 1-25 across all 5 question formats with EN/ID breakdowns', () => {
  const jc = buildJiaochengMidterm()
  assert.ok(jc.some((p) => p.lesson >= 13), 'covers Part 2-2 lessons 13+')
  assert.ok(jc.some((p) => p.lesson >= 18), 'covers later Part 2-2 final lessons 18+')
  const kinds = new Set(jc.map((p) => p.kind))
  for (const kind of ['blanks', 'choice', 'order', 'error', 'reading']) {
    assert.ok(kinds.has(kind), `jiaocheng missing kind ${kind}`)
  }
  for (const part of jc) assertValidPart(part)
})

test('HSK 4 Exam bank covers L1-10 and all 5 question formats with valid EN/ID breakdowns', () => {
  const hsk = buildHsk4Exam()
  assert.ok(hsk.length >= 12)
  const kinds = new Set(hsk.map((p) => p.kind))
  for (const kind of ['blanks', 'choice', 'order', 'error', 'reading']) {
    assert.ok(kinds.has(kind), `hsk4a missing kind ${kind}`)
  }
  for (const part of hsk) {
    assert.equal(part.course, 'hsk4a')
    assertValidPart(part)
  }
})

test('buildExamPaper supports mixed mode, grammar focus filtering, and graph weakness prioritization', () => {
  const tags = availableGrammarTags('mixed')
  assert.ok(tags.length >= 8)

  const mixedMock = buildExamPaper({ course: 'mixed', mode: 'mock' })
  assert.ok(mixedMock.some((p) => p.course === 'jiaocheng'))
  assert.ok(mixedMock.some((p) => p.course === 'hsk4a'))

  const targetTag = tags[tags.length - 1]
  const focused = buildExamPaper({ course: 'mixed', mode: 'grammar', focusTag: targetTag })
  assert.ok(focused.length >= 1)
  for (const p of focused) assert.equal(p.breakdown.grammarTag, targetTag)

  // Graph weakness boosts matching grammarTag to the top in grammar drill mode
  let g = createEmptyGraph(1000)
  g = recordExamOutcome(g, {
    questionId: 'seed-weak-tag',
    course: 'mixed',
    grammarPoint: targetTag,
    correct: false,
    at: 2000,
  })
  const prioritized = buildExamPaper({ course: 'mixed', mode: 'grammar', graph: g })
  assert.equal(prioritized[0].breakdown.grammarTag, targetTag)
})

test('JiaochengMidterm UI & HskPracticeEntry render cleanly across all 5 question types for hsk4a and jiaocheng', async () => {
  const transport = createHttpServer()
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: { server: transport } },
    appType: 'custom',
  })
  try {
    const [
      { withLang },
      { JiaochengMidterm, ExamPartCard },
      { HskPracticeEntry },
      { StoreProvider, normalize },
    ] = await Promise.all([
      server.ssrLoadModule('/src/lib/i18n.ts'),
      server.ssrLoadModule('/src/screens/JiaochengMidterm.tsx'),
      server.ssrLoadModule('/src/components/HskPracticeEntry.tsx'),
      server.ssrLoadModule('/src/store/store.tsx'),
    ])
    const initial = normalize(undefined)

    withLang('id', () => {
      // 1. Practice entry buttons for Exam & Grammar Drill
      const entryHtml = renderToStaticMarkup(
        createElement(
          StoreProvider,
          { initial },
          createElement(HskPracticeEntry, {
            onListen: () => {},
            onCompose: () => {},
            onExam: () => {},
          }),
        ),
      )
      assert.match(entryHtml, /hsk-practice-door-exam/)
      assert.match(entryHtml, /hsk-practice-door-grammar/)

      // 2. Clean overlay structure: compact header + Atur button + progress bar + sticky footer + collapsed setup panel
      for (const [course, expectedTitle] of [
        ['hsk4a', 'Tryout HSK 4'],
        ['jiaocheng', 'Tryout Jiaocheng'],
        ['mixed', 'Final Campuran'],
      ]) {
        const html = renderToStaticMarkup(
          createElement(
            StoreProvider,
            { initial },
            createElement(JiaochengMidterm, {
              initialCourse: course,
              onClose: () => {},
            }),
          ),
        )
        assert.ok(html.includes(expectedTitle), `Expected concise title ${expectedTitle}`)
        assert.match(html, /jiaocheng-midterm-setup-btn[^>]*aria-expanded="false"[^>]*>Atur</)
        assert.match(html, /jiaocheng-midterm-progress/)
        assert.doesNotMatch(html, /jiaocheng-midterm-dots/)
        assert.doesNotMatch(html, /id="exam-setup-panel"/)
        assert.match(html, /jiaocheng-midterm-foot/)
      }

      // 3. Render all 5 question types for both hsk4a and jiaocheng (both unchecked and checked breakdown)
      for (const [courseName, parts] of [
        ['hsk4a', buildHsk4Exam()],
        ['jiaocheng', buildJiaochengMidterm()],
      ]) {
        for (const kind of ['blanks', 'choice', 'order', 'error', 'reading']) {
          const sample = parts.find((p) => p.kind === kind)
          assert.ok(sample, `Missing ${kind} in ${courseName}`)
          const uncheckedHtml = renderToStaticMarkup(
            createElement(ExamPartCard, { part: sample, checked: false }),
          )
          assert.match(uncheckedHtml, /jiaocheng-midterm-card/)
          assert.ok(uncheckedHtml.includes(sample.title), `Expected title for ${courseName}:${kind}`)

          const checkedHtml = renderToStaticMarkup(
            createElement(ExamPartCard, {
              part: sample,
              checked: true,
              picked: 'answer' in sample ? sample.answer : undefined,
              score: partPoints(sample),
            }),
          )
          assert.match(checkedHtml, /jiaocheng-midterm-reveal/)
          assert.match(checkedHtml, /jiaocheng-midterm-breakdown/)
        }
      }
    })
  } finally {
    await server.close()
    transport.close()
  }
})
