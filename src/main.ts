import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useAuthStore } from './stores/auth'
import './style.css'
import { setupPwa } from './lib/pwa'
import { loadAudioPack } from './lib/audio-pack'
import { onSessionExpired } from './lib/api'

const app = createApp(App)
app.use(createPinia())

// Khôi phục phiên đăng nhập trước khi định tuyến để chặn trang cần đăng nhập đúng ngay từ lần vào đầu tiên
const auth = useAuthStore()
auth.restore().finally(async () => {
  const { router } = await import('./router')
  app.use(router)
  app.mount('#app')
})
void setupPwa()
void loadAudioPack()
onSessionExpired(() => auth.logout('expired'))
