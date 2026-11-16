<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import { useGoBack } from '@/shared/composables/use-go-back'
import { useAuthStore } from '@/data/auth/auth.store'
import { useAppointmentsAgentStore } from '@/data/appointments-agent/appointments-agent.store'
import AgentChatBar from '../components/AgentChatBar.vue'
import AgentComposer from '../components/AgentComposer.vue'
import AppointmentsAgentPanel from '../components/AppointmentsAgentPanel.vue'
import AppointmentsEventList from '../components/AppointmentsEventList.vue'
import { agentById } from '../agents'

const POLL_MS = 15000

const router = useRouter()
const { goBack } = useGoBack()
const authStore = useAuthStore()
const store = useAppointmentsAgentStore()
const { status, isAdmin, staff } = storeToRefs(authStore)
const {
  events, pending, busy, loading, error, sendError, sending,
  reminders, notes, panelLoading, panelError, cancellingId,
} = storeToRefs(store)

const agent = agentById('appointments')
const draft = ref('')
const panelOpen = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

function poll(): void {
  void store.refresh()
}

function start(): void {
  void store.openChat()
  timer = setInterval(poll, POLL_MS)
  window.addEventListener('focus', poll)
}

function stop(): void {
  if (timer !== null) clearInterval(timer)
  timer = null
  window.removeEventListener('focus', poll)
  store.closeChat()
}

watch([status, isAdmin], () => {
  if (status.value === 'loading') return
  if (!isAdmin.value) void router.replace({ name: 'agent-list' })
}, { immediate: true })

watch(isAdmin, (admin) => {
  stop()
  if (admin) start()
}, { immediate: true })

onBeforeUnmount(stop)

async function send(): Promise<void> {
  const text = draft.value.trim()
  if (!text || sending.value) return
  draft.value = ''
  const accepted = await store.send(text)
  if (!accepted && !draft.value) draft.value = text
}

function openPanel(): void {
  panelOpen.value = true
  void store.loadPanel()
}
</script>

<template>
  <div v-if="isAdmin" class="relative flex h-full w-full flex-col overflow-hidden bg-surface font-body text-on-surface">
    <AgentChatBar :agent="agent" :show-end="false" show-panel @back="goBack" @panel="openPanel" />

    <div v-if="sendError ?? error" class="flex-none px-3 pt-2">
      <InlineNotice tone="error" size="sm" :dismissible="sendError !== null" @dismiss="sendError = null">{{ sendError ?? error }}</InlineNotice>
    </div>

    <AppointmentsEventList
      :agent="agent"
      :events="events"
      :pending="pending"
      :busy="busy"
      :loading="loading"
      :own-staff-id="staff?.staffId ?? ''"
      :own-name="staff?.name ?? ''"
    />

    <AgentComposer
      :text="draft"
      :images="[]"
      :thinking="sending"
      :allow-images="false"
      @update:text="draft = $event"
      @send="send"
    />

    <AppointmentsAgentPanel
      :open="panelOpen"
      :reminders="reminders"
      :notes="notes"
      :loading="panelLoading"
      :error="panelError"
      :cancelling-id="cancellingId"
      @close="panelOpen = false"
      @cancel-reminder="store.cancelPendingReminder($event)"
    />
  </div>
</template>
