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

function synthesize(text: string, voice: string, rate: string): Promise<Buffer> {
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
    const timer = setTimeout(() => {
      ws.terminate()
      reject(new Error('tts timeout'))
    }, 12_000)

    ws.on('open', () => {
      const now = new Date().toISOString()
      ws.send(
        `X-Timestamp:${now}\r\nContent-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`,
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
        // frame = [uint16 header length][header text][audio bytes]
        const headerLen = buf.readUInt16BE(0)
        chunks.push(buf.subarray(2 + headerLen))
      } else {
        if (data.toString().includes('Path:turn.end')) {
          clearTimeout(timer)
          ws.close()
          resolve(Buffer.concat(chunks))
        }
      }
    })

    ws.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

export default async function handler(req: any, res: any) {
  try {
    const params = new URL(req.url, 'http://localhost').searchParams
    const text = (params.get('text') ?? '').slice(0, 400).trim()
    const voiceParam = params.get('voice') ?? DEFAULT_VOICE
    const voice = ALLOWED_VOICES.has(voiceParam) ? voiceParam : DEFAULT_VOICE
    const rateNum = Math.max(-40, Math.min(20, Number(params.get('rate') ?? -8)))
    const rate = `${rateNum >= 0 ? '+' : ''}${rateNum}%`

    if (!text) {
      res.statusCode = 400
      return res.end('missing text')
    }

    const audio = await synthesize(text, voice, rate)
    if (!audio.length) {
      res.statusCode = 502
      return res.end('empty audio')
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    // Deterministic output → cache aggressively at the edge and in the browser.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.statusCode = 200
    res.end(audio)
  } catch (err) {
    res.statusCode = 502
    res.end(`tts failed: ${(err as Error).message}`)
  }
}
