<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { formatSheetDateTime, normalizeSheetDate, sheetTimestampMs, todaySheetDate } from '@/shared/utils/sheet-date'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import PullToRefresh from '@/shared/components/PullToRefresh.vue'
import BaseBadge, { type BadgeTone } from '@/shared/components/BaseBadge.vue'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import { useAuthStore } from '@/data/auth/auth.store'
import { usePersonalAssignmentsStore } from '@/data/team-agent/personal-assignments.store'
import type { TeamAgentAssignment } from '@/data/team-agent/team-agent.service'

type TabKey = 'open' | 'done' | 'cancelled' | 'all'

const TAB_KEYS: readonly TabKey[] = ['open', 'done', 'cancelled', 'all']
const TAB_LABELS: Record<TabKey, string> = { open: 'Open', done: 'Done', cancelled: 'Cancelled', all: 'All' }
const TAB_SUBTITLES: Record<TabKey, string> = {
  open: 'Newest first',
  done: 'Reported done by staff',
  cancelled: 'Cancelled by admin',
  all: 'Every assignment',
}
const TAB_EMPTY_TEXT: Record<TabKey, string> = {
  open: 'No open assignments.',
  done: 'No assignments reported done.',
  cancelled: 'No cancelled assignments.',
  all: 'No assignments.',
}
const STATUS_LABELS: Record<TeamAgentAssignment['status'], string> = { open: 'Open', done: 'Done', cancelled: 'Cancelled' }
const STATUS_TONES: Record<TeamAgentAssignment['status'], BadgeTone> = { open: 'info', done: 'success', cancelled: 'neutral' }
const DUE_PATTERN = /^(\d{2}) ([A-Za-z]{3}) (\d{4}) (\d{2}:\d{2}):\d{2}$/

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = usePersonalAssignmentsStore()
const { isAdmin, status: authStatus } = storeToRefs(authStore)
const { items, loading, error, cancellingId, cancelError } = storeToRefs(store)

const activeTab = computed<TabKey>(() => {
  const raw = route.query.status
  const first = Array.isArray(raw) ? raw[0] : raw
  return TAB_KEYS.find(key => key === first) ?? 'open'
})
const tabs = computed(() => TAB_KEYS.map(key => ({
  key,
  label: TAB_LABELS[key],
  count: key === 'all' ? items.value.length : items.value.filter(item => item.status === key).length,
})))
const visible = computed(() => activeTab.value === 'all' ? items.value : items.value.filter(item => item.status === activeTab.value))
const showPlaceholder = computed(() => (loading.value || Boolean(error.value)) && items.value.length === 0)
const target = ref<TeamAgentAssignment | null>(null)

function changeTab(key: string): void {
  if (!TAB_KEYS.includes(key as TabKey)) return
  void router.replace({ query: key === 'open' ? {} : { status: key } })
}

function refresh(): Promise<void> {
  return store.load('all')
}

// dueAt arrives as `yyyy-MM-dd HH:mm:ss` in Asia/Bangkok; formatSheetDateTime also accepts the other sheet formats.
function dueParts(assignment: TeamAgentAssignment): { day: string, month: string, year: string, time: string, today: boolean } | null {
  if (!assignment.dueAt) return null
  const match = DUE_PATTERN.exec(formatSheetDateTime(assignment.dueAt))
  if (!match) return null
  return {
    day: String(Number(match[1])),
    month: match[2],
    year: match[3],
    time: match[4],
    today: normalizeSheetDate(assignment.dueAt) === todaySheetDate(),
  }
}

function dueText(assignment: TeamAgentAssignment): string {
  const due = dueParts(assignment)
  if (!due) return 'No due time'
  return due.today ? `due today ${due.time}` : `due ${due.day} ${due.month} ${due.time}`
}

function overdue(assignment: TeamAgentAssignment): boolean {
  const due = assignment.dueAt ? sheetTimestampMs(assignment.dueAt) : null
  return assignment.status === 'open' && due !== null && due < Date.now()
}

function creatorText(assignment: TeamAgentAssignment): string {
  const creator = assignment.createdBy
  if (!creator) return ''
  return creator.name ?? creator.staffId ?? creator.agentId ?? ''
}

async function confirmCancel(): Promise<void> {
  const assignment = target.value
  if (!assignment) return
  const cancelled = await store.cancel(assignment.id)
  if (cancelled) target.value = null
}

watch([authStatus, isAdmin], () => {
  if (authStatus.value !== 'loading' && !isAdmin.value) void router.replace({ name: 'agent-list' })
}, { immediate: true })

// Every status is loaded once; the tabs filter in memory so their counts stay correct.
watch(isAdmin, () => {
  if (isAdmin.value) void store.load('all')
}, { immediate: true })

onBeforeUnmount(() => store.reset())
</script>

