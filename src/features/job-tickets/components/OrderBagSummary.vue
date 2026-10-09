<script setup lang="ts">
export type SummarySegment = 'done' | 'pending' | 'empty'

defineProps<{
  customerIndex: string
  customerName: string
  metricLabel: string
  metricValue: string | number
  metricUnit?: string
  progressLabel: string
  segments: SummarySegment[]
  statusText: string
  countText: string
  complete: boolean
}>()
</script>

<template>
  <section class="relative mx-3 mt-4 overflow-hidden rounded-[20px] border border-lime/25 bg-primary text-on-primary shadow-lg">
    <div class="pointer-events-none absolute -right-[138px] -top-[112px] h-[270px] w-[270px] rounded-full border-[34px] border-lime/15" />
    <div class="relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-5 pb-3 pt-4">
      <p class="truncate font-label text-[9px] font-bold uppercase tracking-widest text-lime">Customer · {{ customerIndex }}</p>
      <p class="text-right font-label text-[9px] font-bold uppercase tracking-widest text-lime">{{ metricLabel }}</p>
      <h1 class="mt-0.5 truncate font-headline text-[26px] font-bold leading-8">{{ customerName }}</h1>
      <p class="mt-0.5 whitespace-nowrap text-right font-headline text-[30px] font-extrabold leading-8 text-lime">{{ metricValue }}<span v-if="metricUnit" class="ml-1 font-body text-sm font-bold text-on-primary/80">{{ metricUnit }}</span></p>
    </div>
    <div class="relative mx-5 border-t border-white/15 pb-4 pt-3">
      <p class="font-label text-[9px] font-bold uppercase tracking-widest text-lime">{{ progressLabel }}</p>
      <div class="mt-3 flex h-1.5 gap-1" role="progressbar" :aria-label="progressLabel" :aria-valuemin="0" :aria-valuemax="segments.length" :aria-valuenow="segments.filter(segment => segment === 'done').length">
        <div v-for="(segment, index) in segments" :key="index" class="flex-1 rounded-full" :class="segment === 'done' ? 'bg-lime' : segment === 'pending' ? 'bg-lime/40' : 'bg-white/20'" />
        <div v-if="!segments.length" class="flex-1 rounded-full bg-white/20" />
      </div>
      <div class="mt-2 flex items-baseline justify-between gap-3">
        <p class="font-body text-xs font-bold" :class="complete ? 'text-lime' : 'text-on-primary/80'">{{ statusText }}</p>
        <p class="whitespace-nowrap font-body text-xs font-bold tabular-nums" :class="complete ? 'text-lime' : 'text-on-primary/80'">{{ countText }}</p>
      </div>
    </div>
  </section>
</template>
