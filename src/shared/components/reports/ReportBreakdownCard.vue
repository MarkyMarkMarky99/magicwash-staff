<script setup lang="ts">
import ReportCard from './ReportCard.vue'
import type { ReportBreakdownRow } from './report-types'

defineProps<{ title: string; hint?: string; headingId: string; rows: ReportBreakdownRow[] }>()
</script>

<template>
  <ReportCard :title="title" :hint="hint" :heading-id="headingId">
    <div v-for="row in rows" :key="row.key" class="flex flex-col gap-1.5">
      <div class="flex justify-between gap-3 text-[13px]">
        <span>{{ row.label }}<span v-if="row.detail" class="text-on-primary/60">{{ ' ' + row.detail }}</span></span>
        <span class="text-on-primary/60"><span class="font-headline font-bold text-on-primary">{{ row.value }}</span><template v-if="row.suffix">{{ ' ' + row.suffix }}</template></span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-on-primary/10">
        <div class="h-1.5 rounded-full bg-lime" :style="{ width: `${row.width}%` }" />
      </div>
    </div>
  </ReportCard>
</template>
