import { IT_DOMAINS } from '@/types'

export interface Issue {
  where: string
  message: string
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr)
const CJK = /[㐀-鿿]/
// Âm tiết pinyin có dấu thanh / thanh nhẹ, hoặc token Latin/số thuần (ERP, MES, IP...)
const PINYIN_TOKEN = /^[a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/

/** Số "đơn vị đọc" của chuỗi hanzi: mỗi chữ Hán = 1, mỗi cụm Latin/số liền nhau = 1. */
export function countReadingUnits(hanzi: string): number {
  return (hanzi.match(/[㐀-鿿]|[A-Za-z0-9]+/g) ?? []).length
}

export function validateHskWord(w: any, where: string): Issue[] {
  const out: Issue[] = []
  const bad = (m: string) => out.push({ where, message: m })
  if (w == null || typeof w !== 'object') return [{ where, message: 'không phải object' }]
  if (!(isStr(w.id) || typeof w.id === 'number')) bad('id phải là string|number')
  if (![1, 2, 3, 4, 5, 6].includes(w.level)) bad('level phải là 1..6')
  for (const k of ['hanzi', 'traditional', 'radical', 'pinyin', 'numeric', 'meaning_vi', 'han_viet']) {
    if (!isStr(w[k])) bad(`${k} phải là string`)
  }
  if (isStr(w.hanzi) && !CJK.test(w.hanzi)) bad('hanzi không chứa chữ Hán')
  if (!isStrArr(w.pos)) bad('pos phải là string[]')
  if (!isStrArr(w.meanings_en) || w.meanings_en.length === 0) bad('meanings_en phải là string[] không rỗng')
  if (!Array.isArray(w.forms)) bad('forms phải là mảng')
  if (typeof w.frequency !== 'number') bad('frequency phải là number')
  return out
}

export function validateItTerm(t: any, where: string): Issue[] {
  const out: Issue[] = []
  const bad = (m: string) => out.push({ where, message: m })
  if (t == null || typeof t !== 'object') return [{ where, message: 'không phải object' }]
  for (const k of ['id', 'hanzi_sc', 'pinyin', 'vi', 'en', 'example_sc', 'example_pinyin', 'example_vi']) {
    if (!isStr(t[k]) || t[k].trim() === '') bad(`${k} phải là string không rỗng`)
  }
  if (!(IT_DOMAINS as readonly string[]).includes(t.domain)) bad(`domain không hợp lệ: ${t.domain}`)
  if (t.hanzi_tc !== undefined && !isStr(t.hanzi_tc)) bad('hanzi_tc phải là string nếu có')
  if (![1, 2, 3, 4, 5, 6].includes(t.hsk_max)) bad('hsk_max phải là 1..6 (6 = ngoài HSK1-5)')
  if (typeof t.reviewed !== 'boolean') bad('reviewed phải là boolean')

  if (isStr(t.hanzi_sc) && isStr(t.pinyin)) {
    const tokens = t.pinyin.trim().split(/\s+/)
    const units = countReadingUnits(t.hanzi_sc)
    if (tokens.length !== units) {
      bad(`pinyin có ${tokens.length} âm tiết nhưng hanzi_sc có ${units} đơn vị đọc ("${t.hanzi_sc}")`)
    }
    for (const tk of tokens) {
      if (!PINYIN_TOKEN.test(tk) && !/^[A-Za-z0-9]+$/.test(tk)) bad(`token pinyin lạ: "${tk}"`)
    }
  }
  if (isStr(t.example_sc) && isStr(t.example_pinyin)) {
    const units = countReadingUnits(t.example_sc)
    const tokens = t.example_pinyin.replace(/[，。！？、；：,.!?;:]/g, ' ').trim().split(/\s+/).filter(Boolean)
    if (tokens.length !== units) {
      bad(`example_pinyin có ${tokens.length} âm tiết nhưng example_sc có ${units} đơn vị đọc`)
    }
  }
  return out
}

/** Kiểm tra trùng id trong một tập (trả về các id bị trùng). */
export function findDuplicateIds(ids: Array<string | number>): Array<string | number> {
  const seen = new Set<string | number>()
  const dup = new Set<string | number>()
  for (const id of ids) (seen.has(id) ? dup : seen).add(id)
  return [...dup]
}

export function validateReading(p: any, where: string): Issue[] {
  const out: Issue[] = []
  const bad = (m: string) => out.push({ where, message: m })
  if (p == null || typeof p !== 'object') return [{ where, message: 'không phải object' }]
  for (const k of ['id', 'title', 'translation_vi']) if (!isStr(p[k]) || !p[k].trim()) bad(`${k} phải là string không rỗng`)
  if (!['error', 'request', 'notice', 'report'].includes(p.kind)) bad(`kind không hợp lệ: ${p.kind}`)
  if (typeof p.reviewed !== 'boolean') bad('reviewed phải là boolean')
  if (!Array.isArray(p.tokens) || p.tokens.length === 0) return [...out, { where, message: 'tokens phải là mảng không rỗng' }]
  p.tokens.forEach((tk: any, i: number) => {
    const w = `${where}.tokens[${i}]`
    if (!isStr(tk?.t) || !tk.t) return out.push({ where: w, message: 't phải là string không rỗng' })
    const units = countReadingUnits(tk.t)
    if (units === 0) {
      if (tk.py) out.push({ where: w, message: 'dấu câu không có pinyin' })
      return
    }
    if (!isStr(tk.py)) return out.push({ where: w, message: `thiếu py cho "${tk.t}"` })
    const n = tk.py.trim().split(/\s+/).length
    if (n !== units) out.push({ where: w, message: `py có ${n} âm tiết nhưng "${tk.t}" có ${units}` })
    if (!isStr(tk.vi) || !tk.vi) out.push({ where: w, message: `thiếu vi cho "${tk.t}"` })
  })
  return out
}

const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])

