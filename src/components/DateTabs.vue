<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { toDateStr } from '../utils/gviz'

const props = defineProps({
  year:         { type: Number, required: true },
  month:        { type: Number, required: true },
  selectedDate: { type: String, required: true },
})
const emit = defineEmits(['dateSelect', 'prevMonth', 'nextMonth'])

const stripRef = ref(null)

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const todayStr = toDateStr(new Date())

const tabs = computed(() => {
  const daysInMonth = new Date(props.year, props.month + 1, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const d = new Date(props.year, props.month, day)
    const dateStr = toDateStr(d)
    return {
      day,
      dayLabel: DAY_LABELS[d.getDay()],
      dateStr,
      isActive: dateStr === props.selectedDate,
      isToday:  dateStr === todayStr,
    }
  })
})

async function scrollToActive() {
  await nextTick()
  if (!stripRef.value) return
  const active = stripRef.value.querySelector('[data-active="true"]')
  active?.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
}

watch(() => [props.selectedDate, props.year, props.month], scrollToActive)
onMounted(scrollToActive)
</script>

<template>
  <div class="flex flex-col bg-primary pb-0 w-full overflow-hidden">

    <!-- Month navigation row -->
    <div class="flex items-center justify-between px-4 h-8 shrink-0 w-full">
      <button
        class="text-on-primary/70 hover:text-on-primary transition-colors p-1"
        @click="emit('prevMonth')"
      >
        <span class="material-symbols-outlined" style="font-size:22px">chevron_left</span>
      </button>

      <div class="flex items-center gap-1.5 px-2">
        <span class="material-symbols-outlined text-[14px]" aria-hidden="true">calendar_month</span>
        <span class="font-label text-[11px] font-semibold tracking-wider uppercase">
          {{ MONTH_NAMES[month] }} {{ year }}
        </span>
      </div>

      <button
        class="text-on-primary/70 hover:text-on-primary transition-colors p-1"
        @click="emit('nextMonth')"
      >
        <span class="material-symbols-outlined" style="font-size:22px">chevron_right</span>
      </button>
    </div>

    <!-- Date strip -->
    <div ref="stripRef" class="flex items-center gap-2 px-4 overflow-x-auto no-scrollbar pt-0.5 pb-0">
      <button
        v-for="tab in tabs"
        :key="tab.day"
        :data-active="tab.isActive"
        :aria-label="`${tab.dayLabel} ${tab.day}`"
        class="flex-none flex flex-col items-center justify-center w-[52px] pb-1 transition-all focus:outline-none border-b-2"
        :class="tab.isActive ? 'border-white' : 'border-transparent'"
        @click="emit('dateSelect', tab.dateStr)"
      >
        <span
          class="font-label text-[9px] uppercase font-semibold leading-none mb-0.5"
          :class="tab.isActive ? 'text-on-primary' : 'text-on-primary/70'"
        >
          {{ tab.dayLabel }}
        </span>
        <span
          class="font-headline font-bold text-sm leading-none"
          :class="[
            tab.isActive ? 'text-on-primary' : 'text-on-primary/70',
            tab.isToday && !tab.isActive ? 'underline decoration-2 underline-offset-2' : ''
          ]"
        >
          {{ tab.day }}
        </span>
      </button>
    </div>

  </div>
</template>
