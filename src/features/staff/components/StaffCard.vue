<script setup lang="ts">
import { computed } from 'vue'
import type { StaffDto } from '@/data/staff/staff.service'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import { staffBadges } from '../utils/staff-presentation'

const props = defineProps<{
  staff: StaffDto
  points: number
  jobs: number
  rank: number | null
  /** The day's top score; the bar is drawn against it. */
  topPoints: number
  self: boolean
}>()

const emit = defineEmits<{
  select: [staffId: string]
}>()

const MEDAL_CLASSES: Record<number, string> = {
  1: 'text-medal-gold',
  2: 'text-medal-silver',
  3: 'text-medal-bronze',
}

const badges = computed(() => staffBadges(props.staff))
const pending = computed(() => props.staff.role === null)
// A row added by hand can have a blank StaffId; there is nothing to open it by.
const hasStaffId = computed(() => props.staff.staffId.trim() !== '')
const medalClass = computed(() => (props.rank === null ? null : MEDAL_CLASSES[props.rank] ?? null))
const barWidth = computed(() => (props.topPoints > 0 ? `${Math.max(0, props.points) / props.topPoints * 100}%` : '0%'))

function select(): void {
  if (hasStaffId.value) emit('select', props.staff.staffId)
}
</script>

<template>
  <component
    :is="hasStaffId ? 'button' : 'div'"
    :type="hasStaffId ? 'button' : undefined"
    class="flex w-full items-center gap-3 px-4 py-3 text-left"
    :class="[
      pending ? 'bg-warning-container/30' : props.self ? 'bg-secondary-container/40' : '',
      hasStaffId ? 'transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime' : '',
    ]"
    @click="select"
  >
    <div class="flex h-10 w-10 shrink-0 items-center justify-center" :aria-label="props.rank === null ? 'No rank' : `Rank ${props.rank}`">
      <span
        v-if="medalClass"
        class="material-symbols-outlined text-[32px] [font-variation-settings:'FILL'_1,'wght'_500,'GRAD'_0,'opsz'_40]"
        :class="medalClass"
        aria-hidden="true"
      >workspace_premium</span>
      <span v-else class="font-headline text-[15px] font-bold text-on-surface-variant" aria-hidden="true">{{ props.rank ?? '–' }}</span>
    </div>

    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <h3 class="min-w-0 truncate font-headline text-[14px] font-bold text-primary">
            {{ props.staff.name || props.staff.email }}
          </h3>
          <BaseBadge v-if="props.self" label="You" tone="lime" />
        </div>
        <p class="shrink-0 font-headline text-[14px] font-bold text-primary">
          {{ props.points }} <span class="font-body text-xs font-normal text-on-surface-variant">pts</span>
        </p>
      </div>
      <div class="mt-1.5 flex items-center gap-3">
        <div class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-container-high">
          <div class="h-full rounded-full bg-primary" :style="{ width: barWidth }" />
        </div>
        <p class="shrink-0 font-body text-xs text-on-surface-variant">{{ props.jobs }} {{ props.jobs === 1 ? 'job' : 'jobs' }}</p>
      </div>
      <div v-if="badges.length || !hasStaffId" class="mt-1.5 flex flex-wrap items-center gap-1">
        <BaseBadge v-for="badge in badges" :key="badge.label" :label="badge.label" :tone="badge.tone" />
        <span v-if="!hasStaffId" class="font-body text-xs text-on-surface-variant">No staff ID</span>
      </div>
    </div>
  </component>
</template>
