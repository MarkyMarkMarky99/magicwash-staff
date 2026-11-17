<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'
import type { PendingTeamAgentMessage, TeamAgentImageState } from '@/data/team-agent/team-agent.store'
import type { TeamAgentEvent } from '@/data/team-agent/team-agent.service'
import type { AgentInfo } from '../agents'
import { formatEventTime } from '../utils/format-event-time'
import AgentAvatar from './AgentAvatar.vue'
import TeamAgentEventImages from './TeamAgentEventImages.vue'

type ActionType = NonNullable<TeamAgentEvent['action']>['type']
type Outcome = NonNullable<TeamAgentEvent['action']>['outcome']

const props = defineProps<{
  agent: AgentInfo
  events: TeamAgentEvent[]
  pending: PendingTeamAgentMessage[]
  imageStates: Record<string, TeamAgentImageState>
  busy: boolean
  loading: boolean
  hasOlder: boolean
  olderLoading: boolean
  ownStaffId: string
  ownName: string
}>()

const emit = defineEmits<{ loadOlder: [] }>()

const ACTION_ICONS: Record<ActionType, string> = {
  create: 'event_available',
  reschedule: 'event_repeat',
  cancel: 'event_busy',
  remind: 'alarm',
  'reminder-cancelled': 'alarm_off',
  close: 'task_alt',
  reopen: 'replay',
  assign: 'assignment_ind',
  'assignment-done': 'assignment_turned_in',
  'assignment-cancelled': 'block',
  'assignment-overdue': 'assignment_late',
}

const OUTCOME_LABELS: Record<Outcome, string> = { ok: 'OK', failed: 'Failed', unknown: 'Unknown' }
const OUTCOME_CLASSES: Record<Outcome, string> = {
  ok: 'bg-success-container text-on-success-container',
  failed: 'bg-error-container text-on-error-container',
  unknown: 'bg-warning-container text-on-warning-container',
}

const STICK_DISTANCE_PX = 120
const region = ref<{ el: HTMLElement | null } | null>(null)
let stickToBottom = true

function onScroll(): void {
  const el = region.value?.el
  if (el) stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_DISTANCE_PX
}

let heightBeforeOlder: number | null = null

onMounted(() => region.value?.el?.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => region.value?.el?.removeEventListener('scroll', onScroll))

function loadOlder(): void {
  heightBeforeOlder = region.value?.el?.scrollHeight ?? null
  emit('loadOlder')
}

watch(() => props.olderLoading, async (loadingOlder) => {
  if (loadingOlder) return
  await nextTick()
  const el = region.value?.el
  if (el && heightBeforeOlder !== null) el.scrollTop += el.scrollHeight - heightBeforeOlder
  heightBeforeOlder = null
}, { flush: 'post' })

watch(() => [props.events.length, props.pending.length, props.busy, props.loading], async () => {
  const prepending = heightBeforeOlder !== null
  await nextTick()
  const el = region.value?.el
  if (el && stickToBottom && !prepending) el.scrollTop = el.scrollHeight
}, { flush: 'post' })
</script>

