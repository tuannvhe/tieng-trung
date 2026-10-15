/**
 * Dựng src/data/grammar-hsk.json từ src/data/grammar-hsk-src.json: thêm pinyin cho ví dụ và bài sắp xếp câu.
 * Dùng cùng bảng ghi đè viết tay src/data/pinyin-overrides.json như kho hội thoại.
 * Chạy: npx tsx scripts/build-grammar.ts [--show]   (--show in pinyin để rà soát)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { customPinyin, pinyin } from 'pinyin-pro'

const data = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data')
customPinyin(JSON.parse(readFileSync(join(data, 'pinyin-overrides.json'), 'utf8')))

function toPinyin(sc: string): string {
  const out: string[] = []
  for (const run of sc.match(/[㐀-鿿]+|[A-Za-z0-9]+/g) ?? []) {
    if (!/[㐀-鿿]/.test(run[0])) out.push(run)
    else out.push(...(pinyin(run, { toneType: 'symbol', type: 'array' }) as string[]))
  }
  return out.join(' ')
}

const src = JSON.parse(readFileSync(join(data, 'grammar-hsk-src.json'), 'utf8'))
const out = src.map((g: any) => ({
  ...g,
  reviewed: false,
  examples: g.examples.map((e: any) => ({ ...e, py: toPinyin(e.sc) })),
  exercises: g.exercises.map((e: any) => ({ ...e, py: toPinyin(e.tokens.join('')) })),
}))
writeFileSync(join(data, 'grammar-hsk.json'), JSON.stringify(out))
console.log(`Đã dựng ${out.length} mẫu ngữ pháp HSK, ${out.reduce((n: number, g: any) => n + g.exercises.length, 0)} bài sắp xếp câu`)
if (process.argv.includes('--show')) {
  for (const g of out) {
    for (const e of g.examples) console.log(`${g.hsk} ${e.sc}  →  ${e.py}`)
    for (const e of g.exercises) console.log(`${g.hsk} [bài] ${e.tokens.join('')}  →  ${e.py}`)
  }
}
