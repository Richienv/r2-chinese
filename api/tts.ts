import { createHash, randomUUID } from 'node:crypto'
import WebSocket from 'ws'

/**
 * Serverless proxy for Microsoft Edge's "Read Aloud" neural TTS. This is the
 * same Azure neural engine behind Edge, reachable without an API key. We speak
 * the Edge WebSocket protocol directly so there's no dependency to go stale.
 *
 * Output is deterministic per (text, voice, rate), so responses are cached hard
 * at the CDN — a word spoken twice is served from cache the second time.
 */

/**
 * Self-contained on purpose: Vercel's function runtime cannot resolve imports
 * of ../src/*.ts (the function answers FUNCTION_INVOCATION_FAILED), so nothing
 * here may import from outside api/. The browser's copy of WordTiming lives in
 * src/lib/speechTiming.ts.
 */
/** Word boundaries from the synthesizer, in audio seconds and UTF-16 offsets. */
export interface WordTiming { start: number; duration: number; charIndex: number; charLength: number }

export interface SpokenBoundary { text: string; offset: number; duration: number }

export function parseSpeechMetadata(message: string): SpokenBoundary[] {
  const split = message.indexOf('\r\n\r\n')
  if (split < 0 || !message.slice(0, split).includes('Path:audio.metadata')) return []
  try {
    const body = JSON.parse(message.slice(split + 4))
    if (!Array.isArray(body.Metadata)) return []
    return body.Metadata.flatMap((entry: any) => {
      const data = entry?.Data
      if (entry?.Type !== 'WordBoundary' || typeof data?.text?.Text !== 'string' || !Number.isFinite(data.Offset) || !Number.isFinite(data.Duration) || data.Offset < 0 || data.Duration < 0) return []
      const text = data.text.Text.replace(/&(amp|lt|gt|quot|apos);/g, (_: string, key: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[key]!))
      // Edge's metadata uses 100ns ticks. Keep the service timing; never infer
      // word positions from a timer or from the length of a Chinese sentence.
      return [{ text, offset: data.Offset / 10000000, duration: data.Duration / 10000000 }]
    })
  } catch { return [] }
}

export function alignSpeechBoundaries(text: string, boundaries: SpokenBoundary[]): WordTiming[] {
  let cursor = 0
  const words: WordTiming[] = []
  for (const boundary of boundaries) {
    if (!boundary.text || !Number.isFinite(boundary.offset) || boundary.offset < 0) continue
    const index = text.indexOf(boundary.text, cursor)
    if (index < 0) continue
    words.push({ start: boundary.offset, duration: boundary.duration, charIndex: index, charLength: boundary.text.length })
    cursor = index + boundary.text.length
  }
  return words.sort((a, b) => a.start - b.start)
}

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS_URL =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const EDGE_VERSION = '1-143.0.3650.75'
const ALLOWED_VOICES = new Set([
  'zh-CN-XiaoxiaoNeural',
  'zh-CN-YunxiNeural',
  'zh-CN-XiaoyiNeural',
  'zh-CN-YunjianNeural',
])
const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural'

/** Microsoft's DRM token: SHA-256 of (5-min-rounded Windows filetime + token). */
function secMsGec(): string {
  let seconds = Math.floor(Date.now() / 1000) + 11_644_473_600
  seconds -= seconds % 300
  const ticks = BigInt(seconds) * 10_000_000n
  return createHash('sha256')
    .update(`${ticks}${TRUSTED_CLIENT_TOKEN}`, 'ascii')
    .digest('hex')
    .toUpperCase()
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function synthesize(text: string, voice: string, rate: string, timings: boolean): Promise<{ audio: Buffer; boundaries: SpokenBoundary[] }> {
  return new Promise((resolve, reject) => {
    const url =
      `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
      `&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=${EDGE_VERSION}`
    const ws = new WebSocket(url, {
      headers: {
        Origin: 'chrome-extension://jdiccldimpfdibmpgcfnpblgcbfnnjkbf',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
      },
    })

    const chunks: Buffer[] = []
    const boundaries: SpokenBoundary[] = []
    let settled = false
    function fail(error: Error) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ws.terminate()
      reject(error)
    }
    const timer = setTimeout(() => {
      fail(new Error('tts timeout'))
    }, 12_000)

    ws.on('open', () => {
      const now = new Date().toISOString()
      ws.send(
        `X-Timestamp:${now}\r\nContent-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"${timings ? 'true' : 'false'}"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`,
      )
      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>` +
        `<voice name='${voice}'><prosody pitch='+0Hz' rate='${rate}' volume='+0%'>` +
        `${escapeXml(text)}</prosody></voice></speak>`
      ws.send(
        `X-RequestId:${randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${now}\r\nPath:ssml\r\n\r\n${ssml}`,
      )
    })

    ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
      if (isBinary) {
        const buf = data as Buffer
        if (buf.length < 2) return
        // frame = [uint16 header length][header text][audio bytes]
        const headerLen = buf.readUInt16BE(0)
        if (2 + headerLen > buf.length || !buf.subarray(2, 2 + headerLen).toString().includes('Path:audio')) return
        chunks.push(buf.subarray(2 + headerLen))
      } else {
        const message = data.toString()
        if (timings) boundaries.push(...parseSpeechMetadata(message))
        if (message.includes('Path:turn.end')) {
          settled = true
          clearTimeout(timer)
          ws.close()
          resolve({ audio: Buffer.concat(chunks), boundaries })
        }
      }
    })

    ws.on('error', fail)
    ws.on('close', () => { if (!settled) fail(new Error('tts connection closed before completion')) })
  })
}

export default async function handler(req: any, res: any) {
  try {
    const params = new URL(req.url, 'http://localhost').searchParams
    const text = (params.get('text') ?? '').slice(0, 400).trim()
    const voiceParam = params.get('voice') ?? DEFAULT_VOICE
    const voice = ALLOWED_VOICES.has(voiceParam) ? voiceParam : DEFAULT_VOICE
    const rawRate = Number(params.get('rate') ?? -8)
    const rateNum = Math.max(-40, Math.min(20, Number.isFinite(rawRate) ? rawRate : -8))
    const rate = `${rateNum >= 0 ? '+' : ''}${rateNum}%`
    const timings = params.get('timings') === '1'

    if (!text) {
      res.statusCode = 400
      return res.end('missing text')
    }

    const { audio, boundaries } = await synthesize(text, voice, rate, timings)
    if (!audio.length) {
      res.statusCode = 502
      return res.end('empty audio')
    }

    res.setHeader('Content-Type', timings ? 'application/json; charset=utf-8' : 'audio/mpeg')
    // Deterministic output → cache aggressively at the edge and in the browser.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.statusCode = 200
    res.end(timings ? JSON.stringify({ audio: audio.toString('base64'), words: alignSpeechBoundaries(text, boundaries) }) : audio)
  } catch (err) {
    res.statusCode = 502
    res.end(`tts failed: ${(err as Error).message}`)
  }
}
