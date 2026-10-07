// Usage: node scripts/i18n/check-chunk.mjs <chunk.json> <out.json>
// Validates a translated chunk: every id present, Chinese and numbering untouched, no leftover English, sane length.
import fs from 'node:fs'

const HAN = /[㐀-鿿＀-￯　-〿]/gu
const MARKS = /[0-9①-⑳⑴-⒇＿_]|\([0-9a-zA-Z]\)/gu
const STOP = new Set('the and is are of to a an in with for that this it when which use used after before from by as be can not only also but or'.split(' '))
const sorted = (s, re) => [...(s.match(re) ?? [])].sort().join('')

export function validate(chunk, out) {
  const problems = []
  for (const item of chunk.items) {
    const id = String(item.id)
    const got = out[id]
    const tag = `#${id} ${JSON.stringify(item.text.slice(0, 50))}`
    if (typeof got !== 'string' || !got.trim()) { problems.push(`MISSING ${tag}`); continue }
    if (sorted(item.text, HAN) !== sorted(got, HAN)) problems.push(`CHINESE CHANGED ${tag}\n   -> ${got.slice(0, 160)}`)
    if (sorted(item.text, MARKS) !== sorted(got, MARKS)) problems.push(`NUMBERS/MARKS CHANGED ${tag}\n   -> ${got.slice(0, 160)}`)
    const english = item.text.replace(HAN, ' ')
    // Single letters are dialogue speakers (A：B：) and option labels, not English words.
    const words = (got.replace(HAN, ' ').toLowerCase().match(/[a-z']+/g) ?? []).filter((word) => word.length >= 2)
    const stops = words.filter((w) => STOP.has(w)).length
    if (words.length >= 6 && stops / words.length > 0.2) problems.push(`STILL ENGLISH? ${tag}\n   -> ${got.slice(0, 160)}`)
    if (got === item.text && /[A-Za-z]{3,}\s+[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(english)) problems.push(`UNCHANGED ${tag}`)
    if (item.text.length > 40 && (got.length < item.text.length * 0.35 || got.length > item.text.length * 2.8)) problems.push(`LENGTH ${tag} ${item.text.length} -> ${got.length}`)
    if (/\{|\}/.test(got) !== /\{|\}/.test(item.text)) problems.push(`BRACES ${tag}`)
  }
  const known = new Set(chunk.items.map((item) => String(item.id)))
  for (const id of Object.keys(out)) if (!known.has(id)) problems.push(`UNKNOWN ID ${id}`)
  return problems
}

if (process.argv[1].endsWith('check-chunk.mjs') && process.argv.length >= 4) {
  const chunk = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
  const out = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
  const problems = validate(chunk, out)
  console.log(problems.length ? problems.join('\n') + `\n${problems.length} problem(s) in ${chunk.items.length} items` : `ok: ${chunk.items.length} items`)
  process.exit(problems.length ? 1 : 0)
}