export function validateScenario(s: any, where: string): Issue[] {
  const out: Issue[] = []
  const bad = (m: string) => out.push({ where, message: m })
  if (s == null || typeof s !== 'object') return [{ where, message: 'không phải object' }]
  for (const k of ['id', 'title', 'with']) if (!isStr(s[k]) || !s[k].trim()) bad(`${k} phải là string không rỗng`)
  if (!(IT_DOMAINS as readonly string[]).includes(s.domain)) bad(`domain không hợp lệ: ${s.domain}`)
  if (typeof s.reviewed !== 'boolean') bad('reviewed phải là boolean')
  if (!Array.isArray(s.lines) || s.lines.length < 2) return [...out, { where, message: 'cần ít nhất 2 câu thoại' }]
  if (!s.lines.some((l: any) => l?.who === 'm')) bad('phải có ít nhất một câu của vai người dùng (who=m)')
  s.lines.forEach((l: any, i: number) => {
    const w = `${where}.lines[${i}]`
    if (!['o', 'm'].includes(l?.who)) out.push({ where: w, message: 'who phải là o hoặc m' })
    for (const k of ['sc', 'py', 'vi']) if (!isStr(l?.[k]) || !l[k].trim()) out.push({ where: w, message: `${k} phải là string không rỗng` })
    if (isStr(l?.sc) && isStr(l?.py)) {
      const units = countReadingUnits(l.sc)
      const n = l.py.trim().split(/\s+/).length
      if (n !== units) out.push({ where: w, message: `py có ${n} âm tiết nhưng sc có ${units} đơn vị đọc ("${l.sc}")` })
    }
  })
  return out
}

export function validateTemplate(t: any, where: string): Issue[] {
  const out: Issue[] = []
  const bad = (m: string) => out.push({ where, message: m })
  if (t == null || typeof t !== 'object') return [{ where, message: 'không phải object' }]
  for (const k of ['id', 'title', 'when', 'sc', 'vi']) if (!isStr(t[k]) || !t[k].trim()) bad(`${k} phải là string không rỗng`)
  if (!['wechat', 'email'].includes(t.channel)) bad('channel phải là wechat hoặc email')
  if (typeof t.reviewed !== 'boolean') bad('reviewed phải là boolean')
  if (!Array.isArray(t.vars)) return [...out, { where, message: 'vars phải là mảng' }]
  const keys = t.vars.map((v: any) => v?.key)
  for (const d of findDuplicateIds(keys)) bad(`trùng key biến: ${d}`)
  for (const v of t.vars) {
    if (!isStr(v?.key) || !isStr(v?.label)) bad('mỗi biến cần key và label')
    if (!Array.isArray(v?.options) || v.options.length === 0) bad(`biến ${v?.key} cần ít nhất một lựa chọn`)
    else for (const o of v.options) if (!isStr(o?.sc) || !isStr(o?.vi)) bad(`lựa chọn của ${v.key} cần sc và vi`)
  }
  if (isStr(t.sc) && isStr(t.vi)) {
    const a = new Set(placeholders(t.sc))
    const b = new Set(placeholders(t.vi))
    for (const k of a) if (!keys.includes(k)) bad(`sc dùng biến chưa khai báo: ${k}`)
    for (const k of b) if (!keys.includes(k)) bad(`vi dùng biến chưa khai báo: ${k}`)
    for (const k of keys) {
      if (!a.has(k)) bad(`biến ${k} không có trong sc`)
      if (!b.has(k)) bad(`biến ${k} không có trong vi`)
    }
  }
  return out
}

