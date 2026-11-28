import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { contextWindow, CONTEXT_MAX } from '../src/lib/recallContext.ts'

const size = (text) => Array.from(text).filter((ch) => ch === '＿' || /\p{Script=Han}/u.test(ch)).length

test('a short sentence is shown whole, with its translation', () => {
  const line = contextWindow('快用纸＿＿。', 'Wipe it quickly with a tissue.')
  assert.deepEqual(line, { zh: '快用纸＿＿。', en: 'Wipe it quickly with a tissue.' })
})

test('a long text shows only the sentence that holds the blank, with its own translation', () => {
  const blank = '今天早上我在地铁站遇到了王静，她这次是来旅游的，我们聊了很久。她＿＿后就去上海工作了，现在过得很好。我们约好下次再见面。'
  const en = 'I met Wang Jing at the subway station this morning, and we talked for a long time. She went to work in Shanghai after graduating, and she is doing well. We agreed to meet again.'
  const line = contextWindow(blank, en)
  assert.equal(line.zh, '她＿＿后就去上海工作了，现在过得很好。')
  assert.equal(line.en, 'She went to work in Shanghai after graduating, and she is doing well.')
})

test('multi-sentence mismatched translation preserves the full translation instead of leaving a raw Chinese fragment', () => {
  const blank = '今天早上我在地铁站遇到了王静，她这次是来旅游的，我们聊了很久。她＿＿后就去上海工作了，现在过得很好。我们约好下次再见面。'
  const line = contextWindow(blank, 'One sentence only, with no way to match it.')
  assert.equal(line.zh, '她＿＿后就去上海工作了，现在过得很好。')
  assert.equal(line.en, 'One sentence only, with no way to match it.')
})

test('multi-sentence translation with extra English sentences aligns proportionally to the blanked Chinese sentence', () => {
  const blank = '今天早上我在地铁站遇到了王静，她这次是来旅游的，我们聊了很久。她＿＿后就去上海工作了，现在过得很好。我们约好下次再见面。'
  const en = 'I met Wang Jing at the subway station this morning. She came to travel, and we talked for a long time. She went to work in Shanghai after graduating, and she is doing well. We agreed to meet again next time.'
  const line = contextWindow(blank, en)
  assert.equal(line.zh, '她＿＿后就去上海工作了，现在过得很好。')
  assert.equal(line.en, 'She went to work in Shanghai after graduating, and she is doing well.')
})

test('one very long sentence is cut to the clauses around the blank, with ellipses while keeping its translation', () => {
  const blank = '一到节日，商场也会举办＿种各样的活动，降低价格，这个时候我们也可以买到又便宜又好的东西，大家都很开心。'
  const line = contextWindow(blank, 'On holidays the mall holds many kinds of events.')
  assert.ok(line.zh.includes('＿'))
  assert.ok(size(line.zh) <= CONTEXT_MAX)
  assert.ok(line.zh.startsWith('…') || line.zh.endsWith('…'))
  assert.equal(line.en, 'On holidays the mall holds many kinds of events.')
})

test('the blank always survives the cut', () => {
  const clause = '这是一个很长很长的句子'
  for (let before = 0; before < 6; before++) {
    for (let after = 0; after < 6; after++) {
      const blank = `${(clause + '，').repeat(before)}我想＿＿他，${(clause + '，').repeat(after)}好。`
      assert.ok(contextWindow(blank).zh.includes('＿'), `before=${before} after=${after}`)
    }
  }
})

test('every HSK word: the sentence never shows the answer, and the card stays readable', async () => {
  const http = createHttpServer()
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: { server: http } }, appType: 'custom' })
  try {
    const content = await server.ssrLoadModule('/src/lib/content.ts')
    let checked = 0
    for (const word of content.vocabIndex) {
      const blanked = content.blankedExample(word.zh)
      if (!blanked) continue
      checked++
      assert.ok(!blanked.blank.includes(word.zh), `${word.zh} is still visible: ${blanked.blank}`)
      const card = contextWindow(blanked.blank, blanked.en)
      assert.ok(card.zh.includes('＿'), `${word.zh} lost its blank`)
      assert.ok(size(card.zh) <= CONTEXT_MAX, `${word.zh} card is ${size(card.zh)} characters`)
    }
    assert.ok(checked > 300, `only ${checked} words have a sentence`)
  } finally {
    await server.close()
    http.close()
  }
})


