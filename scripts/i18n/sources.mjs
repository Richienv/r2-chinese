import fs from 'node:fs'
import path from 'node:path'

const pick = (object, keys) => Object.fromEntries(keys.filter((key) => typeof object?.[key] === 'string' && object[key]).map((key) => [key, object[key]]))
const at = (root, dotted) => dotted.split('.').reduce((node, key) => node?.[key], root)

export const SOURCES = {
  hsk4a: {
    files: () => [{ path: 'src/data/hsk4a.json', overlay: 'hsk4a' }],
    wanted: (p, key) => {
      if (p.startsWith('book.')) return false
      if (/^(en|heading_en|title_en|explanation|note|summary)$/.test(key)) return true
      return /\.(warmup|exercises)\.\d+$/.test(p)
    },
    kind: (p) => {
      if (/\.(warmup|exercises)\.\d+$/.test(p)) return 'exercise'
      if (/\.extras\.(compare|culture)\./.test(p) || /extras\.same_char\.\d+\.examples/.test(p)) return 'extras'
      if (/\.grammar\.\d+\./.test(p)) return 'grammar'
      if (/\.texts\.\d+\.lines\.\d+\.en$/.test(p) || /heading_en$/.test(p) || /\.title\.en$/.test(p) || /^contents\./.test(p)) return 'line'
      return 'gloss'
    },
    context: (root, p) => {
      const keys = p.split('.')
      const owner = at(root, keys.slice(0, -1).join('.'))
      return pick(owner, ['zh', 'pinyin', 'pos', 'speaker', 'point', 'title_zh', 'char', 'a', 'b', 'new_word'])
    },
  },
  teach: {
    files: () => fs.readdirSync('src/data/teach').filter((f) => /^lesson-\d+\.json$/.test(f)).sort().map((f) => ({ path: path.join('src/data/teach', f), overlay: f.replace(".json", "") })),
    wanted: (p, key) => /^(en|when|usage)$/.test(key) && !p.startsWith('title'),
    kind: (p) => /\.(when|usage)$/.test(p) ? 'hook' : /example\.en$/.test(p) ? 'line' : 'gloss',
    context: (root, p) => {
      const keys = p.split('.')
      const word = at(root, keys.slice(0, 2).join('.'))
      const owner = at(root, keys.slice(0, -1).join('.'))
      return { ...pick(word, ['zh', 'pinyin', 'pos']), ...(keys[keys.length - 2] === 'example' ? { line: owner.zh } : {}) }
    },
  },
  kerja: {
    files: () => fs.readdirSync('src/data/kerja/units').filter((f) => /^chapter-\d+\.json$/.test(f)).sort().map((f) => ({ path: path.join('src/data/kerja/units', f), overlay: 'kerja-' + f.replace('.json', '') })),
    wanted: (p, key) => /^(en|titleEn|headingEn|note|when|usage|body)$/.test(key),
    kind: (p) => courseKind(p),
    context: (root, p) => courseContext(root, p),
  },
  jiaocheng: {
    files: () => ['part1', 'part2'].flatMap((part) => fs.readdirSync(path.join('src/data/jiaocheng', part)).filter((f) => /^lesson-\d+\.json$/.test(f)).sort().map((f) => ({ path: path.join('src/data/jiaocheng', part, f), overlay: `jiaocheng-${part}-` + f.replace('.json', '') }))),
    wanted: (p, key) => /^(en|titleEn|headingEn|note|when|usage|body)$/.test(key),
    kind: (p) => courseKind(p),
    context: (root, p) => courseContext(root, p),
  },
  // Magang and Interview share one shape: chapters of sittings (and a beats copy of the same sittings). Both copies are
  // listed, and identical texts are translated once.
  magang: {
    files: () => fs.readdirSync('src/data/magang').filter((f) => /^ch-\d+\.json$/.test(f)).sort().map((f) => ({ path: path.join('src/data/magang', f), overlay: 'magang-' + f.replace('.json', '') })),
    wanted: (p) => guideWanted(p),
    kind: (p) => guideKind(p),
    context: (root, p) => guideContext(root, p),
  },
  interview: {
    files: () => fs.readdirSync('src/data/interview').filter((f) => /^ch-\d+\.json$/.test(f)).sort().map((f) => ({ path: path.join('src/data/interview', f), overlay: 'interview-' + f.replace('.json', '') })),
    wanted: (p) => guideWanted(p),
    kind: (p) => guideKind(p),
    context: (root, p) => guideContext(root, p),
  },
  // English note titles that the main extraction left out. Same files and overlays as kerja / jiaocheng.
  'kerja-notes': {
    files: () => SOURCES.kerja.files(),
    wanted: (p, key, value) => /^notes\.\d+\.title$/.test(p) && /[A-Za-z]{3,}/.test(value),
    kind: () => 'line',
    context: (root, p) => ({ ...pick(at(root, p.split('.').slice(0, 2).join('.')), ['body']), }),
  },
  'jiaocheng-notes': {
    files: () => SOURCES.jiaocheng.files(),
    wanted: (p, key, value) => /^notes\.\d+\.title$/.test(p) && /[A-Za-z]{3,}/.test(value),
    kind: () => 'line',
    context: () => ({}),
  },
}

/** Kerja and Jiaocheng share one JSON shape: words, dialogues (lines) and notes. */
function courseKind(p) {
  if (/\.(when|usage)$/.test(p)) return 'hook'
  if (/\.note$/.test(p) && /^words\./.test(p)) return 'note'
  if (/^words\.\d+\.en$/.test(p)) return 'gloss'
  if (/^notes\.\d+\.body$/.test(p)) return 'grammar'
  return 'line'
}

function courseContext(root, p) {
  const keys = p.split('.')
  const owner = at(root, keys.slice(0, -1).join('.'))
  const base = pick(owner, ['zh', 'pinyin', 'pos', 'speaker', 'title'])
  if (keys[0] === 'words') return { ...base, ...pick(at(root, keys.slice(0, 2).join('.')), ['zh', 'pinyin', 'pos']) }
  return base
}

/** Magang / Interview: chapter titles, sitting prose, quiz questions and options, and the gloss and hook of each term. */
function guideWanted(p) {
  return /^(partTitleEn|titleEn|when)$/.test(p)
    || /^(sittings|beats)\.\d+\.(titleEn|bodyEn|prompt)$/.test(p)
    || /^(sittings|beats)\.\d+\.choices\.\d+$/.test(p)
    || /^(sittings|beats)\.\d+\.terms\.\d+\.(en|hook)$/.test(p)
}

function guideKind(p) {
  if (/^(partTitleEn|titleEn|when)$/.test(p) || /\.titleEn$/.test(p)) return 'title'
  if (/\.bodyEn$/.test(p)) return 'body'
  if (/\.(prompt|choices\.\d+)$/.test(p)) return 'quiz'
  if (/\.terms\.\d+\.en$/.test(p)) return 'gloss'
  return 'hook'
}

function guideContext(root, p) {
  const keys = p.split('.')
  if (keys.length === 1) return { chapter: root.titleEn }
  const sitting = at(root, keys.slice(0, 2).join('.'))
  const base = { chapter: root.titleEn, title: sitting?.titleEn }
  if (keys[2] === 'terms') {
    const term = at(root, keys.slice(0, 4).join('.'))
    return { ...base, zh: term?.zh, ...(keys[4] === 'hook' ? { en: term?.en } : {}) }
  }
  if (keys[2] === 'choices') return { ...base, prompt: sitting?.prompt }
  return base
}
