// Reports English strings that two dictionary files translate differently, since the merged dictionary keeps only one.
import fs from 'node:fs'
import path from 'node:path'
import { loadDictionary } from './check-dictionary.mjs'

const dir = 'src/i18n/id'
const seen = new Map()
let conflicts = 0
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts')).sort()) {
  const entries = await loadDictionary(path.join(dir, file))
  for (const [english, indonesian] of entries) {
    const before = seen.get(english)
    if (before && before.indonesian !== indonesian) { conflicts++; console.log(`${JSON.stringify(english)}\n   ${before.file}: ${before.indonesian}\n   ${file}: ${indonesian}`) }
    else if (!before) seen.set(english, { file, indonesian })
  }
}
console.log(conflicts ? `${conflicts} conflict(s)` : `no conflicts in ${seen.size} entries`)
process.exit(conflicts ? 1 : 0)
