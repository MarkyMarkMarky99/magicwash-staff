<script setup lang="ts">
import type { IssueReportDto } from '../services/issue-report.service'
import IssueReportStatusBadge from './IssueReportStatusBadge.vue'

const props = defineProps<{
  report: IssueReportDto
}>()

const emit = defineEmits<{
  select: [id: string]
}>()
</script>

<template>
  <button
    type="button"
    class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    @click="emit('select', props.report.issueReportId)"
  >
    <div class="flex items-start justify-between gap-3">
      <h3 class="min-w-0 flex-1 truncate font-headline text-[14px] font-bold text-primary">{{ props.report.title }}</h3>
      <IssueReportStatusBadge :status="props.report.status" />
    </div>
    <p class="mt-1 line-clamp-2 font-body text-xs leading-relaxed text-on-surface-variant">{{ props.report.description }}</p>
    <p class="mt-2 font-body text-[11px] text-on-surface-variant">{{ props.report.createdAt }} · {{ props.report.createdBy ?? '—' }}</p>
  </button>
</template>
