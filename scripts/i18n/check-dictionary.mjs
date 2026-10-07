// Usage: node scripts/i18n/check-dictionary.mjs <dictionary.ts> <source files...>
// Checks that every t('literal') in the sources has an entry in the dictionary, that each entry's placeholders match,
// and that t() is only ever called with a string literal.
import ts from 'typescript'
import fs from 'node:fs'

export function literalsIn(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found = []
  const bad = []
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't' && node.arguments.length) {
      const arg = node.arguments[0]
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) found.push({ file, line, text: arg.text })
      else bad.push({ file, line, text: arg.getText() })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { found, bad }
}

export function placeholders(text) { return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',') }

export async function loadDictionary(file) {
  const text = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const entries = new Map()
  const visit = (node) => {
    if (ts.isPropertyAssignment(node) && (ts.isStringLiteral(node.name) || ts.isNoSubstitutionTemplateLiteral(node.name)) && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) entries.set(node.name.text, node.initializer.text)
    ts.forEachChild(node, visit)
  }
  visit(source)
  return entries
}

if (process.argv[1].endsWith('check-dictionary.mjs') && process.argv.length > 3) {
  const [dictionaryFile, ...files] = process.argv.slice(2)
  const dictionary = await loadDictionary(dictionaryFile)
  let problems = 0
  const used = new Set()
  for (const file of files) {
    const { found, bad } = literalsIn(file)
    for (const item of bad) { console.log(`NOT A LITERAL  ${item.file}:${item.line}  t(${item.text})`); problems++ }
    for (const item of found) {
      used.add(item.text)
      if (!dictionary.has(item.text)) { console.log(`MISSING  ${item.file}:${item.line}  ${JSON.stringify(item.text)}`); problems++ }
    }
  }
  for (const [english, indonesian] of dictionary) {
    if (placeholders(english) !== placeholders(indonesian)) { console.log(`PLACEHOLDERS  ${JSON.stringify(english)} -> ${JSON.stringify(indonesian)}`); problems++ }
    if (!indonesian.trim()) { console.log(`EMPTY  ${JSON.stringify(english)}`); problems++ }
    if (!used.has(english)) console.log(`unused (ok if used elsewhere)  ${JSON.stringify(english)}`)
  }
  console.log(problems ? `${problems} problem(s)` : `ok: ${used.size} strings, ${dictionary.size} entries`)
  process.exit(problems ? 1 : 0)
}