<template>
  <ListPageLayout v-if="isAdmin">
    <template #filters>
      <GenericTabs :tabs="tabs" :active-key="activeTab" @select="changeTab" />
    </template>

    <ListContainer
      v-if="showPlaceholder"
      title="Assignments"
      icon="assignment"
      count-label="assignments"
      :loading="loading"
      :skeleton-rows="3"
      skeleton-avatar-class="h-14 w-14"
      :error="error"
      :refresh="refresh"
    >
      <template #error>
        <div class="px-4 py-6 text-center">
          <p role="alert" class="text-sm text-error">{{ error }}</p>
          <button type="button" class="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="refresh()">Try again</button>
        </div>
      </template>
    </ListContainer>

    <PullToRefresh v-else inline :refresh="refresh">
      <div class="min-h-[calc(100dvh-11.5rem)] bg-surface pb-4">
        <InlineNotice v-if="cancelError" tone="error" size="sm" class="mx-4 mt-3">{{ cancelError }}</InlineNotice>

        <section>
          <div class="flex items-start gap-3 px-4 pb-2 pt-4">
            <div class="flex min-w-0 flex-1 items-start justify-between gap-3 text-left">
              <span class="min-w-0 border-l-4 border-lime pl-2">
                <h2 class="font-headline text-xl font-bold leading-tight text-primary">{{ TAB_LABELS[activeTab] }}</h2>
                <span class="mt-0.5 block font-label text-[10px] font-extrabold uppercase tracking-[0.08em] text-on-surface-variant">{{ TAB_SUBTITLES[activeTab] }}</span>
              </span>
            </div>
          </div>
          <ul class="grid gap-2.5 px-3">
            <li v-for="assignment in visible" :key="assignment.id" class="relative overflow-hidden [border-radius:14px] bg-white shadow-[0_1px_0_rgba(7,63,56,0.05)]">
              <div class="grid items-center gap-2.5 px-3 py-2.5" :class="assignment.status === 'open' ? 'grid-cols-[56px_minmax(0,1fr)_56px]' : 'grid-cols-[56px_minmax(0,1fr)]'">
                <p class="flex flex-col items-center justify-center self-stretch border-r border-outline-variant pr-2 text-primary">
                  <template v-if="dueParts(assignment)">
                    <span class="font-headline text-[36px] font-extrabold leading-none tabular-nums" :aria-label="dueText(assignment)">{{ dueParts(assignment)?.day }}</span>
                    <span class="mt-1.5 whitespace-nowrap font-label text-xs font-bold leading-none text-on-surface-variant">{{ dueParts(assignment)?.month }}</span>
                  </template>
                  <span v-else class="font-headline text-[36px] font-extrabold leading-none text-on-surface-variant opacity-60" aria-label="No due time">–</span>
                </p>
                <div class="min-w-0">
                  <p class="flex items-center gap-1.5 font-body text-sm font-extrabold">
                    <span class="truncate">{{ assignment.assigneeName ?? assignment.assigneeStaffId }}</span>
                    <BaseBadge v-if="overdue(assignment)" label="Overdue" tone="lime" uppercase />
                    <BaseBadge v-else-if="assignment.status !== 'open'" :label="STATUS_LABELS[assignment.status]" :tone="STATUS_TONES[assignment.status]" uppercase />
                    <BaseBadge v-if="(assignment.failedDeliveries ?? 0) > 0" :label="`${assignment.failedDeliveries} failed`" tone="warning" uppercase />
                  </p>
                  <p class="mt-1 line-clamp-2 whitespace-pre-wrap break-words font-body text-xs leading-snug [overflow-wrap:anywhere]">{{ assignment.detail }}</p>
                  <p v-if="creatorText(assignment)" class="mt-1 truncate font-label text-[10px] font-extrabold uppercase text-warning">By {{ creatorText(assignment) }}</p>
                  <p class="mt-1 truncate font-label text-[11px] text-on-surface-variant">{{ dueText(assignment) }}</p>
                </div>
                <button
                  v-if="assignment.status === 'open'"
                  type="button"
                  class="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-[10px] bg-error-container font-label text-[9px] font-extrabold uppercase text-on-error-container focus-visible:outline-2 focus-visible:outline-lime active:opacity-80 disabled:opacity-50"
                  :aria-label="`Cancel assignment for ${assignment.assigneeName ?? assignment.assigneeStaffId}`"
                  :disabled="cancellingId !== null"
                  @click="target = assignment"
                >
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>Cancel
                </button>
              </div>
            </li>
            <li v-if="visible.length === 0" class="px-1 py-4 text-sm italic text-on-surface-variant">{{ TAB_EMPTY_TEXT[activeTab] }}</li>
          </ul>
        </section>
      </div>
    </PullToRefresh>

    <ConfirmOverlay
      :open="target !== null"
      title="Cancel this assignment?"
      :description="target ? `${target.assigneeName ?? target.assigneeStaffId}: ${target.detail}` : ''"
      @close="target = null"
      @confirm="confirmCancel"
    >
      <template #footer>
        <footer class="flex flex-none flex-col gap-2 px-5 pb-5 pt-4">
          <button type="submit" class="h-[46px] rounded-full bg-error px-4 font-body text-sm font-extrabold text-on-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime disabled:opacity-50" :disabled="cancellingId !== null">{{ cancellingId !== null ? 'Cancelling…' : 'Cancel assignment' }}</button>
          <button type="button" class="h-[46px] rounded-full border-[1.5px] border-outline-variant bg-white px-4 font-body text-sm font-extrabold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime" @click="target = null">Keep</button>
        </footer>
      </template>
    </ConfirmOverlay>
  </ListPageLayout>
</template>
