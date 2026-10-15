import { createRouter, createWebHashHistory } from 'vue-router'

const Soon = () => import('@/views/ComingSoon.vue')

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    admin?: boolean
    title?: string
    step?: number
  }
}

export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/features/auth/LoginView.vue'), meta: { public: true } },
    { path: '/admin', name: 'admin', component: () => import('@/features/auth/AdminView.vue'), meta: { admin: true } },
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/it', name: 'it-track', component: () => import('@/features/it-track/ItTrackView.vue') },
    { path: '/flashcard', name: 'flashcard', component: () => import('@/features/flashcard/FlashcardView.vue') },
    { path: '/writing', name: 'writing', component: () => import('@/features/writing/WritingView.vue') },
    { path: '/listening', name: 'listening', component: () => import('@/features/listening/ListeningView.vue') },
    { path: '/reading', name: 'reading', component: () => import('@/features/reading/ReadingView.vue') },
    { path: '/practice', name: 'practice', component: () => import('@/views/PracticeView.vue') },
    { path: '/scenarios', name: 'scenarios', component: () => import('@/features/scenarios/ScenariosView.vue') },
    { path: '/mock', name: 'mock', component: () => import('@/features/mock/MockExamView.vue') },
    { path: '/videos', name: 'videos', component: () => import('@/features/videos/VideosView.vue') },
    { path: '/templates', name: 'templates', component: () => import('@/features/templates/TemplatesView.vue') },
    { path: '/grammar', name: 'grammar', component: () => import('@/features/grammar/GrammarView.vue') },
    { path: '/exam', name: 'exam', component: () => import('@/features/exam/ExamView.vue') },
    { path: '/dashboard', name: 'dashboard', component: () => import('@/features/dashboard/DashboardView.vue') },
    { path: '/start', name: 'start', component: () => import('@/features/stage0/StartView.vue') },
    { path: '/print', name: 'print', component: () => import('@/features/print/PrintView.vue') },
    { path: '/review', name: 'review', component: () => import('@/features/review/ReviewView.vue') },
    { path: '/search', name: 'search', component: () => import('@/views/SearchView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/about', name: 'about', component: () => import('@/views/AboutView.vue') },
  ],
})

import { useAuthStore } from '@/stores/auth'

// Chặn mọi trang cần đăng nhập; trang quản trị chỉ dành cho quản trị viên.
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.public) return auth.user ? { path: '/' } : true
  if (!auth.user) return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }
  if (to.meta.admin && auth.user.role !== 'admin') return { path: '/' }
  return true
})
