<script setup lang="ts">
import { formatTrackingDateTime, toDatetimeAttribute } from '../utils/delivery-tracking'

defineProps<{
  weightKg: number
  weighedAt: string
  bagIndex: number
  bagCount: number
}>()
</script>

<template>
  <div class="relative -mt-11 flex items-start gap-4 pr-4 max-[340px]:gap-2.5">
    <div class="min-w-[190px] rounded-r-[10px] bg-black py-3 pl-4 pr-[18px] text-white max-[340px]:min-w-0">
      <div class="heavy flex items-baseline gap-1.5 leading-none">
        <b class="text-[58px] font-black tracking-[-0.02em] max-[340px]:text-[46px]">{{ weightKg }}</b>
        <i class="text-[22px] not-italic">kg</i>
      </div>
      <time class="mt-2 block text-[13px] font-medium tracking-[0.01em] text-white/90" :datetime="toDatetimeAttribute(weighedAt)">{{ formatTrackingDateTime(weighedAt) }}</time>
    </div>
    <div class="min-w-0 pt-[52px]">
      <div class="text-xs font-medium text-on-surface-variant">Bag</div>
      <div class="text-xl font-bold leading-tight max-[340px]:text-[17px]">{{ bagIndex }} of {{ bagCount }}</div>
    </div>
  </div>
</template>

<style scoped>
.heavy {
  font-family: "Arial Black", "Archivo Black", Arial, sans-serif;
}
</style>
