<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const all = [
  { to: '/start', icon: 'star', acc: 'acc-jade', title: 'Nhập môn: Giai đoạn 0', desc: 'Pinyin, 4 thanh điệu, biến điệu, nét chữ, 30 bộ thủ và 30 chữ đầu tiên. Dành cho người mới bắt đầu.', ready: true },
  { to: '/writing', icon: 'pen', acc: 'acc-seal', title: 'Tập viết', desc: 'Viết chữ Hán của từ vựng HSK 1–5: xem thứ tự nét rồi tự viết, có chấm lỗi.', ready: true },
  { to: '/listening', icon: 'headphones', acc: 'acc-sky', title: 'Nghe và gõ', desc: 'Nghe từ HSK hoặc câu hội thoại theo cấp, gõ pinyin hoặc chọn nghĩa.', ready: true },
  { to: '/reading', icon: 'book', acc: 'acc-jade', title: 'Luyện đọc', desc: 'Đọc hội thoại nhà máy theo cấp HSK. Bấm từ để xem pinyin, nghĩa và cấp.', ready: true },
  { to: '/print', icon: 'download', acc: 'acc-lantern', title: 'In phiếu tập viết', desc: 'Phiếu A4 có chữ mẫu, chữ mờ để tô, ô mễ và thứ tự nét để luyện viết trên giấy.', ready: true },
  { to: '/scenarios', icon: 'chat', acc: 'acc-plum', title: 'Hội thoại nhà máy', desc: 'Hơn 560 đoạn thoại theo cấp HSK. Đóng vai nhân viên: chọn hoặc gõ câu đúng.', ready: true },
  { to: '/templates', icon: 'mail', acc: 'acc-lantern', title: 'Mẫu tin nhắn', desc: 'WeChat và email công việc, điền biến rồi sao chép.', ready: true },
  { to: '/grammar', icon: 'grid', acc: 'acc-sky', title: 'Ngữ pháp', desc: '36 mẫu câu HSK 1–5 và công sở, lỗi người Việt hay mắc, sắp xếp câu kéo thả.', ready: true },
  { to: '/exam', icon: 'check', acc: 'acc-seal', title: 'Kiểm tra HSK', desc: 'Bài thi mô phỏng có đồng hồ để mở khóa cấp kế.', ready: true, hsk: true },
]
const items = computed(() => all.filter((i) => !i.hsk || settings.s.mode === 'full'))
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Luyện tập</h1>
      <p class="text-ink2">Chọn một kỹ năng. Mỗi bài chỉ vài phút, vừa một lượt nghỉ giữa ca.</p>
    </div>
    <ul class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      <li v-for="i in items" :key="i.to">
        <component :is="i.ready ? RouterLink : 'div'" :to="i.ready ? i.to : undefined"
          class="tile flex h-full flex-col gap-4 !p-6" :class="[i.acc, !i.ready && 'opacity-60']">
          <span class="tile-ico !h-14 !w-14"><Icon :name="i.icon" :size="28" /></span>
          <span class="relative">
            <span class="flex items-center gap-2 text-lg font-bold">{{ i.title }}<span v-if="!i.ready" class="rounded-md bg-line px-1.5 py-0.5 text-[11px] font-medium text-ink2">Sắp có</span></span>
            <span class="mt-1 block text-sm text-ink2">{{ i.desc }}</span>
          </span>
        </component>
      </li>
    </ul>
  </div>
</template>
