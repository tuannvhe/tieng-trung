import { ref } from 'vue'

/** Trạng thái PWA cho giao diện: đã cache đủ để chạy offline chưa. */
export const offlineReady = ref(false)
export const updated = ref(false)

export async function setupPwa() {
  if (!('serviceWorker' in navigator)) return
  const { registerSW } = await import('virtual:pwa-register')
  registerSW({
    immediate: true,
    onOfflineReady: () => (offlineReady.value = true),
    onNeedRefresh: () => (updated.value = true),
  })
  // Lần mở sau đã có service worker điều khiển trang: coi như sẵn sàng offline
  if (navigator.serviceWorker.controller) offlineReady.value = true
}
