import { computed, ref } from 'vue'
import { IT_DOMAINS, IT_DOMAIN_LABELS, IT_DOMAIN_ZH, type HskLevel, type ItDomain } from '@/types'
import { useContentStore } from '@/stores/content'
import { useSettingsStore } from '@/stores/settings'
import type { DeckItem } from './useSrs'
import { getStorage } from '@/lib/storage'
import { unlockedLevels } from '@/lib/exam'
import { loadDialogues } from '@/lib/data'
import { examplesFor } from '@/lib/examples'
import stage0 from '@/data/stage0.json'

const HSK_ZH = ['', '一级', '二级', '三级', '四级', '五级']

export function useDeck() {
  const content = useContentStore()
  const settings = useSettingsStore()

  /** Cấp HSK đã mở khóa nhờ bài thi cuối cấp hoặc thi xếp lớp. */
  const unlocked = ref<HskLevel[]>([1])
  getStorage().then((s) => s.examResults()).then((r) => (unlocked.value = unlockedLevels(r)))

  const deckOptions = computed(() => [
    { key: 'p0:chars', label: 'Giai đoạn 0: 30 chữ đầu tiên', disabled: false },
    ...(settings.s.mode === 'full'
      ? ([1, 2, 3, 4, 5, 6] as HskLevel[]).map((l) => ({ key: `hsk:${l}`, label: unlocked.value.includes(l) ? `HSK ${l}` : `HSK ${l} (đạt 80% cấp trước để mở)`, disabled: !unlocked.value.includes(l) }))
      : []),
    { key: 'it:all', label: 'IT — tất cả', disabled: false },
    ...IT_DOMAINS.map((d) => ({ key: `it:${d}`, label: `IT — ${IT_DOMAIN_LABELS[d]}`, disabled: false })),
  ])

  async function buildDeck(deckKey: string): Promise<DeckItem[]> {
    const [kind, arg] = deckKey.split(':')
    if (kind === 'p0') {
      return stage0.firstChars.flatMap((l) => l.items).map((c) => ({
        ref: `p0:${c.hanzi}`, hanzi: c.hanzi, pinyin: c.py, vi: c.vi, en: c.hint, seal: '入门', sealLabel: 'Giai đoạn 0',
      }))
    }
    if (kind === 'hsk') {
      const level = Number(arg) as HskLevel
      const words = await content.loadHsk(level)
      const ex = examplesFor(words.map((w) => w.hanzi), (await loadDialogues()).items)
      return words.map((w) => ({
        exampleSc: ex.get(w.hanzi)?.sc,
        examplePinyin: ex.get(w.hanzi)?.py,
        exampleVi: ex.get(w.hanzi)?.vi,
        ref: `hsk:${w.id}`,
        hanzi: w.hanzi,
        hanziTc: w.traditional !== w.hanzi ? w.traditional : undefined,
        pinyin: w.pinyin,
        vi: content.viMeaning(w),
        hanViet: content.overrides[`hsk:${w.id}`]?.han_viet || w.han_viet || undefined,
        en: w.meanings_en[0] ?? '',
        seal: HSK_ZH[level],
        sealLabel: `HSK ${level}`,
      }))
    }
    const terms = await content.loadItTerms(arg === 'all' ? undefined : (arg as ItDomain))
    return terms.map((t) => ({
      ref: `it:${t.id}`,
      hanzi: t.hanzi_sc,
      hanziTc: t.hanzi_tc,
      pinyin: t.pinyin,
      vi: t.vi,
      en: t.en,
      exampleSc: t.example_sc,
      examplePinyin: t.example_pinyin,
      exampleVi: t.example_vi,
      unreviewed: !content.isReviewed(t),
      seal: IT_DOMAIN_ZH[t.domain],
      sealLabel: IT_DOMAIN_LABELS[t.domain],
    }))
  }

  return { deckOptions, buildDeck, unlocked }
}
