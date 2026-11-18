<script setup lang="ts">
import { computed } from 'vue'
import type { TeamAgentAssignment } from '@shared/ai-gateway/tasks/team-agent'
import {
  assignmentCreatorText,
  assignmentDue,
  assignmentDueText,
  assignmentOrderText,
  assignmentOverdue,
} from '@/shared/utils/assignment-display'
import BaseBadge, { type BadgeTone } from './BaseBadge.vue'

const STATUS_LABELS: Record<TeamAgentAssignment['status'], string> = { open: 'Open', done: 'Done', cancelled: 'Cancelled' }
const STATUS_TONES: Record<TeamAgentAssignment['status'], BadgeTone> = { open: 'info', done: 'success', cancelled: 'neutral' }

const props = withDefaults(defineProps<{
  assignment: TeamAgentAssignment
  /** Hide the assignee name where the page already names them (the staff profile). */
  showAssignee?: boolean
  /** Make the whole card one button that emits `select`. */
  tappable?: boolean
}>(), { showAssignee: true, tappable: false })
const emit = defineEmits<{ select: [assignment: TeamAgentAssignment] }>()

const due = computed(() => assignmentDue(props.assignment))
const dueText = computed(() => assignmentDueText(props.assignment))
const overdue = computed(() => assignmentOverdue(props.assignment))
const failed = computed(() => props.assignment.failedDeliveries ?? 0)
const creator = computed(() => assignmentCreatorText(props.assignment))
const infoLine = computed(() => [assignmentOrderText(props.assignment), dueText.value].filter(Boolean).join(' · '))
const showStatus = computed(() => !overdue.value && props.assignment.status !== 'open')
const showHead = computed(() => props.showAssignee || overdue.value || showStatus.value || failed.value > 0)
</script>

<template>
  <li class="relative overflow-hidden [border-radius:14px] bg-white text-on-surface shadow-[0_1px_0_rgba(7,63,56,0.05)]">
    <component
      :is="tappable ? 'button' : 'div'"
      :type="tappable ? 'button' : undefined"
      class="grid w-full items-center gap-2.5 px-3 py-2.5 text-left"
      :class="[
        $slots.action ? 'grid-cols-[56px_minmax(0,1fr)_56px]' : 'grid-cols-[56px_minmax(0,1fr)]',
        tappable ? 'focus-visible:outline-2 focus-visible:outline-lime active:opacity-80' : '',
      ]"
      @click="tappable && emit('select', assignment)"
    >
      <p class="flex flex-col items-center justify-center self-stretch border-r border-outline-variant pr-2 text-primary">
        <template v-if="due">
          <span class="font-headline text-[36px] font-extrabold leading-none tabular-nums" :aria-label="dueText">{{ due.day }}</span>
          <span class="mt-1.5 whitespace-nowrap font-label text-xs font-bold leading-none text-on-surface-variant">{{ due.month }}</span>
        </template>
        <span v-else class="font-headline text-[36px] font-extrabold leading-none text-on-surface-variant opacity-60" aria-label="No due time">–</span>
      </p>
      <div class="min-w-0">
        <p v-if="showHead" class="flex items-center gap-1.5 font-body text-sm font-extrabold">
          <span v-if="showAssignee" class="truncate">{{ assignment.assigneeName ?? assignment.assigneeStaffId }}</span>
          <BaseBadge v-if="overdue" label="Overdue" tone="lime" uppercase />
          <BaseBadge v-else-if="showStatus" :label="STATUS_LABELS[assignment.status]" :tone="STATUS_TONES[assignment.status]" uppercase />
          <BaseBadge v-if="failed > 0" :label="`${failed} failed`" tone="warning" uppercase />
        </p>
        <p class="line-clamp-2 whitespace-pre-wrap break-words font-body text-xs leading-snug [overflow-wrap:anywhere]" :class="showHead ? 'mt-1' : ''">{{ assignment.detail }}</p>
        <p v-if="creator" class="mt-1 truncate font-label text-[10px] font-extrabold uppercase text-warning">By {{ creator }}</p>
        <p class="mt-1 truncate font-label text-[11px] text-on-surface-variant">{{ infoLine }}</p>
      </div>
      <slot name="action" />
    </component>
  </li>
</template>
