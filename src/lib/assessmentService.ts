type AssessmentErrorCode =
  | 'assessment_not_configured' | 'assessment_route_missing' | 'assessment_auth_failed'
  | 'assessment_model_unavailable' | 'assessment_quota_exceeded' | 'rate_limited'
  | 'assessment_timeout' | 'assessment_incomplete' | 'assessment_service_unavailable'
  | 'assessment_network_error' | 'invalid_prompt'

const messages: Record<AssessmentErrorCode, string> = {
  assessment_not_configured: 'The grammar reviewer has not been connected yet. A server API key is required.',
  assessment_route_missing: 'This app cannot reach its grammar endpoint. The review service needs to be connected.',
  assessment_auth_failed: 'The grammar provider rejected the server API key. Update the reviewer connection before retrying.',
  assessment_model_unavailable: 'The configured grammar model is unavailable to this API key. Update the reviewer model.',
  assessment_quota_exceeded: 'The grammar provider has no available API credit. Restore its API balance before retrying.',
  rate_limited: 'A few checks ran close together. Wait a minute, then try again.',
  assessment_timeout: 'The grammar review took too long. Try again.',
  assessment_incomplete: 'The grammar review was incomplete. Try again to get an explanation.',
  assessment_service_unavailable: 'The grammar service is temporarily unavailable. Try again.',
  assessment_network_error: 'The app could not reach the grammar service. Check your connection and try again.',
  invalid_prompt: 'Write some Mandarin and choose at least one word before checking.',
}

export class AssessmentServiceError extends Error {
  readonly code: AssessmentErrorCode
  readonly needsSetup: boolean
  constructor(code: AssessmentErrorCode) {
    super(messages[code])
    this.name = 'AssessmentServiceError'
    this.code = code
    this.needsSetup = ['assessment_not_configured', 'assessment_route_missing', 'assessment_auth_failed', 'assessment_model_unavailable', 'assessment_quota_exceeded'].includes(code)
  }
}

export async function assessmentFailure(res: Response): Promise<AssessmentServiceError> {
  const data = await res.json().catch(() => null) as { error?: unknown } | null
  if (typeof data?.error === 'string' && Object.prototype.hasOwnProperty.call(messages, data.error)) return new AssessmentServiceError(data.error as AssessmentErrorCode)
  const code = res.status === 404 ? 'assessment_route_missing'
    : res.status === 429 ? 'rate_limited'
      : res.status === 504 ? 'assessment_timeout'
        : 'assessment_service_unavailable'
  return new AssessmentServiceError(code)
}

/** Configuration only: this does not spend API credit or claim the key is valid. */
export async function assessmentStatus(signal?: AbortSignal): Promise<{ configured: boolean }> {
  let res: Response
  try { res = await fetch('/api/assess', { signal, cache: 'no-store' }) }
  catch (error) {
    if (signal?.aborted) throw error
    throw new AssessmentServiceError('assessment_network_error')
  }
  if (!res.ok) throw await assessmentFailure(res)
  const data = await res.json().catch(() => null)
  if (typeof data?.configured !== 'boolean') throw new AssessmentServiceError('assessment_route_missing')
  return { configured: data.configured }
}
