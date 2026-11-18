<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import ListPageLayout from '@/shared/layouts/ListPageLayout.vue'
import ConfirmOverlay from '@/shared/layouts/ConfirmOverlay.vue'
import ListContainer from '@/shared/components/ListContainer.vue'
import GenericTabs from '@/shared/components/GenericTabs.vue'
import PullToRefresh from '@/shared/components/PullToRefresh.vue'
import AssignmentCard from '@/shared/components/AssignmentCard.vue'
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
            <AssignmentCard v-for="assignment in visible" :key="assignment.id" :assignment="assignment">
              <template v-if="assignment.status === 'open'" #action>
                <button
                  type="button"
                  class="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-[10px] bg-error-container font-label text-[9px] font-extrabold uppercase text-on-error-container focus-visible:outline-2 focus-visible:outline-lime active:opacity-80 disabled:opacity-50"
                  :aria-label="`Cancel assignment for ${assignment.assigneeName ?? assignment.assigneeStaffId}`"
                  :disabled="cancellingId !== null"
                  @click="target = assignment"
                >
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>Cancel
                </button>
              </template>
            </AssignmentCard>
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
