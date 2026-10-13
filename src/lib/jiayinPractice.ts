export type JiayinStage = 'context' | 'words' | 'answers' | 'build' | 'recall' | 'test'
export const JIAYIN_STAGES: JiayinStage[] = ['context', 'words', 'answers', 'build', 'recall', 'test']
export const JIAYIN_STAGE_LABEL: Record<JiayinStage, string> = {
  context: 'Pahami situasi', words: 'Kosakata', answers: 'Kalimat dan pola',
  build: 'Susun jawaban', recall: 'Jawab mandiri', test: 'Uji pemahaman',
}
export interface JiayinItem {
  id: string; number?: number; priority: boolean; page: number
  questionZh: string; questionId: string; answerZh: string; answerId: string
  coach: string; seconds: number; needsEvidence: boolean; hypothetical?: boolean; pinyin?: string
  questionPinyin?: string; chunkPinyin?: string[]; pinyinSource?: string
  chunkId: string[]; buildParts?: string[]; buildHint: string; intent: string; followup: string; criteria: string[]
}
export interface JiayinWord { zh: string; pinyin: string; id: string; page: number; tip: string }
export interface JiayinUnit {
  id: number; title: string; items: JiayinItem[]; vocab: JiayinWord[]
  pattern: { zh: string; pinyin: string; form: string; explanation: string; page: number; pinyinSource: string }
  checks?: JiayinQuiz[]
  teaching: { goal: string; scenario: string; reason: string; route: string[]; pitfalls: string[]; task: string; criteria: string[] }
}
export interface JiayinAttempt {
  at: number; rating: 1 | 2 | 3; assisted: boolean; answer: string; seconds: number
}
export interface JiayinExerciseAttempt {
  at: number; correct: boolean; assisted: boolean
  evidence: 'exact' | 'source-match' | 'verified' | 'practice'
  response?: string
}
export interface JiayinProgress {
  pathDone: Record<string, string[]>; notes: Record<string, string>; attempts: Record<string, JiayinAttempt[]>
  lessonsDone: Record<string, number>; exercises: Record<string, JiayinExerciseAttempt[]>
}
export interface JiayinWorksheet { id: string; title: string; questionIds: string[]; fields: string[] }
export function emptyJiayinProgress(): JiayinProgress { return { pathDone: {}, notes: {}, attempts: {}, lessonsDone: {}, exercises: {} } }

