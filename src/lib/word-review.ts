import { normalizeChinese } from './production.ts'
import { buildReview, type Review, type ReviewCheck } from './review.ts'

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
    id: 'hanzi', stage: 'instruction', decisive: true, label: 'Answered in Chinese characters',
    status: allHanzi ? 'pass' : 'fail',
    found: given.length ? typed.trim() : 'Nothing typed', expected: 'Hanzi',
    fix: given.length ? 'Type the Hanzi (汉字), not pinyin or English.' : 'Type the word before checking.',
  })
  if (!allHanzi) return buildReview(task, checks)

  const sameLength = given.length === wanted.length
  checks.push({
    id: 'length', stage: 'recall', decisive: true, label: 'The word has the right number of characters',
    status: sameLength ? 'pass' : 'fail',
    found: `${given.length} character${given.length === 1 ? '' : 's'}`, expected: `${wanted.length} character${wanted.length === 1 ? '' : 's'}`,
    fix: given.length < wanted.length
      ? `The word has ${wanted.length} characters and you typed ${given.length}. Something is missing.`
      : `The word has ${wanted.length} characters and you typed ${given.length}. Take one out.`,
  })
  const sorted = (list: string[]) => [...list].sort().join('')
  const rightCharactersWrongOrder = sameLength && sorted(given) === sorted(wanted) && given.some((character, index) => character !== wanted[index])
  wanted.forEach((character, index) => {
    const right = given[index] === character
    checks.push({
      id: `char-${index + 1}`, stage: 'output', decisive: true,
      label: wanted.length === 1 ? 'The character is right' : `Character ${index + 1} is right`,
      status: right ? 'pass' : 'fail',
      found: given[index] ?? 'Nothing here', expected: character, spoils: true,
      fix: right ? undefined : rightCharactersWrongOrder
        ? 'You have the right characters in the wrong order.'
        : given[index] === undefined
          ? `Character ${index + 1} is missing. Think of the meaning, then add it.`
          : `Character ${index + 1} is not the lesson word's character. Think of the meaning, then retype it.`,
    })
  })
  return buildReview(task, checks)
}
