// Tải danh sách HSK 2.0 cấp 6 (2500 từ) từ drkameleon/complete-hsk-vocabulary (MIT) và ghi src/data/hsk6.json
// theo cùng cấu trúc với hsk1..hsk5.json.   npm run hsk6
// Phần nghĩa tiếng Việt và âm Hán Việt để trống (người dùng tự điền hoặc giáo viên bổ sung), nghĩa tiếng Anh lấy từ CC-CEDICT qua nguồn trên.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

interface SrcForm {
  t: string
  i: { y: string; n: string }
  m: string[]
  c: string[]
}
interface SrcWord {
  s: string
  r: string
  q: number
  p: string[]
  f: SrcForm[]
}

const URL6 = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/exclusive/old/6.min.json'
const res = await fetch(URL6)
if (!res.ok) throw new Error(`Không tải được HSK 6: ${res.status}`)
const src = (await res.json()) as SrcWord[]

const seen = new Set<string>()
const words = src
  .filter((w) => w.f.length > 0 && !seen.has(w.s) && !!seen.add(w.s))
  .map((w, k) => {
    const main = w.f[0]
    return {
      id: `hsk6-${String(k + 1).padStart(4, '0')}`,
      level: 6,
      unit: Math.floor(k / 100) + 1,
      hanzi: w.s,
      traditional: main.t,
      radical: w.r,
      pos: w.p,
      frequency: w.q,
      pinyin: main.i.y,
      numeric: main.i.n,
      meanings_en: main.m,
      // Giống các cấp trước: chỉ ghi forms khi chữ có nhiều cách đọc
      forms: w.f.length > 1 ? w.f.map((f) => ({ pinyin: f.i.y, numeric: f.i.n, meanings: f.m, classifiers: f.c })) : [],
      meaning_vi: '',
      han_viet: '',
    }
  })

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'hsk6.json')
writeFileSync(file, JSON.stringify(words))
console.log(`Đã ghi ${words.length} từ HSK 6 vào src/data/hsk6.json`)
