import type { MessageTemplate } from '@/types'

export interface FilledTemplate {
  sc: string
  vi: string
  /** Nhãn các biến chưa điền */
  missing: string[]
}

/**
 * Điền biến vào mẫu. `values[key]` là bản tiếng Trung; `viValues[key]` là bản tiếng Việt
 * (không có thì dùng lại bản Trung, ví dụ tên hệ thống, giờ). Biến chưa điền để nguyên dạng 【nhãn】.
 */
export function fillTemplate(tpl: MessageTemplate, values: Record<string, string>, viValues: Record<string, string> = {}): FilledTemplate {
  const labels = Object.fromEntries(tpl.vars.map((v) => [v.key, v.label]))
  const missing: string[] = []
  const sub = (text: string, src: Record<string, string>, fallback: Record<string, string>) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
      const v = (src[k] ?? fallback[k] ?? '').trim()
      if (v) return v
      if (!missing.includes(labels[k] ?? k)) missing.push(labels[k] ?? k)
      return `【${labels[k] ?? k}】`
    })
  return { sc: sub(tpl.sc, values, {}), vi: sub(tpl.vi, viValues, values), missing }
}
