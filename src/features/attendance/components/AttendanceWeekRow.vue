<script setup lang="ts">
import type { CalendarWeek } from '../utils/attendance-calendar'
import { dayOfMonth, shortLabel, weekName, weekRange } from '../utils/attendance-labels'
import AttendanceDayCell from './AttendanceDayCell.vue'

defineProps<{
  week: CalendarWeek
  selected: boolean
  nameOf: (staffId: string) => string
}>()
const emit = defineEmits<{
  selectWeek: [index: number]
  selectDay: [date: string]
}>()

function showMonth(weekIndex: number, offset: number, date: string): boolean {
  return (weekIndex === 0 && offset === 0) || dayOfMonth(date) === 1
}
</script>

<template>
  <div class="mb-2.5">
    <button
      type="button"
      class="mb-1 flex w-full items-center justify-between gap-2 rounded-[10px] px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-lime"
      :class="selected ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'"
      @click="emit('selectWeek', week.index)"
    >
      <span class="min-w-0 text-xs font-bold">{{ weekName(week.index) }}<em class="ml-1 font-medium not-italic">{{ weekRange(week) }}</em></span>
      <span
        class="flex-none whitespace-nowrap rounded-full px-2 py-[3px] text-[10.5px] font-bold"
        :class="week.mineDate ? 'bg-success-container text-on-success-container' : 'bg-warning-container text-on-warning-container'"
      >{{ week.mineDate ? `Off ${shortLabel(week.mineDate)}` : 'No day off yet' }}</span>
    </button>
    <div class="grid grid-cols-7 gap-[3px]">
      <AttendanceDayCell
        v-for="(day, offset) in week.days"
        :key="day.date"
        :day="day"
        :name="day.holderStaffId ? nameOf(day.holderStaffId) : ''"
        :show-month="showMonth(week.index, offset, day.date)"
        @select="emit('selectDay', $event)"
      />
    </div>
  </div>
</template>