export function validateGrammar(g: any, where: string): Issue[] {
  const out: Issue[] = []
  const bad = (m: string) => out.push({ where, message: m })
  if (g == null || typeof g !== 'object') return [{ where, message: 'không phải object' }]
  for (const k of ['id', 'title', 'pattern', 'explain']) if (!isStr(g[k]) || !g[k].trim()) bad(`${k} phải là string không rỗng`)
  if (typeof g.reviewed !== 'boolean') bad('reviewed phải là boolean')
  const m = g.mistake
  if (!m || !isStr(m.wrong) || !isStr(m.right) || !isStr(m.why) || m.wrong === m.right) bad('mistake cần wrong, right (khác nhau) và why')
  const checkPy = (sc: string, py: string, w: string) => {
    const units = countReadingUnits(sc)
    const n = py.trim().split(/\s+/).length
    if (n !== units) out.push({ where: w, message: `py có ${n} âm tiết nhưng câu có ${units} đơn vị đọc ("${sc}")` })
  }
  if (!Array.isArray(g.examples) || g.examples.length === 0) bad('cần ít nhất một ví dụ')
  else g.examples.forEach((e: any, i: number) => {
    if (!isStr(e?.sc) || !isStr(e?.py) || !isStr(e?.vi)) return out.push({ where: `${where}.examples[${i}]`, message: 'cần sc, py, vi' })
    checkPy(e.sc, e.py, `${where}.examples[${i}]`)
  })
  if (!Array.isArray(g.exercises)) bad('exercises phải là mảng')
  else g.exercises.forEach((e: any, i: number) => {
    const w = `${where}.exercises[${i}]`
    if (!isStrArr(e?.tokens) || e.tokens.length < 3) return out.push({ where: w, message: 'tokens cần ít nhất 3 mảnh' })
    if (!isStr(e?.py) || !isStr(e?.vi)) return out.push({ where: w, message: 'cần py và vi' })
    checkPy(e.tokens.join(''), e.py, w)
  })
  return out
}

export function validateDialogue(d: any, topicIds: Set<string>, where: string): Issue[] {
  const out: Issue[] = []
  const bad = (m: string) => out.push({ where, message: m })
  if (d == null || typeof d !== 'object') return [{ where, message: 'không phải object' }]
  if (!isStr(d.id) || !d.id) bad('thiếu id')
  if (!topicIds.has(d.topic)) bad(`chủ đề không tồn tại: ${d.topic}`)
  if (![1, 2, 3, 4, 5, 6].includes(d.level)) bad('level phải là 1..6')
  if (![1, 2, 3, 4, 5, 6].includes(d.maxLevel) || d.maxLevel < d.level) bad('maxLevel phải là 1..6 và không nhỏ hơn level')
  if (typeof d.reviewed !== 'boolean') bad('reviewed phải là boolean')
  if (!Array.isArray(d.lines) || d.lines.length < 2) return [...out, { where, message: 'cần ít nhất 2 câu' }]
  if (!d.lines.some((l: any) => l?.who === 'm')) bad('cần ít nhất một câu của vai người dùng (who=m)')
  d.lines.forEach((l: any, i: number) => {
    const w = `${where}.lines[${i}]`
    if (!['o', 'm'].includes(l?.who)) out.push({ where: w, message: 'who phải là o hoặc m' })
    for (const k of ['sc', 'py', 'vi']) if (!isStr(l?.[k]) || !l[k].trim()) out.push({ where: w, message: `${k} rỗng` })
    if (isStr(l?.sc) && isStr(l?.py)) {
      const units = countReadingUnits(l.sc)
      const n = l.py.trim().split(/\s+/).length
      if (n !== units) out.push({ where: w, message: `py ${n} âm tiết, sc ${units} đơn vị ("${l.sc}")` })
    }
  })
  return out
}
