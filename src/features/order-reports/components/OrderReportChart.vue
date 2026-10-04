<script setup lang="ts">
import { computed } from 'vue'
import { barHeights, type ChartBar } from '../utils/order-report'

const BAR_AREA_PIXELS = 118

const props = defineProps<{ title: string; bars: ChartBar[] }>()

const columns = computed(() => ({ gridTemplateColumns: `repeat(${props.bars.length}, minmax(0, 1fr))` }))
const heights = computed(() => barHeights(props.bars.map((bar) => bar.value), BAR_AREA_PIXELS))
</script>

<template>
  <section class="mx-4 mt-3 rounded-[20px] border border-on-primary/10 bg-on-primary/5 px-3.5 pb-3 pt-4" :aria-label="title">
    <h3 class="px-0.5 pb-3 text-[15px] font-bold">{{ title }}</h3>
    <div class="grid h-[150px] items-end gap-2.5" :style="columns">
      <div v-for="(bar, index) in bars" :key="bar.key" class="flex h-[150px] flex-col items-center justify-end gap-1.5">
        <span class="font-headline text-[11px] font-bold" :class="bar.highlight ? 'text-lime' : 'text-on-primary/60'">{{ bar.value || '–' }}</span>
        <div class="w-full rounded-lg" :class="bar.highlight ? 'bg-lime' : bar.value ? 'bg-on-primary/25' : 'bg-on-primary/10'" :style="{ height: `${heights[index]}px` }" />
      </div>
    </div>
    <div class="mt-2 grid gap-2.5" :style="columns">
      <span v-for="bar in bars" :key="bar.key" class="text-center text-[12px]" :class="bar.highlight ? 'text-lime' : 'text-on-primary/60'">{{ bar.label }}</span>
    </div>
  </section>
</template>