function normalizeTestZh(text) {
  return String(text || '').replace(/[\s·\-—….,!?，。！？；：、（）()]/g, '')
}

function stripToneMarks(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ü/gi, 'v')
}

function hasToneMark(text) {
  return /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ]/.test(text)
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findLeaks(text, word) {
  if (!text) return []
  const leaks = []
  const rawZh = String(word.zh || '').trim()
  const baseZh = rawZh.replace(/[（(][^）)]*[）)]/g, '')
  const mergedZh = rawZh.replace(/[（()）]/g, '')
  const splitParts = rawZh
    .split(/[……·/]+/)
    .map((p) => p.replace(/[（()）]/g, '').trim())
    .filter((p) => Array.from(p).filter((c) => /\p{Script=Han}/u.test(c)).length >= 2)
  const variants = [...new Set([rawZh, baseZh, mergedZh, ...splitParts].filter(Boolean))]
  const coreHan = Array.from(normalizeTestZh(rawZh)).filter((ch) => /\p{Script=Han}/u.test(ch))

  for (const v of variants) {
    if (v && text.includes(v)) leaks.push(`hanzi:${v}`)
  }
  if (coreHan.length === 1 && text.includes(coreHan[0])) {
    leaks.push(`char:${coreHan[0]}`)
  }

  const py = String(word.pinyin || '').trim()
  if (py) {
    const syllables = py.split(/[\s·'-]+/).filter(Boolean)
    const compact = py.replace(/[\s·'-]+/g, '')
    for (const form of [py, compact, stripToneMarks(py), stripToneMarks(compact)]) {
      if (!form) continue
      const parenRe = new RegExp(`[（(]\\s*${escapeRegExp(form)}\\s*[)）]`, 'i')
      if (parenRe.test(text)) leaks.push(`paren-pinyin:${form}`)
    }
    const tonedForms = [py, compact, ...syllables].filter((f) => hasToneMark(f) && f.length >= 2)
    for (const tf of tonedForms) {
      const re = new RegExp(`(?<![A-Za-zÀ-ž])${escapeRegExp(tf)}(?![A-Za-zÀ-ž])`, 'i')
      if (re.test(text)) leaks.push(`toned-pinyin:${tf}`)
    }
    if (syllables.length > 0) {
      const numbered = syllables.map((s) => `${escapeRegExp(stripToneMarks(s))}[1-5]`).join('\\s*')
      if (new RegExp(`(?<![A-Za-z])${numbered}(?![A-Za-z])`, 'i').test(text)) {
        leaks.push(`numbered-pinyin:${py}`)
      }
    }
  }
  return [...new Set(leaks)]
}

test('all courses in en & id: zero Hanzi/Pinyin leakage, preserved sentence translations, and rich recall context', async () => {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  })
  try {
    const [
      { withLang },
      { lessons, teachableVocab, blankedExample, enrichVocab, corpusPeers },
      { jiaochengLessons, toVocab: jcToVocab, wordExample: jcWordExample },
      { kerjaChapters, toVocab: kjToVocab, wordExample: kjWordExample },
      { buildRecallPromptContext },
    ] = await Promise.all([
      server.ssrLoadModule('/src/lib/i18n.ts'),
      server.ssrLoadModule('/src/lib/content.ts'),
      server.ssrLoadModule('/src/lib/jiaocheng.ts'),
      server.ssrLoadModule('/src/lib/kerja.ts'),
      server.ssrLoadModule('/src/lib/recallContext.ts'),
    ])

    const peers = corpusPeers()

    for (const lang of ['id', 'en']) {
      await withLang(lang, () => {
        let checkedCount = 0
        const leaks = []
        const droppedTranslations = []
        const insufficientContext = []

        const verifyWord = (courseLabel, rawWord, lessonNum, fallbackExample) => {
          const word = enrichVocab(rawWord, lessonNum)
          const coreHanCount = Array.from(normalizeTestZh(word.zh)).filter((c) => /\p{Script=Han}/u.test(c)).length
          if (coreHanCount === 0) return

          let blanked = blankedExample(word.zh, lessonNum)
          if (!blanked && fallbackExample?.zh && fallbackExample.zh.includes(word.zh)) {
            blanked = {
              ...fallbackExample,
              blank: fallbackExample.zh.split(word.zh).join('＿'.repeat(coreHanCount)),
            }
          }

          const ctx = buildRecallPromptContext({ word, blanked, peers })
          checkedCount++

          const fieldsToCheck = [
            ['coreMeaning', ctx.coreMeaning],
            ['otherMeanings', ctx.otherMeanings],
            ['sentence.zh', ctx.sentence?.zh],
            ['sentence.en', ctx.sentence?.en],
            ['whenCue', ctx.whenCue],
            ['disambiguation', ctx.disambiguation],
          ]
          for (const [field, val] of fieldsToCheck) {
            const found = findLeaks(val, word)
            if (found.length > 0) {
              leaks.push(`${lang} ${courseLabel} ${word.zh} [${field}]: ${found.join(',')} -> ${val}`)
            }
          }

          if (blanked?.en?.trim() && ctx.sentence && !ctx.sentence.en?.trim()) {
            droppedTranslations.push(`${lang} ${courseLabel} ${word.zh}: ${blanked.zh} -> ${ctx.sentence.zh}`)
          }

          const isProper = word.pos?.includes('专名')
          if (!isProper && !ctx.sentence) {
            const hasContext = Boolean(ctx.whenCue || ctx.disambiguation || ctx.otherMeanings || ctx.posLabel)
            if (!hasContext) {
              insufficientContext.push(`${lang} ${courseLabel} ${word.zh} (${word.en})`)
            }
          }
        }

        for (const l of lessons) {
          for (const v of teachableVocab(l)) {
            verifyWord(`hsk4a-L${l.lesson}`, v, l.lesson, null)
          }
        }
        for (const l of jiaochengLessons) {
          for (const w of l.words) {
            verifyWord(`jiaocheng-L${l.lesson}`, jcToVocab(w), undefined, jcWordExample(w))
          }
        }
        for (const ch of kerjaChapters) {
          for (const w of ch.words) {
            verifyWord(`kerja-C${ch.chapter}`, kjToVocab(w), undefined, kjWordExample(w))
          }
        }

        assert.ok(checkedCount > 500, `Expected >500 corpus words checked for ${lang}, got ${checkedCount}`)
        assert.deepEqual(leaks, [], `Leaks found in ${lang}:\n${leaks.slice(0, 10).join('\n')}`)
        assert.deepEqual(
          droppedTranslations,
          [],
          `Dropped translations in ${lang}:\n${droppedTranslations.slice(0, 10).join('\n')}`,
        )
        assert.deepEqual(
          insufficientContext,
          [],
          `Words with no sentence or structural/usage context in ${lang}:\n${insufficientContext.slice(0, 10).join('\n')}`,
        )
      })
    }
  } finally {
    await server.close()
  }
})

test('sepasang / 对, confusing pairs, near-synonym feedback, and rendered recall/exercise/review UI', async () => {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  })
  try {
    const [
      { withLang },
      { lookup, blankedExample, enrichVocab, corpusPeers },
      { buildRecallPromptContext, nearSynonymFeedback },
      { composeRecognise, composeProduce },
      { WordRecall },
      { ExerciseView },
      { ReviewFlow },
      { StoreProvider, normalize },
    ] = await Promise.all([
      server.ssrLoadModule('/src/lib/i18n.ts'),
      server.ssrLoadModule('/src/lib/content.ts'),
      server.ssrLoadModule('/src/lib/recallContext.ts'),
      server.ssrLoadModule('/src/lib/exercises.ts'),
      server.ssrLoadModule('/src/components/WordRecall.tsx'),
      server.ssrLoadModule('/src/components/Exercises.tsx'),
      server.ssrLoadModule('/src/screens/Review.tsx'),
      server.ssrLoadModule('/src/store/store.tsx'),
      server.ssrLoadModule('/src/lib/jiaocheng.ts'),
      server.ssrLoadModule('/src/lib/kerja.ts'),
    ])
    const peers = corpusPeers()

    // 1. "sepasang" / 对 classifier context & disambiguation in id & en
    const duiBase = enrichVocab(lookup('对') ?? { zh: '对', pinyin: 'duì', en: 'pair; couple', pos: 'm.' })
    const duiBlanked = blankedExample('对')
    assert.ok(duiBlanked, 'Expected blanked example for 对')

    withLang('id', () => {
      const ctx = buildRecallPromptContext({ word: duiBase, blanked: duiBlanked, peers })
      assert.equal(ctx.posLabel, 'Kata bantu bilangan')
      assert.equal(ctx.charCount, 1)
      assert.equal(ctx.charCountLabel, '1 karakter')
      assert.equal(ctx.slots, '＿')
      assert.ok(ctx.sentence?.zh.includes('＿'))
      assert.ok(ctx.sentence?.en && ctx.sentence.en.length > 0)
      assert.ok(ctx.disambiguation, 'Expected synonym disambiguation for 对 vs 双 / 副')
      assert.equal(ctx.disambiguation.includes('对'), false)
      assert.equal(/duì/i.test(ctx.disambiguation), false)
    })

    withLang('en', () => {
      const ctx = buildRecallPromptContext({ word: duiBase, blanked: duiBlanked, peers })
      assert.equal(ctx.posLabel, 'Classifier')
      assert.equal(ctx.charCount, 1)
      assert.equal(ctx.charCountLabel, '1 character')
      assert.equal(ctx.slots, '＿')
      assert.ok(ctx.disambiguation)
      assert.equal(ctx.disambiguation.includes('对'), false)
      assert.equal(/duì/i.test(ctx.disambiguation), false)
    })

    // Other notoriously confusing pairs present in the corpus
    for (const [targetZh, expectedSub] of [
      ['刚', '刚才'],
      ['或者', '还是'],
      ['双', '对'],
      ['俩', '两'],
    ]) {
      const foundWord = lookup(targetZh)
      assert.ok(foundWord, `Expected corpus entry for ${targetZh}`)
      const w = enrichVocab(foundWord)
      const b = blankedExample(targetZh)
      withLang('id', () => {
        const ctx = buildRecallPromptContext({ word: w, blanked: b, peers })
        assert.ok(ctx.disambiguation, `Expected disambiguation for ${targetZh}`)
        assert.equal(ctx.disambiguation.includes(targetZh), false)
        assert.ok(ctx.disambiguation.includes(expectedSub) || ctx.posLabel.length > 0)
      })
    }

    // 2. Empathetic near-synonym feedback without answer leaks
    withLang('id', () => {
      const duiShuang = nearSynonymFeedback('双', duiBase, peers)
      assert.ok(duiShuang, 'Expected nearSynonymFeedback when typing 双 for 对')
      assert.equal(duiShuang.typedZh, '双')
      assert.equal(duiShuang.message.includes('对'), false)
      assert.equal(/duì/i.test(duiShuang.message), false)

      const duiFu = nearSynonymFeedback('副', duiBase, peers)
      assert.ok(duiFu, 'Expected nearSynonymFeedback when typing 副 for 对')
      assert.equal(duiFu.message.includes('对'), false)

      const gang = enrichVocab(lookup('刚') ?? { zh: '刚', pinyin: 'gāng', en: 'just now', pos: '副词' })
      const gangGangcai = nearSynonymFeedback('刚才', gang, peers)
      assert.ok(gangGangcai, 'Expected nearSynonymFeedback when typing 刚才 for 刚')
      assert.equal(gangGangcai.message.includes('刚'), false, 'Shared-char guard must prevent 刚才 from leaking 刚')
      assert.equal(/gāng/i.test(gangGangcai.message), false)

      const haishi = enrichVocab(lookup('还是') ?? { zh: '还是', pinyin: 'háishì', en: 'or (in a question)', pos: '连词' })
      const haishiHuozhe = nearSynonymFeedback('或者', haishi, peers)
      assert.ok(haishiHuozhe, 'Expected nearSynonymFeedback when typing 或者 for 还是')
      assert.equal(haishiHuozhe.message.includes('还是'), false)

      const unrelated = nearSynonymFeedback('电脑', duiBase, peers)
      assert.equal(unrelated, null)
    })

    // 3. Rendered UI checks via React SSR (WordRecall, ExerciseView, ReviewFlow) in Indonesian
    const initial = normalize(undefined)
    withLang('id', () => {
      const recallHtml = renderToStaticMarkup(
        createElement(
          StoreProvider,
          { initial },
          createElement(WordRecall, {
            word: duiBase,
            n: 1,
            of: 4,
            cue: 'meaning',
            onAttempt: () => {},
            onComplete: () => {},
          }),
        ),
      )
      assert.match(recallHtml, /Kata bantu bilangan/)
      assert.match(recallHtml, /1 karakter/)
      assert.match(recallHtml, /recall-slots-preview/)
      assert.doesNotMatch(recallHtml, /recall-context-translation/)
      assert.doesNotMatch(recallHtml, /recall-sentence-translation/)
      assert.match(recallHtml, /recall-disambiguation/)
      assert.doesNotMatch(recallHtml, /对|duì/i)

      const reviewHtml = renderToStaticMarkup(
        createElement(
          StoreProvider,
          { initial },
          createElement(ReviewFlow, {
            words: ['对'],
            onClose: () => {},
          }),
        ),
      )
      assert.match(reviewHtml, /Kata bantu bilangan/)
      assert.match(reviewHtml, /1 karakter/)
      assert.match(reviewHtml, /focus-meta-pills/)
      assert.doesNotMatch(reviewHtml, /focus-sentence-translation/)
      assert.match(reviewHtml, /focus-check-icon-btn/)
      assert.doesNotMatch(reviewHtml, /对|duì/i)

      const exCtx = { pool: peers, segment: (zh) => Array.from(zh), seed: 'recall-test' }
      const huozhe = enrichVocab(lookup('或者'))
      const buildSteps = composeProduce([huozhe], exCtx, false)
      const charBuildStep = buildSteps.find((s) => s.exercise.kind === 'char-build')
      assert.ok(charBuildStep, 'Expected a char-build step for 或者')
      const buildHtml = renderToStaticMarkup(
        createElement(
          StoreProvider,
          { initial },
          createElement(ExerciseView, {
            step: charBuildStep,
            attemptKey: 'cb-1',
            onRecord: () => {},
            onDone: () => {},
          }),
        ),
      )
      assert.match(buildHtml, /2 karakter/)
      assert.match(buildHtml, /duo-meta-pills/)
      assert.doesNotMatch(buildHtml, /或者|huòzhě/i)

      const duiChoices = [
        duiBase,
        enrichVocab(lookup('双') ?? { zh: '双', pinyin: 'shuāng', en: 'pair', pos: 'm.' }),
        enrichVocab(lookup('副') ?? { zh: '副', pinyin: 'fù', en: 'set; pair', pos: 'm.' }),
        enrichVocab(lookup('法律')),
      ]
      const pickSteps = composeRecognise(duiChoices, exCtx)
      const templatePick = pickSteps.find((s) => s.exercise.kind === 'hanzi-pick')
      assert.ok(templatePick, 'Expected a hanzi-pick exercise in composeRecognise output')
      const hanziPickStep = {
        ...templatePick,
        exercise: {
          ...templatePick.exercise,
          word: duiBase,
          choices: duiChoices,
        },
      }
      const pickHtml = renderToStaticMarkup(
        createElement(
          StoreProvider,
          { initial },
          createElement(ExerciseView, {
            step: hanziPickStep,
            attemptKey: 'hp-1',
            onRecord: () => {},
            onDone: () => {},
          }),
        ),
      )
      assert.match(pickHtml, /Kata bantu bilangan/)
      assert.match(pickHtml, /1 karakter/)
      assert.doesNotMatch(pickHtml, /duì/i)
      const promptWithoutButtons = pickHtml.replace(/<button[\s\S]*?<\/button>/g, '')
      assert.doesNotMatch(promptWithoutButtons, /对/)
    })
  } finally {
    await server.close()
  }
})
