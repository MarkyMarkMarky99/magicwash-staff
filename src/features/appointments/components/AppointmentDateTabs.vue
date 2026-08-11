<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { getSheetDateCalendar, todaySheetDate } from '@/shared/utils/sheet-date'
import { addSheetDateDays } from '@/shared/utils/sheet-date'

const props = defineProps<{
  year: number
  month: number
  selectedDate: string
}>()

const emit = defineEmits<{
  dateSelect: [date: string]
  prevMonth: []
  nextMonth: []
}>()

const stripRef = ref<HTMLElement | null>(null)
const today = todaySheetDate()
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const dates = computed(() => {
  const monthStart = `${props.year}-${String(props.month + 1).padStart(2, '0')}-01`
  const nextMonthStart = props.month === 11
    ? `${props.year + 1}-01-01`
    : `${props.year}-${String(props.month + 2).padStart(2, '0')}-01`
  const count = getSheetDateCalendar(addSheetDateDays(nextMonthStart, -1))?.day ?? 0
  return Array.from({ length: count }, (_, index) => {
    const value = addSheetDateDays(monthStart, index)
    const calendar = getSheetDateCalendar(value)
    return {
      day: index + 1,
      label: calendar ? dayLabels[calendar.weekday] : '',
      value,
      active: value === props.selectedDate,
      today: value === today,
    }
  })
})

async function scrollToSelected() {
  await nextTick()
  stripRef.value?.querySelector('[data-selected="true"]')?.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'center',
  })
}

watch(() => [props.year, props.month, props.selectedDate], scrollToSelected)
onMounted(scrollToSelected)
</script>

<template>
  <div class="flex flex-col bg-primary w-full overflow-hidden">
    <div class="flex items-center justify-between px-4 h-8 shrink-0">
      <button class="text-on-primary/70 hover:text-on-primary transition-colors p-1" aria-label="Previous month" @click="emit('prevMonth')">
        <span class="material-symbols-outlined" style="font-size:22px">chevron_left</span>
      </button>
      <div class="flex items-center gap-1.5 px-2">
        <span class="material-symbols-outlined text-[14px]" aria-hidden="true">calendar_month</span>
        <span class="font-label text-[11px] font-semibold tracking-wider uppercase">{{ monthNames[month] }} {{ year }}</span>
      </div>
      <button class="text-on-primary/70 hover:text-on-primary transition-colors p-1" aria-label="Next month" @click="emit('nextMonth')">
        <span class="material-symbols-outlined" style="font-size:22px">chevron_right</span>
      </button>
    </div>

    <div ref="stripRef" class="flex items-center gap-2 px-4 overflow-x-auto no-scrollbar pt-0.5">
      <button
        v-for="date in dates"
        :key="date.value"
        :data-selected="date.active"
        :aria-label="`${date.label} ${date.day}`"
        class="flex-none flex flex-col items-center justify-center w-[52px] pb-1 transition-all focus:outline-none border-b-2"
        :class="date.active ? 'border-white' : 'border-transparent'"
        @click="emit('dateSelect', date.value)"
      >
        <span class="font-label text-[9px] uppercase font-semibold leading-none mb-0.5" :class="date.active ? 'text-on-primary' : 'text-on-primary/70'">
          {{ date.label }}
        </span>
        <span class="font-headline font-bold text-sm leading-none" :class="[date.active ? 'text-on-primary' : 'text-on-primary/70', date.today && !date.active ? 'underline decoration-2 underline-offset-2' : '']">
          {{ date.day }}
        </span>
      </button>
    </div>
  </div>
</template>
