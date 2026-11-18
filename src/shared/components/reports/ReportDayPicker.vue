<script setup lang="ts">
import { computed } from 'vue'
import { barHeights, tileLabel, weekdayLabel } from '@/shared/utils/report-format'
import type { ReportDay } from './report-types'

const BAR_AREA_PIXELS = 104

const props = defineProps<{
  days: ReportDay[]
  selected: string | null
  today: string
  /** Plural noun read after the count in each day's accessible name, e.g. `orders`. */
  unit: string
  sectionLabel: string
}>()
const emit = defineEmits<{ select: [date: string] }>()

const heights = computed(() => barHeights(props.days.map((day) => day.value), BAR_AREA_PIXELS))
const columns = computed(() => props.days.map((day, index) => ({
  ...day,
  height: `${heights.value[index]}px`,
  weekday: weekdayLabel(day.date),
  dayOfMonth: Number(day.date.slice(8, 10)),
  label: `${tileLabel(day.date, props.today)}, ${day.value} ${props.unit}`,
  selected: day.date === props.selected,
})))
</script>

<template>
  <section class="mx-4 mt-4" :aria-label="sectionLabel">
    <div class="grid grid-cols-[repeat(7,minmax(44px,1fr))] gap-1">
      <button
        v-for="column in columns"
        :key="column.date"
        type="button"
        :aria-label="column.label"
        :aria-pressed="column.selected"
        class="flex flex-col items-center gap-1.5 rounded-[14px] px-1 pb-2 pt-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime"
        :class="column.selected ? 'bg-on-primary/10' : ''"
        @click="emit('select', column.date)"
      >
        <span class="flex h-[134px] w-full flex-col items-center justify-end gap-1.5">
          <span class="font-headline text-[11px] font-bold" :class="column.selected ? 'text-lime' : 'text-on-primary/60'">{{ column.value }}</span>
          <span
            class="w-full rounded-lg transition-[height] duration-300"
            :class="column.selected ? 'bg-lime' : column.value ? 'bg-on-primary/25' : 'bg-on-primary/10'"
            :style="{ height: column.height }"
          />
        </span>
        <span class="text-[11px] font-semibold" :class="column.selected ? 'text-lime' : 'text-on-primary/60'">{{ column.weekday }}</span>
        <span class="-mt-1 font-headline text-[15px] font-extrabold leading-none" :class="column.selected ? 'text-lime' : 'text-on-primary'">{{ column.dayOfMonth }}</span>
      </button>
    </div>
  </section>
</template>
