import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { findDuplicateIds, validateHskWord, validateItTerm, validateReading, validateScenario, validateTemplate, validateGrammar, validateDialogue, type Issue } from '../src/lib/schema'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')
const issues: Issue[] = []
const hskIds: Array<string | number> = []
let hskCount = 0

for (let lv = 1; lv <= 6; lv++) {
  const file = join(root, `hsk${lv}.json`)
  if (!existsSync(file)) {
    issues.push({ where: `hsk${lv}.json`, message: 'thiếu file' })
    continue
  }
  const arr = JSON.parse(readFileSync(file, 'utf8'))
  if (!Array.isArray(arr)) {
    issues.push({ where: `hsk${lv}.json`, message: 'phải là mảng' })
    continue
  }
  arr.forEach((w, i) => {
    issues.push(...validateHskWord(w, `hsk${lv}.json[${i}] id=${w?.id}`))
    if (w?.level !== lv) issues.push({ where: `hsk${lv}.json[${i}]`, message: `level=${w?.level} nằm sai file` })
    hskIds.push(w?.id)
  })
  hskCount += arr.length
}
for (const d of findDuplicateIds(hskIds)) issues.push({ where: 'hsk*', message: `trùng id: ${d}` })

const itFile = join(root, 'it', 'terms.json')
const terms = JSON.parse(readFileSync(itFile, 'utf8'))
terms.forEach((t: any, i: number) => issues.push(...validateItTerm(t, `terms.json[${i}] id=${t?.id}`)))
for (const d of findDuplicateIds(terms.map((t: any) => t.id))) issues.push({ where: 'terms.json', message: `trùng id: ${d}` })

const readings = JSON.parse(readFileSync(join(root, "it", "reading.json"), "utf8"))
readings.forEach((p: any, i: number) => issues.push(...validateReading(p, `reading.json[${i}] id=${p?.id}`)))
for (const d of findDuplicateIds(readings.map((p: any) => p.id))) issues.push({ where: "reading.json", message: `trùng id: ${d}` })

const scenarios = JSON.parse(readFileSync(join(root, "it", "scenarios.json"), "utf8"))
scenarios.forEach((p: any, i: number) => issues.push(...validateScenario(p, `scenarios.json[${i}] id=${p?.id}`)))
for (const d of findDuplicateIds(scenarios.map((p: any) => p.id))) issues.push({ where: "scenarios.json", message: `trùng id: ${d}` })
const templates = JSON.parse(readFileSync(join(root, "it", "templates.json"), "utf8"))
templates.forEach((p: any, i: number) => issues.push(...validateTemplate(p, `templates.json[${i}] id=${p?.id}`)))
for (const d of findDuplicateIds(templates.map((p: any) => p.id))) issues.push({ where: "templates.json", message: `trùng id: ${d}` })

const grammar = JSON.parse(readFileSync(join(root, "it", "grammar.json"), "utf8"))
grammar.forEach((p: any, i: number) => issues.push(...validateGrammar(p, `grammar.json[${i}] id=${p?.id}`)))
for (const d of findDuplicateIds(grammar.map((p: any) => p.id))) issues.push({ where: "grammar.json", message: `trùng id: ${d}` })

const dlg = JSON.parse(readFileSync(join(root, "dialogues.json"), "utf8"))
const topicIds = new Set<string>(dlg.topics.map((t: any) => t.id))
dlg.items.forEach((d: any, i: number) => issues.push(...validateDialogue(d, topicIds, `dialogues.json[${i}] id=${d?.id}`)))
for (const d of findDuplicateIds(dlg.items.map((d: any) => d.id))) issues.push({ where: "dialogues.json", message: `trùng id: ${d}` })
for (const d of findDuplicateIds(terms.map((t: any) => t.hanzi_sc))) issues.push({ where: "terms.json", message: `trùng hanzi_sc: ${d}` })

const grammarHsk = JSON.parse(readFileSync(join(root, "grammar-hsk.json"), "utf8"))
grammarHsk.forEach((p: any, i: number) => {
  issues.push(...validateGrammar(p, `grammar-hsk.json[${i}] id=${p?.id}`))
  if (![1, 2, 3, 4, 5].includes(p?.hsk)) issues.push({ where: `grammar-hsk.json[${i}]`, message: 'hsk phải là 1..5' })
})
for (const d of findDuplicateIds([...grammar, ...grammarHsk].map((p: any) => p.id))) issues.push({ where: "grammar*.json", message: `trùng id: ${d}` })

const perDomain: Record<string, number> = {}
for (const t of terms) perDomain[t.domain] = (perDomain[t.domain] ?? 0) + 1

console.log(`HSK: ${hskCount} từ | IT: ${terms.length} thuật ngữ | Bài đọc: ${readings.length} | Kịch bản: ${scenarios.length} | Mẫu tin: ${templates.length} | Ngữ pháp: ${grammar.length} công sở + ${grammarHsk.length} HSK | Hội thoại: ${dlg.items.length} (${dlg.items.reduce((n: number, d: any) => n + d.lines.length, 0)} câu)`)
console.log('IT theo domain:', perDomain)
if (issues.length) {
  console.error(`\n${issues.length} lỗi:`)
  for (const i of issues) console.error(` - [${i.where}] ${i.message}`)
  process.exit(1)
}
console.log('Dữ liệu hợp lệ ✔')