/** Tolerant of old/malformed device saves without leaking them into other courses. */
export function parseJiayinProgress(raw: unknown): JiayinProgress {
  const result = emptyJiayinProgress()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result
  const value = raw as Partial<JiayinProgress>
  for (const [key, stages] of Object.entries(value.pathDone ?? {})) {
    if (Array.isArray(stages)) result.pathDone[key] = [...new Set(stages.filter(s => JIAYIN_STAGES.includes(s as JiayinStage) || s === 'mock'))]
  }
  for (const [key, note] of Object.entries(value.notes ?? {})) if (typeof note === 'string') result.notes[key] = note
  for (const [key, attempts] of Object.entries(value.attempts ?? {})) {
    if (!Array.isArray(attempts)) continue
    result.attempts[key] = attempts.filter(a => a && typeof a === 'object' && Number.isFinite(a.at) && [1, 2, 3].includes(a.rating) && typeof a.assisted === 'boolean' && typeof a.answer === 'string' && Number.isFinite(a.seconds)).slice(-20)
  }
  for (const [key, at] of Object.entries(value.lessonsDone ?? {})) if (typeof at === 'number' && Number.isFinite(at) && at > 0) result.lessonsDone[key] = at
  for (const [key, attempts] of Object.entries(value.exercises ?? {})) {
    if (!Array.isArray(attempts)) continue
    result.exercises[key] = attempts.filter(a => a && typeof a === 'object' && Number.isFinite(a.at)
      && typeof a.correct === 'boolean' && typeof a.assisted === 'boolean'
      && ['exact', 'source-match', 'verified', 'practice'].includes(a.evidence)
      && (a.response === undefined || typeof a.response === 'string')).slice(-20)
  }
  return result
}
export function nextJiayinStage(units: JiayinUnit[], progress: JiayinProgress): { unit: number; stage: JiayinStage } {
  for (const unit of units) {
    const stage = JIAYIN_STAGES.find(s => !progress.pathDone[String(unit.id)]?.includes(s))
    if (stage) return { unit: unit.id, stage }
  }
  return { unit: units[0]?.id ?? 1, stage: 'recall' }
}
export function lastJiayinAttempt(attempts: JiayinAttempt[] | undefined): JiayinAttempt | undefined { return attempts?.[attempts.length - 1] }
/** For phrases/back-questions the source prompt IS the answer; cue in Indonesian instead. */
export function jiayinRecallPrompt(item: JiayinItem): { text: string; language: 'id' | 'zh-CN' } {
  return /^(phrase|ask)/.test(item.id) ? { text: item.questionId, language: 'id' } : { text: item.questionZh, language: 'zh-CN' }
}
export function isUnaidedAttempt(attempt: JiayinAttempt | undefined): boolean {
  return !!attempt && attempt.rating === 3 && !attempt.assisted && attempt.answer.trim().length > 0
}
export function jiayinEvidenceNotes(itemId: string, progress: JiayinProgress, sheets: JiayinWorksheet[]): string {
  const personal = progress.notes[`answer:${itemId}`]?.trim()
  if (personal) return personal
  return sheets.filter(sheet => sheet.questionIds.includes(itemId)).map(sheet => {
    const lines = sheet.fields.flatMap((field, index) => {
      const text = progress.notes[`worksheet:${sheet.id}:${index}`]?.trim()
      return text ? [`${field}: ${text}`] : []
    })
    return lines.length ? `${sheet.title}\n${lines.join('\n')}` : ''
  }).filter(Boolean).join('\n\n')
}
export function passesJiayinRecall(items: JiayinItem[], progress: JiayinProgress, sheets: JiayinWorksheet[] = []): boolean {
  return items.length > 0 && items.every(item => isUnaidedAttempt(lastJiayinAttempt(progress.attempts[item.id]))
    && (!item.needsEvidence || !!jiayinEvidenceNotes(item.id, progress, sheets)))
}
export function passesJiayinCheck(results: boolean[], expected: number): boolean {
  return expected > 0 && results.length === expected && results.filter(Boolean).length >= Math.ceil(expected * .8)
}
export function needsJiayinReview(item: JiayinItem, progress: JiayinProgress, now = Date.now()): boolean {
  const last = lastJiayinAttempt(progress.attempts[item.id])
  return !isUnaidedAttempt(last) || !last || now - last.at >= jiayinReviewDays(progress.attempts[item.id]) * 86_400_000
}
/** Repeated successes on one day do not increase the review interval. */
export function jiayinReviewDays(attempts: JiayinAttempt[] | undefined): number {
  const days = new Set<string>()
  for (const attempt of [...attempts ?? []].reverse()) {
    if (!isUnaidedAttempt(attempt)) break
    const date = new Date(attempt.at)
    days.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`)
  }
  return days.size >= 3 ? 4 : days.size === 2 ? 2 : 1
}
export function isJiayinRetained(attempts: JiayinAttempt[] | undefined): boolean {
  return jiayinReviewDays(attempts) >= 2 && isUnaidedAttempt(lastJiayinAttempt(attempts))
}
/** Weak recorded answers come first, so an unseen prefix cannot starve them. */
export function selectJiayinReview(items: JiayinItem[], progress: JiayinProgress, now = Date.now(), limit = 10): JiayinItem[] {
  return items.filter(item => (item.id.startsWith('q') || item.hypothetical) && needsJiayinReview(item, progress, now))
    .sort((a, b) => {
      const left = lastJiayinAttempt(progress.attempts[a.id]); const right = lastJiayinAttempt(progress.attempts[b.id])
      const rank = (attempt: JiayinAttempt | undefined) => attempt && !isUnaidedAttempt(attempt) ? 0 : attempt ? 1 : 2
      return rank(left) - rank(right) || (left?.at ?? 0) - (right?.at ?? 0)
    }).slice(0, limit)
}
export function shuffledJiayinParts(parts: string[], seed: string): number[] {
  const indices = parts.map((_, i) => i)
  let state = [...seed].reduce((sum, char) => (Math.imul(sum, 31) + char.charCodeAt(0)) >>> 0, 17)
  for (let i = indices.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices.every((index, i) => index === i) && indices.length > 1 ? [...indices.slice(1), indices[0]] : indices
}
export function jiayinBuildParts(item: JiayinItem): string[] { return item.buildParts ?? answerChunks(item.answerZh) }
/** Compare the produced text, not indices: identical blocks are interchangeable. */
export function isJiayinAssemblyCorrect(parts: string[], selected: number[], target: string): boolean {
  return selected.length === parts.length && new Set(selected).size === parts.length
    && selected.every(index => Number.isInteger(index) && index >= 0 && index < parts.length)
    && selected.map(index => parts[index]).join('') === target
}
/** Prioritize weak attempts, then unseen essentials; mix questions and hypothetical cases. */
export function selectJiayinMock(items: JiayinItem[], progress: JiayinProgress, limit = 15): JiayinItem[] {
  const questions = items.filter(item => item.id.startsWith('q'))
  const rank = (item: JiayinItem) => {
    const last = lastJiayinAttempt(progress.attempts[item.id])
    return last && !isUnaidedAttempt(last) ? 0 : !last && item.priority ? 1 : !last ? 2 : 3
  }
  const sorted = questions.sort((a, b) => rank(a) - rank(b) || (lastJiayinAttempt(progress.attempts[a.id])?.at ?? 0) - (lastJiayinAttempt(progress.attempts[b.id])?.at ?? 0) || (a.number ?? 0) - (b.number ?? 0))
  const cases = items.filter(item => item.hypothetical).sort((a, b) => rank(a) - rank(b) || (lastJiayinAttempt(progress.attempts[a.id])?.at ?? 0) - (lastJiayinAttempt(progress.attempts[b.id])?.at ?? 0)).slice(0, 3)
  return [...sorted.slice(0, Math.max(0, limit - cases.length)), ...cases].slice(0, limit)
}
export interface JiayinQuiz { id: string; prompt: string; choices: string[]; answer: number; explanation: string }
function rotate<T>(values: T[], by: number): T[] { return [...values.slice(by), ...values.slice(0, by)] }
export function buildJiayinQuiz(unit: JiayinUnit): JiayinQuiz[] {
  const wordChecks = unit.vocab.map((word, i) => {
    const choices = rotate([word.id, ...unit.vocab.filter(w => w.zh !== word.zh).slice(0, 3).map(w => w.id)], i % Math.min(4, unit.vocab.length))
    return { id: `word:${word.zh}`, prompt: `Arti ${word.zh}?`, choices, answer: choices.indexOf(word.id), explanation: `${word.zh} · ${word.pinyin} · ${word.id}` }
  })
  const questionChecks = unit.items.filter(item => /^(q|phrase|ask)/.test(item.id) || item.hypothetical).map((item, i) => {
    const choices = rotate([item.questionId, ...unit.items.filter(q => q.id !== item.id).slice(0, 3).map(q => q.questionId)], (i + 1) % Math.min(4, unit.items.length))
    return { id: `question:${item.id}`, prompt: item.questionZh, choices, answer: choices.indexOf(item.questionId), explanation: `${item.questionId} — ${item.coach}` }
  })
  return [...wordChecks, ...questionChecks, ...unit.checks ?? []]
}
export function answerChunks(text: string): string[] { return text.match(/[^。！？]+[。！？]?/g)?.map(s => s.trim()).filter(Boolean) ?? [text] }
