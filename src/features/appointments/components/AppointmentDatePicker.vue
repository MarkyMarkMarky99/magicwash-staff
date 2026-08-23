<script setup lang="ts">
import { computed } from 'vue'
import {
  addSheetDateDays,
  getSheetDateCalendar,
  todaySheetDate,
} from '@/shared/utils/sheet-date'

const props = withDefaults(defineProps<{
  selectedDate: string
  title: string
  includeToday?: boolean
  disabledDaysOfWeek?: number[]
}>(), {
  includeToday: true,
  disabledDaysOfWeek: () => [],
})

const emit = defineEmits<{ select: [date: string] }>()
const today = todaySheetDate()

const dates = computed(() => {
  const start = props.includeToday ? today : addSheetDateDays(today, 1)
  return Array.from({ length: 14 }, (_, index) => {
    const value = addSheetDateDays(start, index)
    const calendar = getSheetDateCalendar(value)
    return {
      value,
      weekday: calendar
        ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][calendar.weekday]
        : '',
      day: calendar?.day ?? 0,
      disabled: calendar ? props.disabledDaysOfWeek.includes(calendar.weekday) : true,
    }
  })
})
</script>

<template>
  <section class="appointment-date-picker">
    <div class="flex items-center justify-between mb-2">
      <h2 class="font-headline font-bold text-xs text-primary">{{ title }}</h2>
      <span class="text-xs text-on-surface-variant">Next 14 days</span>
    </div>
    <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      <button
        v-for="date in dates"
        :key="date.value"
        type="button"
        :disabled="date.disabled"
        :class="[
          'flex-none w-14 rounded-xl border px-1 py-2.5 text-center transition-colors',
          date.value === selectedDate
            ? 'border-primary bg-primary text-on-primary'
            : 'border-outline-variant/30 bg-surface-container-lowest text-on-surface hover:bg-surface-container',
          date.disabled ? 'opacity-35 cursor-not-allowed' : '',
        ]"
        @click="emit('select', date.value)"
      >
        <span class="block font-label text-[9px] uppercase tracking-wide">{{ date.weekday }}</span>
        <span class="block font-headline font-bold text-lg leading-tight">{{ date.day }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.appointment-date-picker,
.appointment-date-picker * {
  font-family: "Noto Sans Thai", system-ui, sans-serif;
}
</style>
