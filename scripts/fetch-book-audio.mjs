#!/usr/bin/env node
/**
 * Downloads the publisher's own recordings for HSK Standard Course 4A into
 * public/audio/hsk4a/. These are the audio files that ship with the textbook,
 * offered free (0 points) by Beijing Language and Culture University Press:
 * https://www.blcup.com/Res/ResInfo?rid=55014
 *
 * The recordings are the publisher's copyright. They are kept in this
 * repository for the owner's personal study (see public/audio/hsk4a/NOTICE.txt).
 * This script re-fetches them if they are ever missing or need refreshing:
 *
 *   node scripts/fetch-book-audio.mjs
 *
 * Re-running skips files that already downloaded completely.
 */
import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SERIES = 'http://www.blcup.com/MobileResSeries?rid=009861d5-008b-495d-ae7a-23482ec05ad7'
const DOWNLOAD = 'http://www.blcup.com/Common/DownRes?doi='
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/audio/hsk4a')
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' }
const MIN_BYTES = 100_000
const CONCURRENCY = 3

async function get(url, attempts = 4) {
  let last
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(120_000), redirect: 'follow' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (error) {
      last = error
      await new Promise((resolve) => setTimeout(resolve, 1500 * i))
    }
  }
  throw last
}

/** The series page lists "HSK标准教程4上 01-3" style titles with their resource ids. */
async function trackList() {
  const html = await (await get(SERIES)).text()
  const tracks = []
  for (const match of html.matchAll(/href="\/MobileResource\?rid=([0-9a-f-]{36})"[^>]*>([\s\S]*?)<\/a>/g)) {
    const title = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    const lesson = title.match(/4上\s*(\d\d)-(\d)\s*mp3/i)
    if (lesson) tracks.push({ id: match[1], name: `L${lesson[1]}-${lesson[2]}.mp3` })
  }
  return tracks
}

async function download(track) {
  const target = path.join(OUT, track.name)
  const have = await stat(target).then((s) => s.size, () => 0)
  if (have >= MIN_BYTES) return 'cached'
  const bytes = Buffer.from(await (await get(DOWNLOAD + track.id)).arrayBuffer())
  // A truncated or HTML error body must never be saved as audio.
  const looksLikeMp3 = bytes.length >= MIN_BYTES && (bytes.subarray(0, 3).toString('latin1') === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))
  if (!looksLikeMp3) throw new Error(`${track.name}: not an mp3 (${bytes.length} bytes)`)
  await writeFile(`${target}.part`, bytes)
  await rename(`${target}.part`, target)
  return 'downloaded'
}

await mkdir(OUT, { recursive: true })
const tracks = await trackList()
if (tracks.length !== 50) {
  console.error(`Expected 50 lesson tracks (10 lessons x 5 texts) but the publisher page listed ${tracks.length}.`)
  process.exit(1)
}
let failed = 0
let next = 0
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < tracks.length) {
    const track = tracks[next++]
    try { console.log(`${track.name}  ${await download(track)}`) }
    catch (error) { failed++; console.error(`${track.name}  FAILED  ${error.message}`) }
  }
}))
console.log(failed ? `${failed} file(s) failed. Re-run to retry them.` : `All ${tracks.length} recordings are in ${path.relative(process.cwd(), OUT)}.`)
process.exit(failed ? 1 : 0)
