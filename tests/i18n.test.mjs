import test from 'node:test'
import assert from 'node:assert/strict'
import { getLang, t, withLang } from '../src/lib/i18n.ts'
import { applyOverlay, extractStrings, hashOf } from '../src/lib/localize.ts'

test('English is the source text and fills placeholders', () => {
  assert.equal(getLang(), 'en')
  assert.equal(t('Next'), 'Next')
  assert.equal(t('Recall · {n} of {of}', { n: 2, of: 5 }), 'Recall · 2 of 5')
  assert.equal(t('Keep {missing}', { n: 1 }), 'Keep {missing}', 'an unknown placeholder is left visible, not erased')
})

test('a string with no Indonesian entry shows the English, never a blank', () => {
  withLang('id', () => assert.equal(t('This sentence has no translation entry yet'), 'This sentence has no translation entry yet'))
})

test('content overlays replace only strings that still match what they were written against', () => {
  const source = { lessons: [{ vocab: [{ zh: '法律', en: 'law' }, { zh: '班', en: 'class' }] }] }
  const found = extractStrings(source, (_path, key) => key === 'en')
  assert.deepEqual(found.map((entry) => entry.path), ['lessons.0.vocab.0.en', 'lessons.0.vocab.1.en'])
  const overlay = {
    'lessons.0.vocab.0.en': [hashOf('law'), 'hukum'],
    'lessons.0.vocab.1.en': [hashOf('a different source'), 'kelas'],
    'lessons.0.vocab.9.en': [hashOf('gone'), 'hilang'],
  }
  const result = applyOverlay(source, overlay)
  assert.equal(source.lessons[0].vocab[0].en, 'hukum')
  assert.equal(source.lessons[0].vocab[1].en, 'class', 'a changed source keeps its English')
  assert.equal(result.applied, 1)
  assert.deepEqual(result.stale, ['lessons.0.vocab.1.en', 'lessons.0.vocab.9.en'])
})