<template>
  <ScrollRegion ref="region" class="flex flex-col gap-3 bg-surface px-3 pb-4 pt-3.5">
    <p v-if="loading && !events.length" class="my-auto text-center font-body text-sm text-on-surface-variant" role="status">Loading…</p>

    <div v-else-if="!events.length && !pending.length" class="my-auto flex flex-col items-center gap-3.5 px-2 text-center">
      <span class="rounded-full shadow-[0_0_0_4px_white]"><AgentAvatar :agent-id="agent.id" :size="104" /></span>
      <div class="max-w-[340px] rounded-[18px] bg-white px-4 py-3 font-body text-sm leading-relaxed shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_6%,transparent)]">
        <b class="mb-0.5 block font-headline text-base font-extrabold text-primary">{{ agent.name }}</b>
        {{ agent.greeting }}
      </div>
    </div>

    <template v-else>
      <button v-if="hasOlder" type="button" class="mx-auto h-9 flex-none rounded-full border-[1.5px] border-outline-variant bg-white px-4 font-body text-[13px] font-extrabold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime active:bg-surface-container disabled:opacity-50" :disabled="olderLoading" @click="loadOlder">
        {{ olderLoading ? 'Loading…' : 'Load earlier messages' }}
      </button>

      <template v-for="event in events" :key="event.id">
        <div v-if="event.kind === 'action'" class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-surface-container px-3 py-1.5 font-body text-[12.5px] leading-snug text-on-surface-variant">
          <span class="material-symbols-outlined shrink-0 text-[16px] text-primary" aria-hidden="true">{{ event.action ? ACTION_ICONS[event.action.type] : 'bolt' }}</span>
          <span class="min-w-0 flex-1 break-words font-semibold text-on-surface [overflow-wrap:anywhere]">{{ event.text }}</span>
          <span v-if="event.action" class="shrink-0 rounded-full px-2 py-0.5 font-label text-[10px] font-extrabold uppercase" :class="OUTCOME_CLASSES[event.action.outcome]">{{ OUTCOME_LABELS[event.action.outcome] }}</span>
          <span class="shrink-0 font-label text-[10px] font-bold">{{ formatEventTime(event.at) }}</span>
        </div>

        <p v-else-if="event.kind === 'system'" class="px-4 text-center font-body text-xs leading-snug text-on-surface-variant [overflow-wrap:anywhere]">
          <b class="font-label text-[10px] font-extrabold uppercase tracking-[0.08em]">System</b> · {{ event.text }} · {{ formatEventTime(event.at) }}
        </p>

        <div v-else-if="event.kind === 'agent'" class="flex items-end gap-2">
          <span class="self-start"><AgentAvatar :agent-id="agent.id" :size="32" /></span>
          <div class="flex min-w-0 max-w-[calc(100%-44px)] flex-col">
            <span class="mb-0.5 px-1 font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">AI · {{ formatEventTime(event.at) }}</span>
            <TeamAgentEventImages v-if="event.images?.length" class="mb-1.5" :images="event.images" :states="imageStates" />
            <p v-if="event.text" class="whitespace-pre-wrap break-words rounded-[6px_18px_18px_18px] bg-white px-3.5 py-2 font-body text-sm leading-relaxed shadow-[0_1px_0_color-mix(in_srgb,var(--color-on-surface)_6%,transparent)] [overflow-wrap:anywhere]">{{ event.text }}</p>
          </div>
        </div>

        <div v-else class="flex" :class="event.speaker?.staffId === ownStaffId ? 'justify-end' : 'justify-start'">
          <div class="flex min-w-0 max-w-[86%] flex-col" :class="event.speaker?.staffId === ownStaffId ? 'items-end' : 'items-start'">
            <span class="mb-0.5 px-1 font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">{{ event.speaker?.name ?? 'Staff' }} · {{ formatEventTime(event.at) }}</span>
            <TeamAgentEventImages v-if="event.images?.length" class="mb-1.5" :images="event.images" :states="imageStates" :align-end="event.speaker?.staffId === ownStaffId" />
            <p v-if="event.text" class="whitespace-pre-wrap break-words px-3.5 py-2 font-body text-sm font-semibold leading-relaxed text-primary [overflow-wrap:anywhere]" :class="event.speaker?.staffId === ownStaffId ? 'rounded-[18px_6px_18px_18px] bg-lime' : 'rounded-[6px_18px_18px_18px] bg-secondary-container'">{{ event.text }}</p>
          </div>
        </div>
      </template>

      <div v-for="entry in pending" :key="entry.localId" class="flex justify-end">
        <div class="flex min-w-0 max-w-[86%] flex-col items-end opacity-70">
          <span class="mb-0.5 px-1 font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">{{ ownName }} · Sending…</span>
          <div v-if="entry.imageUrls.length" class="mb-1.5 flex flex-wrap justify-end gap-1.5">
            <img v-for="url in entry.imageUrls" :key="url" :src="url" alt="Attached image" class="rounded-xl border-2 border-white bg-surface-container object-cover" :class="entry.imageUrls.length === 1 ? 'h-40 w-40' : 'h-[92px] w-[92px]'" />
          </div>
          <p v-if="entry.text" class="whitespace-pre-wrap break-words rounded-[18px_6px_18px_18px] bg-lime px-3.5 py-2 font-body text-sm font-semibold leading-relaxed text-primary [overflow-wrap:anywhere]">{{ entry.text }}</p>
        </div>
      </div>

      <div v-if="busy" class="flex items-center gap-2 px-1 font-body text-xs font-semibold text-on-surface-variant" role="status">
        <span class="inline-flex gap-1" aria-hidden="true">
          <i v-for="n in 3" :key="n" class="h-[6px] w-[6px] animate-bounce rounded-full bg-on-surface-variant motion-reduce:animate-none" :style="{ animationDelay: `${(n - 1) * 0.18}s` }" />
        </span>
        Working…
      </div>
    </template>
  </ScrollRegion>
</template>
