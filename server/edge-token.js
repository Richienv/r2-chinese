/**
 * Edge Read Aloud v2 connection-token adapter; no voice, pitch or rate changes.
 * Adapted to JavaScript from edge-tts drm.py, commit ef51a4d, by rany and
 * HarryXiaoCN; LGPL-3.0, see licenses/edge-tts-LICENSE.txt and GPL-3.0.txt.
 * Modified 2026-11-14: compact SHA rounds and explicit JS 32-bit arithmetic.
 * https://github.com/rany2/edge-tts/pull/492
 */
const INITIAL = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]
const RESUME = [4255104674, 2435071207, 3192492180, 3442351626, 1811967817, 79508907, 4272990180, 66059218]
const PREFIX_WORDS = [3945054110, 358115615, 2696978146, 217723578, 2787307148, 3520959633, 3235718560, 4192668342, 4039316851, 1884868174, 1904797190, 15051571, 3529027680, 1920361828]
const ROUND = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]
const COEFFICIENTS = [[3895366065, 3005677776], [1155409094, 2296378653], [1005282748, 693190712], [3365689651, 3005795295], [2367603217, 3557143765], [827258325, 652566332], [3911487921, 1618477510], [4037392853, 2192753147], [101076211, 4199654362], [3665427040, 545047652], [3201434976, 1010595059], [2314848760, 3536931681], [905590982, 3137643201], [3410617286, 3311559015]]

export const EDGE_TOKEN_VERSION = '2-143.0.3650.75'
const CLIENT = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const rotate = (x, n) => (x >>> n) | (x << (32 - n))
const swap = x => ((x << 16) | (x >>> 16)) >>> 0
const mul = (x, y) => Math.imul(x, y) >>> 0
const sigma0 = x => (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) >>> 0
const sigma1 = x => (rotate(x, 17) ^ rotate(x, 19) ^ (x >>> 10)) >>> 0

function rounds(state, words, start = 0) {
  let [a, b, c, d, e, f, g, h] = state
  for (let i = start; i < 64; i++) {
    const k = start === 14 && i === 14 ? 0xc9dc06a7 : ROUND[i]
    const big1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)
    const big0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)
    const t1 = (h + big1 + (g ^ (e & (f ^ g))) + k + words[i]) >>> 0
    const t2 = (big0 + ((a & b) | (c & (a | b)))) >>> 0
    ;[a, b, c, d, e, f, g, h] = [(t1 + t2) >>> 0, a, b, c, (d + t1) >>> 0, e, f, g]
  }
  return [a, b, c, d, e, f, g, h]
}
function expand(words, start = 16) {
  for (let i = start; i < 64; i++)
    words[i] = (sigma1(words[i - 2]) + words[i - 7] + sigma0(words[i - 15]) + words[i - 16]) >>> 0
}
function tokenDigest(data) {
  const words = Array(14).fill(0)
  words.push(data.readUIntBE(0, 3), data.readUInt32BE(3))
  for (let i = 16; i < 30; i++) {
    let value = PREFIX_WORDS[i - 16]
    if (i - 2 >= 14) value += i === 16 ? sigma1(words[i - 2]) ^ 0x000b92c0 : sigma1(words[i - 2])
    if (i - 7 >= 14) value += words[i - 7]
    if (i - 15 >= 14) value += i === 29 ? sigma0(words[i - 15]) ^ 0x059c0b80 : sigma0(words[i - 15])
    words.push(value >>> 0)
  }
  words.push((sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + 0xc9dc06a7 - ROUND[14]) >>> 0)
  expand(words, 31)
  let state = rounds(RESUME, words, 14).map((x, i) => (x + INITIAL[i]) >>> 0)
  const length = 57 + data.length
  const trailer = Buffer.alloc(8)
  trailer.writeBigUInt64BE(BigInt(length * 8))
  const padding = ((55 - length) % 64 + 64) % 64
  const padded = Buffer.concat([data.subarray(7), Buffer.from([0x80]), Buffer.alloc(padding), trailer])
  for (let offset = 0; offset < padded.length; offset += 64) {
    const schedule = Array.from({ length: 16 }, (_, i) => padded.readUInt32BE(offset + i * 4))
    expand(schedule)
    state = rounds(state, schedule).map((x, i) => (x + state[i]) >>> 0)
  }
  const digest = Buffer.alloc(32)
  state.forEach((x, i) => digest.writeUInt32BE(x, i * 4))
  return digest
}
function cs64(data, digest) {
  const keys = [digest.readUInt32LE(0) | 1, digest.readUInt32LE(4) | 1]
  const factors = keys.map(k => mul(k, 0x82893933))
  const terms = COEFFICIENTS.map(([coefficient], i) => mul(coefficient, factors[i % 2]))
  const offsets = COEFFICIENTS.map(([, offset]) => offset)
  const padded = Buffer.alloc(Math.ceil((1 + data.length) / 8) * 8)
  data.copy(padded, 1)
  for (let i = 0; i < padded.length / 4; i++) {
    const word = padded.readUInt32LE(i * 4)
    let term = mul(word, keys[i % 2])
    let offset = mul(swap(word), i % 2 === 0 ? 0xef0569fb : 0xc31713db)
    if (i === 0) {
      term = (term + mul(0xf2f90b1a, factors[0])) >>> 0
      offset = (offset + 0x0b1a0000) >>> 0
    }
    terms.push(term)
    offsets.push(offset)
  }
  let swapAcc = 0, swapLast = 0, state = 0, acc = 0
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i], y = terms[i + 1]
    let q = mul(swap((offsets[i] + x) >>> 0), 0x76f50f34)
    swapAcc = (swapAcc + mul(swap(q), 0xc3efea97) + q) >>> 0
    q = mul(swap((offsets[i + 1] + y) >>> 0), 0x1881ce3c)
    swapLast = (mul(swap(q), 0x35bd1ec9) + q) >>> 0
    swapAcc = (swapAcc + swapLast) >>> 0
    state = (mul(state, keys[0]) + x) >>> 0
    for (const factor of [0xcf98b111, 0x87085b9f, 0x12ceb96d, 0x257e1d83]) state = mul(swap(state), factor)
    acc = (acc + state) >>> 0
    state = (mul(state, keys[1]) + y) >>> 0
    for (const factor of [0xa27416f5, 0xd38396ff, 0x7c932b89, 0xbfa49f69]) state = mul(swap(state), factor)
    acc = (acc + state) >>> 0
  }
  const result = Buffer.alloc(8)
  result.writeUInt32LE((swapLast ^ state) >>> 0, 0)
  result.writeUInt32LE((swapAcc ^ acc) >>> 0, 4)
  return result
}
export function edgeToken(unixSeconds = Date.now() / 1000) {
  if (!Number.isFinite(unixSeconds)) throw new TypeError('Invalid token timestamp')
  const seconds = unixSeconds + 11644473600
  // Match the upstream IEEE-754 timestamp string, including at window boundaries.
  const ticks = ((seconds - seconds % 300) * 1e7).toFixed(0)
  const data = Buffer.from(ticks + CLIENT, 'ascii')
  const digest = tokenDigest(data)
  return cs64(data, digest).toString('hex').toUpperCase() + '-' + digest.toString('hex').toUpperCase()
}
