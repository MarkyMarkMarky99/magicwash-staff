<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { toDateStr } from '../utils/gviz'

const props = defineProps({
  selectedDate: { type: String, default: '' },
})
const emit = defineEmits(['select'])

const stripRef = ref(null)
const DAY_ABBREV = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// Next 14 days from today
const dates = computed(() => {
  const result = []
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  for (let i = 1; i <= 14; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    result.push({ d, ds: toDateStr(d) })
  }
  return result
})

const monthLabel = computed(() => {
  if (!props.selectedDate) return ''
  const d = new Date(props.selectedDate + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
})

async function scrollToSelected() {
  await nextTick()
  if (!stripRef.value) return
  const el = stripRef.value.querySelector('[data-selected="true"]')
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
}

watch(() => props.selectedDate, scrollToSelected)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-headline font-bold text-base text-primary">Select New Date</h2>
      <div class="flex items-center gap-1.5 bg-surface-container rounded-full px-3 py-1">
        <span class="material-symbols-outlined text-primary text-[14px]" aria-hidden="true">calendar_month</span>
        <span class="font-label text-[11px] text-on-surface-variant font-semibold">{{ monthLabel }}</span>
      </div>
    </div>

    <div ref="stripRef" class="flex gap-2 overflow-x-auto no-scrollbar -mx-2 px-2 pb-1">
      <button
        v-for="{ d, ds } in dates"
        :key="ds"
        :data-selected="ds === selectedDate"
        class="flex-shrink-0 flex flex-col items-center justify-center rounded-full w-[52px] h-[52px] transition-all focus:outline-none focus:ring-2 focus:ring-primary"
        :class="ds === selectedDate
          ? 'bg-primary text-on-primary shadow-md active:scale-95 focus:ring-offset-2 focus:ring-offset-surface'
          : 'bg-surface-container-lowest border border-outline-variant/30 hover:bg-surface-container-high'"
        @click="emit('select', ds)"
      >
        <span
          class="font-label text-[9px] uppercase font-semibold leading-none mb-0.5"
          :class="ds === selectedDate ? 'opacity-80' : 'text-on-surface-variant'"
        >
          {{ DAY_ABBREV[d.getDay()] }}
        </span>
        <span
          class="font-headline font-bold text-sm leading-none"
          :class="ds === selectedDate ? '' : 'text-on-surface'"
        >
          {{ d.getDate() }}
        </span>
      </button>
    </div>
  </div>
</template>
