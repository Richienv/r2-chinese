export const JIAYIN_ENGLISH_KEY = 'yulu.jiayin.english.v1'

export interface EnglishPrepQuestion {
  id: string; sourceId: string; pillar: string; priority: boolean; hypothetical?: boolean
  title: string; questionEn: string; questionId: string; answerEn: string; coachId: string
  outline: string[]; criteria: string[]; followupEn: string; seconds: number; evidenceFields: string[]
}
export interface EnglishPrepDraft { answer: string; assisted: boolean; checks: string[] }
export interface EnglishPrepAttempt extends EnglishPrepDraft {
  at: number; seconds: number; rating: 'again' | 'supported' | 'ready'; evidence: string[]
}
export interface EnglishPrepProgress {
  notes: Record<string, string>; drafts: Record<string, EnglishPrepDraft>; attempts: Record<string, EnglishPrepAttempt[]>
}
export function emptyEnglishPrepProgress(): EnglishPrepProgress { return { notes: {}, drafts: {}, attempts: {} } }
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
function draft(value: unknown): EnglishPrepDraft | undefined {
  if (!isRecord(value) || typeof value.answer !== 'string' || typeof value.assisted !== 'boolean') return
  return { answer: value.answer, assisted: value.assisted, checks: strings(value.checks) }
}
export function parseEnglishPrepProgress(raw: unknown): EnglishPrepProgress {
  const result = emptyEnglishPrepProgress()
  if (!isRecord(raw)) return result
  if (isRecord(raw.notes)) for (const [id, value] of Object.entries(raw.notes)) if (typeof value === 'string') result.notes[id] = value
  if (isRecord(raw.drafts)) for (const [id, value] of Object.entries(raw.drafts)) {
    const saved = draft(value); if (saved) result.drafts[id] = saved
  }
  if (isRecord(raw.attempts)) for (const [id, history] of Object.entries(raw.attempts)) {
    if (!Array.isArray(history)) continue
    result.attempts[id] = history.flatMap(value => {
      const saved = draft(value)
      if (!saved || !isRecord(value) || typeof value.at !== 'number' || !Number.isFinite(value.at)
        || typeof value.seconds !== 'number' || !Number.isFinite(value.seconds) || value.seconds < 0
        || !['again', 'supported', 'ready'].includes(String(value.rating))) return []
      return [{ ...saved, at: value.at, seconds: value.seconds, rating: value.rating as EnglishPrepAttempt['rating'], evidence: strings(value.evidence) }]
    }).slice(-20)
  }
  return result
}
export function latestEnglishAttempt(progress: EnglishPrepProgress, id: string): EnglishPrepAttempt | undefined {
  const history = progress.attempts[id]; return history?.[history.length - 1]
}
/** This is content readiness by the user's checks, never automatic language or fact verification. */
export function isEnglishPrepReady(question: EnglishPrepQuestion, attempt: EnglishPrepAttempt | undefined): boolean {
  return !!attempt && attempt.rating === 'ready' && !attempt.assisted && !!attempt.answer.trim()
    && question.criteria.every(check => attempt.checks.includes(check))
    && question.evidenceFields.every((_, index) => !!attempt.evidence[index]?.trim())
}
export function englishEvidenceKey(id: string, index: number): string { return `story:${id}:${index}` }
export function englishEvidence(question: EnglishPrepQuestion, progress: EnglishPrepProgress): string[] {
  return question.evidenceFields.map((_, index) => progress.notes[englishEvidenceKey(question.id, index)] ?? '')
}
/** Opening the same overlay mode would retain its finished React state; route to a different question. */
export function nextEnglishQuestion(questions: EnglishPrepQuestion[], progress: EnglishPrepProgress, currentId: string): EnglishPrepQuestion | undefined {
  return questions.find(question => question.priority && question.id !== currentId && !isEnglishPrepReady(question, latestEnglishAttempt(progress, question.id)))
}
export function englishPrepQueue(questions: EnglishPrepQuestion[], progress: EnglishPrepProgress, mode: 'mock' | 'review'): EnglishPrepQuestion[] {
  if (mode === 'mock') return [...questions.filter(q => q.priority), ...questions.filter(q => ['partner', 'funnel', 'first-30'].includes(q.id))]
  return questions.filter(question => {
    const attempt = latestEnglishAttempt(progress, question.id)
    return (attempt && !isEnglishPrepReady(question, attempt)) || !!progress.drafts[question.id]?.answer.trim() || !!progress.drafts[question.id]?.assisted
  }).sort((a, b) => (latestEnglishAttempt(progress, a.id)?.at ?? 0) - (latestEnglishAttempt(progress, b.id)?.at ?? 0))
}
