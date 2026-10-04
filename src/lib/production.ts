import type { LessonText } from './types'
import { assessmentFailure } from './assessmentService.ts'

export interface ProductionResult {
  correct: boolean
  assisted: boolean
  words: string[]
  mode: 'speaking' | 'writing'
  evidence?: 'verified' | 'source-match' | 'practice'
  /** Keep each assessed turn separate; one difficult reply must not downgrade another. */
  outcomes?: Array<{
    word: string
    correct: boolean
    assisted: boolean
    mode: 'speaking' | 'writing'
    evidence: 'verified' | 'source-match' | 'practice'
  }>
}

export interface ProductionPrompt {
  expectedZh: string
  expectedEn: string
  response: string
  targetWords: string[]
  grammar?: string
  context?: string
}

export interface ProductionAssessment {
  /** null means grammar/meaning has not been assessed, rather than incorrect. */
  accepted: boolean | null
  evidence: 'verified' | 'source-match' | 'practice'
  feedback: string
  correctedZh: string
  issues: string[]
  usedWords: string[]
  missingWords: string[]
  unavailable?: string
}

export function normalizeChinese(text: string): string {
  return text.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '')
}

export function sourceWords(text: string, candidates: string[]): string[] {
  return [...new Set(candidates.filter((word) => /[\u3400-\u9fff]/.test(word) && text.includes(word)))]
}

export function dialogueRoles(text: LessonText): string[] {
  const speakers = [...new Set(text.lines.map((line) => line.speaker).filter(Boolean))]
  return speakers.length > 1 ? speakers : ['Your turn']
}

export function dialogueTurnIndexes(text: LessonText, role: string): number[] {
  const named = dialogueRoles(text).length > 1
  return text.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => line.zh.trim() && (named ? line.speaker === role : index % 2 === 1 || text.lines.length === 1))
    .slice(0, 3)
    .map(({ index }) => index)
}

export function sourceAssessment(prompt: ProductionPrompt): ProductionAssessment {
  const targetWords = sourceWords(prompt.expectedZh, prompt.targetWords)
  const usedWords = sourceWords(prompt.response, targetWords)
  const match = !!normalizeChinese(prompt.response) && normalizeChinese(prompt.response) === normalizeChinese(prompt.expectedZh)
  return {
    accepted: match ? true : null,
    evidence: match ? 'source-match' : 'practice',
    feedback: match
      ? 'You recalled the book sentence. The Hanzi and word order match; punctuation is flexible.'
      : 'Your wording differs from the book. It may be a valid alternative; source comparison alone cannot verify its grammar or meaning.',
    correctedZh: prompt.expectedZh,
    issues: [],
    usedWords,
    missingWords: targetWords.filter((word) => !usedWords.includes(word)),
  }
}

/** Character alignment describes differences; it never pretends they are grammar errors. */
export function alignChinese(response: string, reference: string): Array<{ text: string; kind: 'same' | 'added' | 'missing' }> {
  const user = [...normalizeChinese(response)].slice(0, 400)
  const source = [...normalizeChinese(reference)].slice(0, 400)
  const rows = Array.from({ length: user.length + 1 }, () => new Uint16Array(source.length + 1))
  for (let i = user.length - 1; i >= 0; i--) {
    for (let j = source.length - 1; j >= 0; j--) {
      rows[i][j] = user[i] === source[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1])
    }
  }
  const parts: Array<{ text: string; kind: 'same' | 'added' | 'missing' }> = []
  const add = (text: string, kind: 'same' | 'added' | 'missing') => {
    const last = parts[parts.length - 1]
    if (last?.kind === kind) last.text += text
    else parts.push({ text, kind })
  }
  let i = 0
  let j = 0
  while (i < user.length || j < source.length) {
    if (i < user.length && j < source.length && user[i] === source[j]) {
      add(user[i++], 'same')
      j++
    } else if (i < user.length && (j === source.length || rows[i + 1][j] >= rows[i][j + 1])) {
      add(user[i++], 'added')
    } else add(source[j++], 'missing')
  }
  return parts
}

export async function assessProduction(prompt: ProductionPrompt, signal?: AbortSignal): Promise<ProductionAssessment> {
  const local = sourceAssessment(prompt)
  if (local.accepted) return local
  const res = await fetch('/api/assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prompt),
    signal,
  })
  if (res.status === 404 || res.status === 503) {
    const failure = await assessmentFailure(res)
    return { ...local, unavailable: `${failure.message} You can still compare with the book below.` }
  }
  if (!res.ok) {
    throw await assessmentFailure(res)
  }
  const result = await res.json() as Partial<ProductionAssessment>
  if (typeof result.accepted !== 'boolean' || typeof result.feedback !== 'string' || typeof result.correctedZh !== 'string' || !Array.isArray(result.issues) || !result.issues.every((issue) => typeof issue === 'string')) {
    throw new Error('The grammar check returned an incomplete result. Retry, or use book comparison.')
  }
  return {
    accepted: result.accepted,
    evidence: 'verified',
    feedback: result.feedback,
    correctedZh: result.correctedZh,
    issues: result.issues,
    usedWords: local.usedWords,
    missingWords: local.missingWords,
  }
}
