// Lists user-visible English in source files: JSX text, text-bearing attributes, and string
// literals inside JSX expressions. Used to hand out work and to find strings not yet wrapped in t().
import ts from 'typescript'
import fs from 'node:fs'
import path from 'node:path'

const ATTRS = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label', 'aria-description', 'aria-valuetext', 'sub', 'hint', 'heading', 'name'])
const ENGLISH = /[A-Za-z]{2,}/
export function scan(file) {
  const text = fs.readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const found = []
  const line = (node) => source.getLineAndCharacterOfPosition(node.getStart()).line + 1
  const insideT = (node) => { for (let p = node.parent; p; p = p.parent) if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && p.expression.text === 't') return true; return false }
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const value = node.getText().replace(/\s+/g, ' ').trim()
      if (value && ENGLISH.test(value) && !/^[{}\s·•|/\\→←↗↻+\-–—:,.;!?()0-9]+$/.test(value)) found.push({ file, line: line(node), kind: 'jsx', text: value })
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && ATTRS.has(node.name.getText())) {
      if (ENGLISH.test(node.initializer.text) && !insideT(node)) found.push({ file, line: line(node), kind: `attr:${node.name.getText()}`, text: node.initializer.text })
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !insideT(node)) {
      // a literal that sits in a JSX expression, i.e. {cond ? 'On' : 'Off'}
      let p = node.parent, inJsx = false
      while (p && !ts.isSourceFile(p)) { if (ts.isJsxExpression(p)) { inJsx = true; break } if (ts.isJsxAttribute(p) || ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) break; p = p.parent }
      if (inJsx && ENGLISH.test(node.text) && node.text.length > 1 && !/^[a-z-]+$/.test(node.text)) found.push({ file, line: line(node), kind: 'expr', text: node.text })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}
const roots = process.argv.slice(2)
if (roots.length) {
  const files = roots.flatMap((r) => fs.statSync(r).isDirectory() ? fs.readdirSync(r).filter((f) => /\.tsx$/.test(f)).map((f) => path.join(r, f)) : [r])
  let total = 0
  for (const file of files) { const items = scan(file); total += items.length; console.log(`${items.length}\t${file}`) }
  console.log(`${total}\ttotal`)
}
