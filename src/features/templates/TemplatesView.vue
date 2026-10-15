<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { MessageTemplate } from '@/types'
import { fillTemplate } from '@/lib/template'
import { useContentStore } from '@/stores/content'
import Icon from '@/components/Icon.vue'
import Select from '@/components/Select.vue'

const content = useContentStore()
const CUSTOM = '__custom__'
const list = ref<MessageTemplate[]>([])
const sel = ref(0)
const choice = reactive<Record<string, string>>({})
const custom = reactive<Record<string, string>>({})
const copied = ref('')

onMounted(async () => {
  list.value = (await import('@/data/it/templates.json')).default as MessageTemplate[]
})
const tpl = computed(() => list.value[sel.value])

function reset() {
  if (!tpl.value) return
  for (const k of Object.keys(choice)) delete choice[k]
  for (const k of Object.keys(custom)) delete custom[k]
  for (const v of tpl.value.vars) choice[v.key] = '0'
}
watch(tpl, reset, { immediate: true })

function opts(key: string) {
  const v = tpl.value.vars.find((x) => x.key === key)!
  return [...v.options.map((o, i) => ({ value: String(i), label: `${o.sc}  ·  ${o.vi}` })), { value: CUSTOM, label: 'Tự nhập…' }]
}

const filled = computed(() => {
  if (!tpl.value) return null
  const sc: Record<string, string> = {}
  const vi: Record<string, string> = {}
  for (const v of tpl.value.vars) {
    if (choice[v.key] === CUSTOM) sc[v.key] = custom[v.key] ?? ''
    else {
      const o = v.options[Number(choice[v.key] ?? 0)]
      sc[v.key] = o?.sc ?? ''
      vi[v.key] = o?.vi ?? ''
    }
  }
  return fillTemplate(tpl.value, sc, vi)
})

async function copy(kind: 'sc' | 'vi') {
  const text = filled.value![kind]
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = kind
  setTimeout(() => (copied.value = ''), 1800)
}
const ACC = ['acc-seal', 'acc-sky', 'acc-jade', 'acc-plum', 'acc-lantern']
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-3xl font-bold">Mẫu tin nhắn công việc</h1>
      <p class="text-ink2">Chọn mẫu, điền biến, rồi sao chép gửi qua WeChat hoặc email. Bản tiếng Việt bên cạnh giúp bạn kiểm tra lại nội dung trước khi gửi.</p>
    </div>

    <div class="grid gap-5 xl:grid-cols-[17rem_1fr_1fr]">
      <nav class="flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible" aria-label="Danh sách mẫu">
        <button v-for="(t, i) in list" :key="t.id" type="button" class="tile shrink-0 !p-4 text-left xl:shrink" :class="[ACC[i % ACC.length], i === sel && '!border-[rgb(var(--acc))] ring-2 ring-[rgb(var(--acc)/.4)]']" @click="sel = i">
          <span class="relative flex items-center gap-3">
            <span class="tile-ico !h-10 !w-10"><Icon :name="t.channel === 'email' ? 'mail' : 'chat'" :size="20" /></span>
            <span><span class="block font-bold leading-tight">{{ t.title }}</span><span class="text-xs text-ink2">{{ t.channel === 'email' ? 'Email' : 'WeChat' }}</span></span>
          </span>
        </button>
      </nav>

      <template v-if="tpl && filled">
        <section class="surface space-y-4 p-5">
          <div>
            <h2 class="text-xl font-bold">{{ tpl.title }}</h2>
            <p class="text-sm text-ink2">{{ tpl.when }}</p>
          </div>
          <div v-for="v in tpl.vars" :key="v.key" class="space-y-1.5">
            <label class="text-sm font-semibold">{{ v.label }}</label>
            <Select v-model="choice[v.key]" :options="opts(v.key)" :label="v.label" />
            <input v-if="choice[v.key] === CUSTOM" v-model="custom[v.key]" class="field font-zh" :placeholder="`Nhập ${v.label.toLowerCase()} (chữ Trung hoặc Latin)`" />
          </div>
          <button type="button" class="btn-ghost" @click="reset">Đặt lại</button>
        </section>

        <section class="space-y-4">
          <div class="surface overflow-hidden">
            <div class="flex items-center justify-between border-b border-line px-5 py-3">
              <span class="font-semibold">Bản tiếng Trung</span>
              <button type="button" class="btn-primary !py-2" @click="copy('sc')"><Icon :name="copied === 'sc' ? 'check' : 'copy'" :size="16" />{{ copied === 'sc' ? 'Đã sao chép' : 'Sao chép' }}</button>
            </div>
            <div class="bg-paper/70 p-5">
              <div class="max-w-full whitespace-pre-wrap rounded-2xl p-4 font-zh text-lg leading-relaxed shadow-lift"
                :class="tpl.channel === 'wechat' ? 'rounded-tl-sm bg-[#95ec69] text-[#1b2440]' : 'border border-line bg-surface'">{{ filled.sc }}</div>
            </div>
            <p v-if="filled.missing.length" class="border-t border-line bg-lantern/20 px-5 py-2.5 text-sm" role="alert">Còn thiếu: {{ filled.missing.join(', ') }}</p>
          </div>
          <div class="surface overflow-hidden">
            <div class="flex items-center justify-between border-b border-line px-5 py-3">
              <span class="font-semibold">Bản dịch tiếng Việt</span>
              <button type="button" class="btn-ghost !py-2" @click="copy('vi')"><Icon :name="copied === 'vi' ? 'check' : 'copy'" :size="16" />{{ copied === 'vi' ? 'Đã sao chép' : 'Sao chép' }}</button>
            </div>
            <p class="whitespace-pre-wrap p-5 text-ink2">{{ filled.vi }}</p>
          </div>
          <p v-if="!content.isReviewedKey('tp:' + tpl.id, tpl.reviewed)" class="text-sm"><span class="badge-unreviewed">chưa kiểm duyệt</span> Nên nhờ đồng nghiệp người Trung đọc lại trước khi dùng cho tin nhắn quan trọng.</p>
        </section>
      </template>
    </div>
  </div>
</template>
