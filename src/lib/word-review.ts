import { normalizeChinese } from './production.ts'
import { buildReview, type Review, type ReviewCheck } from './review.ts'
import { t } from './i18n.ts'

const HANZI = /^[㐀-鿿]$/u

/**
 * Check a typed word against the lesson word, requirement by requirement, without
 * printing the answer: the learner is told which characters are wrong, not what they are.
 */
export function reviewTypedWord(task: string, typed: string, expected: string): Review {
  const wanted = Array.from(normalizeChinese(expected))
  const given = Array.from(normalizeChinese(typed))
  const checks: ReviewCheck[] = []
  const allHanzi = given.length > 0 && given.every((character) => HANZI.test(character))
  checks.push({
    id: 'hanzi', stage: 'instruction', decisive: true, label: t('Answered in Chinese characters'),
    status: allHanzi ? 'pass' : 'fail',
    found: given.length ? typed.trim() : t('Nothing typed'), expected: 'Hanzi',
    fix: given.length ? t('Type the Hanzi ({hanzi}), not pinyin or English.', { hanzi: '汉字' }) : t('Type the word before checking.'),
  })
  if (!allHanzi) return buildReview(task, checks)

  const sameLength = given.length === wanted.length
  checks.push({
    id: 'length', stage: 'recall', decisive: true, label: t('The word has the right number of characters'),
    status: sameLength ? 'pass' : 'fail',
    found: given.length === 1 ? t('{n} character', { n: given.length }) : t('{n} characters', { n: given.length }),
    expected: wanted.length === 1 ? t('{n} character', { n: wanted.length }) : t('{n} characters', { n: wanted.length }),
    fix: given.length < wanted.length
      ? t('The word has {wanted} characters and you typed {typed}. Something is missing.', { wanted: wanted.length, typed: given.length })
      : t('The word has {wanted} characters and you typed {typed}. Take one out.', { wanted: wanted.length, typed: given.length }),
  })
  const sorted = (list: string[]) => [...list].sort().join('')
  const rightCharactersWrongOrder = sameLength && sorted(given) === sorted(wanted) && given.some((character, index) => character !== wanted[index])
  wanted.forEach((character, index) => {
    const right = given[index] === character
    checks.push({
      id: `char-${index + 1}`, stage: 'output', decisive: true,
      label: wanted.length === 1 ? t('The character is right') : t('Character {n} is right', { n: index + 1 }),
      status: right ? 'pass' : 'fail',
      found: given[index] ?? t('Nothing here'), expected: character, spoils: true,
      fix: right ? undefined : rightCharactersWrongOrder
        ? t('You have the right characters in the wrong order.')
        : given[index] === undefined
          ? t('Character {n} is missing. Think of the meaning, then add it.', { n: index + 1 })
          : t("Character {n} is not the lesson word's character. Think of the meaning, then retype it.", { n: index + 1 }),
    })
  })
  return buildReview(task, checks)
}
