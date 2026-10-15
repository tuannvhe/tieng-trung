import { ref } from 'vue'

export type AudioResolver = (text: string) => string | undefined

/** Chỗ cắm mp3: đăng ký hàm trả URL file mp3 cho một câu/từ; nếu không có thì dùng Web Speech. */
let resolver: AudioResolver | null = null
export function registerAudioSource(fn: AudioResolver | null) {
  resolver = fn
}

export const SPEECH_RATES = { slow: 0.6, normal: 1 } as const

export function useSpeech() {
  const speaking = ref(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  function speak(text: string, rate: number = SPEECH_RATES.normal) {
    const url = resolver?.(text)
    if (url) {
      const a = new Audio(url)
      a.playbackRate = rate
      void a.play()
      return
    }
    if (!supported) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = rate
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-') === 'zh-CN')
    if (voice) u.voice = voice
    u.onstart = () => (speaking.value = true)
    u.onend = u.onerror = () => (speaking.value = false)
    window.speechSynthesis.speak(u)
  }

  return { speak, speaking, supported }
}
