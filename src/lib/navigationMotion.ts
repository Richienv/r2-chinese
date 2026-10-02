export type SpringAxis = { position: number; velocity: number }
export type DockSpring = { x: SpringAxis; width: SpringAxis }
export type DockTarget = { x: number; width: number }

/** Bounded substeps keep rapid retargeting stable across 30/60/120 Hz screens. */
function advanceAxis(axis: SpringAxis, target: number, elapsed: number): SpringAxis {
  let { position, velocity } = axis
  const duration = Math.min(Math.max(0, elapsed), 1 / 15)
  const steps = Math.max(1, Math.ceil(duration / (1 / 240)))
  const dt = duration / steps
  for (let step = 0; step < steps; step++) {
    velocity += ((target - position) * 460 - velocity * 34) * dt
    position += velocity * dt
  }
  return { position, velocity }
}

export function advanceDockSpring(state: DockSpring, target: DockTarget, elapsed: number): DockSpring {
  return { x: advanceAxis(state.x, target.x, elapsed), width: advanceAxis(state.width, target.width, elapsed) }
}

export function dockSpringSettled(state: DockSpring, target: DockTarget): boolean {
  return Math.abs(state.x.position - target.x) < .08 && Math.abs(state.width.position - target.width) < .08
    && Math.abs(state.x.velocity) < .25 && Math.abs(state.width.velocity) < .25
}

export function dockSpringAt(target: DockTarget): DockSpring {
  return { x: { position: target.x, velocity: 0 }, width: { position: target.width, velocity: 0 } }
}
