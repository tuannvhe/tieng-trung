import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { DEFAULT_SETTINGS, type AppSettings } from '@/types'
import { getStorage } from '@/lib/storage'

export const useSettingsStore = defineStore('settings', () => {
  const s = ref<AppSettings>({ ...DEFAULT_SETTINGS })
  const ready = ref(false)

  async function load() {
    const saved = await (await getStorage()).getSettings()
    if (saved) s.value = { ...DEFAULT_SETTINGS, ...saved }
    ready.value = true
    apply()
  }

  function apply() {
    const dark =
      s.value.theme === 'dark' ||
      (s.value.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.setProperty('--zh-size', `${s.value.zhFontSize}px`)
  }

  watch(
    s,
    async (v) => {
      if (!ready.value) return
      apply()
      await (await getStorage()).saveSettings(JSON.parse(JSON.stringify(v)))
    },
    { deep: true },
  )

  return { s, ready, load }
})
