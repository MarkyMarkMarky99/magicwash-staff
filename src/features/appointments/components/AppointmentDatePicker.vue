<script setup lang="ts">
import { computed } from 'vue'
import { addAppointmentDays, toAppointmentDate } from '../utils/appointment-date'

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
const today = new Date()

const dates = computed(() => {
  const start = props.includeToday ? today : addAppointmentDays(today, 1)
  return Array.from({ length: 14 }, (_, index) => {
    const date = addAppointmentDays(start, index)
    return {
      value: toAppointmentDate(date),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      day: date.getDate(),
      disabled: props.disabledDaysOfWeek.includes(date.getDay()),
    }
  })
})
</script>

<template>
  <section>
    <div class="flex items-center justify-between mb-2">
      <h2 class="font-headline font-bold text-sm text-primary">{{ title }}</h2>
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
