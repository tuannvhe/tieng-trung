import { describe, expect, it } from 'vitest'
import { gradeMock } from '@/lib/mock'
import { MAX_PAPER_QUESTIONS, PAPER_TEMPLATE, parsePaper, type Paper } from '@/lib/mock-paper'

const clone = (): Paper => JSON.parse(JSON.stringify(PAPER_TEMPLATE))
const parse = (p: unknown) => parsePaper(JSON.stringify(p))

describe('nạp đề từ file', () => {
  it('đề mẫu hợp lệ, dựng đúng cấu trúc và chấm được', () => {
    const r = parse(PAPER_TEMPLATE)
    expect(r.errors).toEqual([])
    const exam = r.exam!
    expect(exam.questions).toHaveLength(4)
    expect(exam.starts).toEqual([0, 2])
    expect(exam.spec.sections.map((s) => s.minutes)).toEqual([15, 17])
    expect([exam.spec.max, exam.spec.pass]).toEqual([200, 120])
    expect(exam.spec.note).toContain('Đề mẫu')
    const full = gradeMock(exam, exam.questions.map((q) => q.answer))
    expect([full.total, full.passed]).toEqual([200, true])
    expect(gradeMock(exam, exam.questions.map(() => null)).passed).toBe(false)
  })

  it('điểm đạt mặc định là 60% khi file không ghi', () => {
    const p = clone()
    delete p.pass
    expect(parse(p).exam!.spec.pass).toBe(120)
  })

  it('báo lỗi rõ ràng theo vị trí cho dữ liệu sai', () => {
    expect(parsePaper('không phải json').errors[0]).toMatch(/JSON/)
    expect(parsePaper('[1,2]').errors[0]).toMatch(/đối tượng/)
    const bad = (mut: (p: Paper) => void) => {
      const p = clone()
      mut(p)
      return parse(p).errors.join(' | ')
    }
    expect(bad((p) => (p.level = 9 as never))).toMatch(/level/)
    expect(bad((p) => (p.title = ''))).toMatch(/title/)
    expect(bad((p) => (p.sections[0].questions[0].answer = 7))).toMatch(/Phần 1, câu 1.*answer/)
    expect(bad((p) => (p.sections[0].questions[0].options = ['a', 'a']))).toMatch(/trùng/)
    expect(bad((p) => delete p.sections[0].questions[0].audio)).toMatch(/Phần 1, câu 1.*audio/)
    expect(bad((p) => delete p.sections[1].questions[0].text)).toMatch(/Phần 2, câu 1.*text/)
    expect(bad((p) => (p.sections[1].questions[0].kind = 'hear-meaning'))).toMatch(/không khớp kỹ năng|audio/)
    expect(bad((p) => (p.sections[0].minutes = 0))).toMatch(/minutes/)
    expect(bad((p) => (p.pass = 500))).toMatch(/pass/)
    expect(bad((p) => (p.sections[0].questions[0].kind = 'khac' as never))).toMatch(/kind/)
  })

  it('câu sắp xếp: tự xáo nếu thiếu bank, từ chối bank sai từ', () => {
    const p: Paper = {
      title: 'Viết', level: 3, sections: [{ skill: 'writing', minutes: 10, questions: [{ kind: 'reorder', ask: 'Sắp xếp', tokens: ['我', '喜欢', '学', '汉语'] }] }],
    }
    const ok = parse(p).exam!
    expect([...ok.questions[0].bank!].sort()).toEqual(['我', '喜欢', '学', '汉语'].sort())
    p.sections[0].questions[0].bank = ['我', '喜欢', '学', '日语']
    expect(parse(p).errors.join()).toMatch(/bank/)
  })

  it('chặn đề quá lớn', () => {
    const p = clone()
    const q = p.sections[0].questions[0]
    p.sections[0].questions = Array.from({ length: MAX_PAPER_QUESTIONS + 1 }, (_, i) => ({ ...q, audio: `句子${i}` }))
    expect(parse(p).errors.join()).toMatch(/tối đa/)
  })
})

describe('mp3 đi kèm câu nghe', () => {
  const mk = (mp3: unknown) => JSON.stringify({ title: 't', level: 1, sections: [{ skill: 'listening', minutes: 5, questions: [{ kind: 'hear-meaning', audio: '你好', mp3, ask: 'a', options: ['x', 'y'], answer: 0 }] }] })
  it('nhận tên file hợp lệ và từ chối đường dẫn hoặc đuôi khác', () => {
    expect(parsePaper(mk('cau01.mp3')).exam?.questions[0].mp3).toBe('cau01.mp3')
    expect(parsePaper(mk('../x.mp3')).errors[0]).toMatch(/mp3/)
    expect(parsePaper(mk('x.wav')).errors[0]).toMatch(/mp3/)
  })
})
