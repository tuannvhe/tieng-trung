import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parsePaper } from '@/lib/mock-paper'

describe('đề mẫu trong thư mục samples', () => {
  const files = readdirSync('samples').filter((f) => f.endsWith('.json'))
  it.each(files)('%s hợp lệ', (f) => {
    const r = parsePaper(readFileSync(`samples/${f}`, 'utf8'))
    expect(r.errors).toEqual([])
    expect(r.exam!.questions.length).toBeGreaterThan(0)
  })
})
