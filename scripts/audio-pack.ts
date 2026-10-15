// Công cụ cho gói âm thanh người thật.
//   npm run audio -- list [--level=N] [--kind=dialogue|hsk|it]   ghi audio-todo.csv: danh sách câu cần thu, kèm tên file
//   npm run audio -- manifest                                    quét public/audio, ghi manifest.json, báo độ phủ và file thừa
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { audioKey } from '../src/lib/audio-pack'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const audioDir = join(root, 'public', 'audio')
const read = (p: string) => JSON.parse(readFileSync(join(root, 'src', 'data', p), 'utf8'))
const EXT = /\.(mp3|ogg|m4a|wav)$/i

interface Item {
  kind: string
  level: number
  text: string
  pinyin: string
  vi: string
}

function collect(): Item[] {
  const out: Item[] = []
  for (let lv = 1; lv <= 6; lv++)
    for (const w of read(`hsk${lv}.json`) as Array<{ hanzi: string; pinyin: string; meanings_en: string[] }>)
      out.push({ kind: 'hsk', level: lv, text: w.hanzi, pinyin: w.pinyin, vi: w.meanings_en[0] ?? '' })
  for (const t of read('it/terms.json') as Array<{ hanzi_sc: string; pinyin: string; vi: string; hsk_max: number }>)
    out.push({ kind: 'it', level: t.hsk_max, text: t.hanzi_sc, pinyin: t.pinyin, vi: t.vi })
  for (const d of read('dialogues.json').items as Array<{ level: number; lines: Array<{ sc: string; py: string; vi: string }> }>)
    for (const l of d.lines) out.push({ kind: 'dialogue', level: d.level, text: l.sc, pinyin: l.py, vi: l.vi })
  return out
}

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1]
const cmd = process.argv[2]

if (cmd === 'list') {
  const kind = arg('kind')
  const level = arg('level')
  const seen = new Set<string>()
  const existing = existsSync(audioDir) ? new Set(readdirSync(audioDir).filter((f) => EXT.test(f)).map((f) => f.replace(EXT, ''))) : new Set<string>()
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`
  const rows = ['file,kind,level,text,pinyin,vi,recorded']
  for (const it of collect()) {
    if ((kind && it.kind !== kind) || (level && String(it.level) !== level)) continue
    const key = audioKey(it.text)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push([q(key + '.mp3'), it.kind, it.level, q(it.text), q(it.pinyin), q(it.vi), existing.has(key) ? 'yes' : 'no'].join(','))
  }
  writeFileSync(join(root, 'audio-todo.csv'), '﻿' + rows.join('\n'))
  console.log(`Đã ghi audio-todo.csv: ${rows.length - 1} mục cần thu (đã có file: ${rows.filter((r) => r.endsWith(',yes')).length}).`)
} else if (cmd === 'manifest') {
  mkdirSync(audioDir, { recursive: true })
  const wanted = new Set(collect().map((i) => audioKey(i.text)))
  const manifest: Record<string, string> = {}
  const orphans: string[] = []
  for (const f of readdirSync(audioDir).filter((f) => EXT.test(f))) {
    const key = f.replace(EXT, '')
    if (wanted.has(key)) manifest[key] = f
    else orphans.push(f)
  }
  writeFileSync(join(audioDir, 'manifest.json'), JSON.stringify(manifest, null, 1))
  console.log(`manifest.json: ${Object.keys(manifest).length}/${wanted.size} mục có file thu âm.`)
  if (orphans.length) console.log(`Cảnh báo: ${orphans.length} file không khớp mục nào (sai tên hoặc nội dung đã đổi): ${orphans.slice(0, 5).join(', ')}${orphans.length > 5 ? '…' : ''}`)
} else {
  console.log('Cách dùng: npm run audio -- list [--kind=dialogue|hsk|it] [--level=N]  |  npm run audio -- manifest')
}
