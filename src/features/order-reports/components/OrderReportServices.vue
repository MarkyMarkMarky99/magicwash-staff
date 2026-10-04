<script setup lang="ts">
import { formatCount, type ServiceRow } from '../utils/order-report'

defineProps<{ rows: ServiceRow[] }>()
</script>

<template>
  <section class="mx-4 mt-3 flex flex-col gap-2.5 rounded-[20px] border border-on-primary/10 bg-on-primary/5 p-4" aria-labelledby="order-report-by-service">
    <div class="flex items-baseline justify-between">
      <h3 id="order-report-by-service" class="text-[15px] font-bold">By service</h3>
      <span class="text-[12px] text-on-primary/60">orders · pieces</span>
    </div>
    <div v-for="row in rows" :key="row.key" class="flex flex-col gap-1.5">
      <div class="flex justify-between gap-3 text-[13px]">
        <span>{{ row.label }}</span>
        <span class="text-on-primary/60"><span class="font-headline font-bold text-on-primary">{{ row.orders }}</span> orders · {{ formatCount(row.pieces) }} pcs</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-on-primary/10">
        <div class="h-1.5 rounded-full bg-lime" :style="{ width: `${row.width}%` }" />
      </div>
    </div>
  </section>
</template>
