/** Persist open-sitting step index so back/close resumes at the same step. */

const STEP_KEY = 'yulu.step.v1'

type StepMap = Record<string, number>

function loadMap(): StepMap {
  try {
    const raw = localStorage.getItem(STEP_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: StepMap = {}
    for (const [id, step] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof step === 'number' && Number.isFinite(step) && step >= 0) {
        out[id] = Math.floor(step)
      }
    }
    return out
  } catch {
    return {}
  }
}

function saveMap(map: StepMap): void {
  try {
    localStorage.setItem(STEP_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

/** Step index for a sitting id, or 0 if missing/invalid. */
export function readStep(id: string): number {
  const step = loadMap()[id]
  return typeof step === 'number' && Number.isFinite(step) && step >= 0 ? Math.floor(step) : 0
}

/** Persist the current step for a sitting id. */
export function writeStep(id: string, step: number): void {
  if (!Number.isFinite(step) || step < 0) return
  const map = loadMap()
  map[id] = Math.floor(step)
  saveMap(map)
}

/** Drop the saved step for a sitting id. */
export function clearStep(id: string): void {
  const map = loadMap()
  if (!(id in map)) return
  delete map[id]
  saveMap(map)
}
