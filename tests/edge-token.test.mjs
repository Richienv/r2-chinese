import test from 'node:test'
import assert from 'node:assert/strict'
import { edgeToken, EDGE_TOKEN_VERSION } from '../server/edge-token.js'

// Independent Python reference vectors: edge-tts ef51a4d, drm.py.
const vectors = [
  {
    "at": 0,
    "token": "52BC7A17B50DFEC9-28C4394775C8751CD2F6859C030C06DB1489ACAB3B3A7651831FC26895177ED6"
  },
  {
    "at": 1791888000,
    "token": "492D7694A183A45E-56E821F95D4579C5B7C7E33DC7303FF379EC36D510213555BBBB9EB17EF15876"
  },
  {
    "at": 1791888299.99,
    "token": "492D7694A183A45E-56E821F95D4579C5B7C7E33DC7303FF379EC36D510213555BBBB9EB17EF15876"
  },
  {
    "at": 1791888300,
    "token": "6D26B5F5B70269AD-280E82E1BBE24E4E8866E3502EB6277B9436F61ABDC1C224518A038BBD7BBDAD"
  },
  {
    "at": 1800000000,
    "token": "99E54519B490BE5C-E162DB0977FBDCB9B86DD8148BF1BCDC3C0303176CE39852A42B415935C20654"
  },
  {
    "at": 2000000000,
    "token": "2D62557F1142BC5D-FD9C30C68FF194A5EE6B45FEFC5E2BA1D1239F88A90569AB55CFFFAA7799F40E"
  }
]

test('Edge v2 connection tokens match upstream reference vectors and the captured browser token', () => {
  assert.equal(EDGE_TOKEN_VERSION, '2-143.0.3650.75')
  for (const { at, token } of vectors) assert.equal(edgeToken(at), token, String(at))
})

test('tokens change at a five-minute boundary and reject invalid timestamps', () => {
  assert.equal(edgeToken(1791888000), edgeToken(1791888299.99))
  assert.notEqual(edgeToken(1791888299.99), edgeToken(1791888300))
  assert.throws(() => edgeToken(NaN), TypeError)
})
