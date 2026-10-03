<script setup lang="ts">
import { computed } from 'vue'
import type { StaffDto } from '@/data/staff/staff.service'
import BaseBadge from '@/shared/components/BaseBadge.vue'
import { staffBadges } from '../utils/staff-presentation'

const props = defineProps<{
  staff: StaffDto
}>()

const emit = defineEmits<{
  select: [staffId: string]
}>()

const badges = computed(() => staffBadges(props.staff))
const pending = computed(() => props.staff.role === null)
// A row added by hand can have a blank StaffId; there is nothing to open it by.
const hasStaffId = computed(() => props.staff.staffId.trim() !== '')
const details = computed(() => [props.staff.position, props.staff.phone].filter(Boolean).join(' · '))

function select(): void {
  if (hasStaffId.value) emit('select', props.staff.staffId)
}
</script>

<template>
  <component
    :is="hasStaffId ? 'button' : 'div'"
    :type="hasStaffId ? 'button' : undefined"
    class="w-full px-4 py-3 text-left"
    :class="[
      pending ? 'bg-warning-container/30' : '',
      hasStaffId ? 'transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime' : '',
    ]"
    @click="select"
  >
    <div class="flex items-start justify-between gap-3">
      <h3 class="min-w-0 flex-1 truncate font-headline text-[14px] font-bold text-primary">
        {{ props.staff.name || props.staff.email }}
      </h3>
      <div class="flex shrink-0 items-center gap-1">
        <BaseBadge v-for="badge in badges" :key="badge.label" :label="badge.label" size="lg" :tone="badge.tone" />
      </div>
    </div>
    <p v-if="props.staff.name" class="mt-1 truncate font-body text-xs text-on-surface-variant">{{ props.staff.email }}</p>
    <p v-if="details" class="mt-0.5 truncate font-body text-xs text-on-surface-variant">{{ details }}</p>
    <p v-if="!hasStaffId" class="mt-0.5 font-body text-xs text-on-surface-variant">ยังไม่มีรหัสพนักงาน</p>
  </component>
</template>
