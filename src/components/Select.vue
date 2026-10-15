<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import Icon from './Icon.vue'

export interface SelectOption {
  value: string
  label: string
  /** Tiêu đề nhóm, hiện khi nhóm đổi */
  group?: string
  disabled?: boolean
}

const props = defineProps<{ modelValue: string; options: SelectOption[]; label: string; placeholder?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const id = useId()
const root = ref<HTMLElement>()
const list = ref<HTMLElement>()
const open = ref(false)
const active = ref(0)

const current = computed(() => props.options.find((o) => o.value === props.modelValue))

function openList() {
  active.value = Math.max(0, props.options.findIndex((o) => o.value === props.modelValue))
  open.value = true
  nextTick(scrollActive)
}
function close() {
  open.value = false
}
function pick(i: number) {
  if (props.options[i].disabled) return
  emit('update:modelValue', props.options[i].value)
  close()
  root.value?.querySelector('button')?.focus()
}
function scrollActive() {
  list.value?.querySelector<HTMLElement>(`[data-i="${active.value}"]`)?.scrollIntoView({ block: 'nearest' })
}
function move(d: number) {
  active.value = (active.value + d + props.options.length) % props.options.length
  nextTick(scrollActive)
}
function onKey(e: KeyboardEvent) {
  if (!open.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      openList()
    }
    return
  }
  if (e.key === 'ArrowDown') (e.preventDefault(), move(1))
  else if (e.key === 'ArrowUp') (e.preventDefault(), move(-1))
  else if (e.key === 'Home') (e.preventDefault(), (active.value = 0), nextTick(scrollActive))
  else if (e.key === 'End') (e.preventDefault(), (active.value = props.options.length - 1), nextTick(scrollActive))
  else if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), pick(active.value))
  else if (e.key === 'Escape' || e.key === 'Tab') close()
}
function outside(e: MouseEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) close()
}
onMounted(() => document.addEventListener('mousedown', outside))
onBeforeUnmount(() => document.removeEventListener('mousedown', outside))
watch(() => props.modelValue, close)
</script>

<template>
  <div ref="root" class="relative">
    <button type="button" role="combobox" :aria-label="label" aria-haspopup="listbox" :aria-expanded="open" :aria-controls="id + '-list'"
      class="field flex items-center justify-between gap-3 text-left font-medium" :class="open && '!border-sky !shadow-[0_0_0_4px_rgb(var(--c-sky)/.18)]'"
      @click="open ? close() : openList()" @keydown="onKey">
      <span class="truncate">{{ current?.label ?? placeholder ?? 'Chọn…' }}</span>
      <Icon name="chevron" :size="18" class="shrink-0 text-ink2 transition-transform duration-200" :class="open && 'rotate-180'" />
    </button>

    <Transition name="sel">
      <ul v-if="open" :id="id + '-list'" ref="list" role="listbox" :aria-label="label"
        class="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[0_20px_50px_-12px_rgb(var(--c-ink)/.35)]">
        <template v-for="(o, i) in options" :key="o.value">
          <li v-if="o.group && o.group !== options[i - 1]?.group" role="presentation" class="px-3 pb-1 pt-2 text-xs font-semibold text-ink2" :class="i === 0 && '!pt-1'">{{ o.group }}</li>
          <li role="option" :data-i="i" :aria-selected="o.value === modelValue"
            class="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors"
            :aria-disabled="o.disabled || undefined" :class="[i === active ? 'bg-sky/12 text-ink' : 'text-ink2', o.value === modelValue && '!font-semibold !text-ink', o.disabled && '!cursor-not-allowed opacity-50']"
            @mouseenter="active = i" @click="pick(i)">
            <span class="truncate">{{ o.label }}</span>
            <Icon v-if="o.disabled" name="lock" :size="15" class="shrink-0" />
            <Icon v-else-if="o.value === modelValue" name="check" :size="16" class="shrink-0 text-seal" />
          </li>
        </template>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.sel-enter-active, .sel-leave-active { transition: opacity .15s ease, transform .15s ease; transform-origin: top; }
.sel-enter-from, .sel-leave-to { opacity: 0; transform: scaleY(.92) translateY(-4px); }
</style>
