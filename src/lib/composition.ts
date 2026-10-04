import { naturalChineseSegments } from './dictionary-format.ts'
import { compositionCoverage } from './hskPractice.ts'
import { assessmentFailure, AssessmentServiceError } from './assessmentService.ts'

export interface GrammarCorrection { original: string; corrected: string; why: string; rule: string }
export interface CompositionReview {
  accepted: boolean
  correctedZh: string
  feedback: string
  corrections: GrammarCorrection[]
  used: string[]
  missing: string[]
}

export function writingCoverage(response: string, words: string[]) {
  return compositionCoverage(response, words, naturalChineseSegments(response))
}

export async function reviewComposition(response: string, words: string[], intendedMeaning = '', signal?: AbortSignal): Promise<CompositionReview> {
  let res: Response
  try {
    res = await fetch('/api/assess', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
      body: JSON.stringify({ mode: 'composition', response, targetWords: words, intendedMeaning }),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new AssessmentServiceError('assessment_network_error')
  }
  if (!res.ok) throw await assessmentFailure(res)
  const data = await res.json().catch(() => null)
  if (!data || data.evidence !== 'verified' || typeof data.accepted !== 'boolean' || typeof data.correctedZh !== 'string' || !data.correctedZh.trim() || typeof data.feedback !== 'string' || !data.feedback.trim() || !Array.isArray(data.corrections) || data.corrections.length > 4 || !data.corrections.every((entry: GrammarCorrection) => entry && typeof entry.original === 'string' && typeof entry.corrected === 'string' && typeof entry.why === 'string' && typeof entry.rule === 'string')) throw new AssessmentServiceError('assessment_incomplete')
  return { accepted: data.accepted, correctedZh: data.accepted ? response : data.correctedZh, feedback: data.feedback, corrections: data.corrections, ...writingCoverage(response, words) }
}
