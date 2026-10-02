import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceDockSpring, dockSpringAt, dockSpringSettled } from '../src/lib/navigationMotion.ts'

const slots = [{ x: 8, width: 72 }, { x: 87, width: 72 }, { x: 166, width: 72 }, { x: 245, width: 72 }]

function settle(state, target, dt) {
  let frames = 0
  while (!dockSpringSettled(state, target) && frames < 500) {
    state = advanceDockSpring(state, target, dt)
    assert.ok(Number.isFinite(state.x.position) && Number.isFinite(state.width.position))
    frames++
  }
  assert.ok(dockSpringSettled(state, target), 'marker must stop instead of animating forever')
  return { state, frames }
}

test('the measured marker reaches all four destinations at 30, 60 and 120 Hz', () => {
  for (const hz of [30, 60, 120]) {
    let state = dockSpringAt(slots[0])
    for (const target of [...slots.slice(1), slots[0]]) {
      const result = settle(state, target, 1 / hz)
      state = result.state
      assert.ok(Math.abs(state.x.position - target.x) < .08)
      assert.ok(Math.abs(state.width.position - target.width) < .08)
      assert.ok(result.frames / hz < 1.5)
    }
  }
})

test('rapid tab changes retarget the existing velocity and converge after reversing direction', () => {
  let state = dockSpringAt(slots[0])
  for (const target of [slots[3], slots[1], slots[2], slots[0]]) {
    for (let frame = 0; frame < 5; frame++) state = advanceDockSpring(state, target, 1 / 60)
  }
  state = settle(state, slots[0], 1 / 60).state
  assert.ok(Math.abs(state.x.position - slots[0].x) < .08)
})

test('resize, stalled frames and reduced-motion snapping retain measured bounds', () => {
  const resized = { x: 211, width: 59 }
  const initial = dockSpringAt(slots[0])
  const stalled = advanceDockSpring(initial, resized, 20)
  assert.ok(Number.isFinite(stalled.x.position) && stalled.width.position > 0)
  assert.ok(stalled.x.position < resized.x)
  const final = settle(stalled, resized, 1 / 60).state
  assert.ok(Math.abs(final.width.position - resized.width) < .08)
  const reduced = dockSpringAt(resized)
  assert.ok(dockSpringSettled(reduced, resized))
  assert.equal(reduced.x.velocity, 0)
  assert.equal(reduced.width.velocity, 0)
})
