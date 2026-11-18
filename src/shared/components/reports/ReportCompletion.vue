<script setup lang="ts">
import CompletionRing from '@/shared/components/CompletionRing.vue'
import type { ReportRing, ReportStat, ReportStatTone } from './report-types'

defineProps<{ ring: ReportRing; stats: ReportStat[]; note: string; sectionLabel: string }>()

const TONES: Record<ReportStatTone, { surface: string; fill: string; badge: string }> = {
  warning: { surface: 'bg-warning-container/20', fill: 'bg-warning-container/15', badge: 'bg-warning-container/30' },
  info: { surface: 'bg-secondary-container/20', fill: 'bg-secondary-container/15', badge: 'bg-secondary-container/30' },
  lime: { surface: 'bg-lime/20', fill: 'bg-lime/25', badge: 'bg-lime/30' },
}
</script>

<template>
  <section class="px-4 pt-4" :aria-label="sectionLabel">
    <div class="grid grid-cols-[164px_minmax(0,1fr)] items-center gap-4">
      <CompletionRing tone="onDark" :percentage="ring.percentage" :completed="ring.completed" :total="ring.total" :label="ring.label" :caption="ring.caption" :count-text="ring.countText" />
      <div class="flex min-w-0 flex-col gap-1.5">
        <div v-for="stat in stats" :key="stat.key" class="relative flex h-[50px] items-center gap-3 overflow-hidden rounded-2xl pl-2 pr-3" :class="TONES[stat.tone].surface">
          <span class="absolute inset-y-0 left-0" :class="TONES[stat.tone].fill" :style="{ width: `${stat.share}%` }" />
          <span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-on-primary" :class="TONES[stat.tone].badge">
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{ stat.icon }}</span>
          </span>
          <span class="relative flex min-w-0 flex-col justify-center">
            <span class="truncate font-label text-[12px] font-medium leading-4 text-on-primary/60">{{ stat.label }}</span>
            <strong class="font-headline text-[22px] font-semibold leading-6 text-on-primary">{{ stat.value }}</strong>
          </span>
        </div>
      </div>
    </div>
    <p class="mt-2.5 text-center text-[13px] text-on-primary/60">{{ note }}</p>
  </section>
</template>
