<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import { useGoBack } from '@/shared/composables/use-go-back'
import { useAuthStore } from '@/data/auth/auth.store'
import { useAppointmentsAgentStore, type OutgoingAppointmentsImage } from '@/data/appointments-agent/appointments-agent.store'
import AgentChatBar from '../components/AgentChatBar.vue'
import AgentComposer from '../components/AgentComposer.vue'
import AppointmentsAgentPanel from '../components/AppointmentsAgentPanel.vue'
import AppointmentsEventList from '../components/AppointmentsEventList.vue'
import { agentById } from '../agents'
import { MAX_DRAFT_IMAGES, type DraftImage } from '../agent-chat.types'
import { downscaleScreenshot } from '../utils/downscale-screenshot'

const POLL_MS = 15000

const router = useRouter()
const { goBack } = useGoBack()
const authStore = useAuthStore()
const store = useAppointmentsAgentStore()
const { status, isAdmin, staff } = storeToRefs(authStore)
const {
  visibleEvents, images, pending, busy, loading, error, sendError, sending,
  reminders, notes, panelLoading, panelError, cancellingId,
} = storeToRefs(store)

const agent = agentById('appointments')
const draft = ref('')
const draftImages = ref<DraftImage[]>([])
const preparing = ref(false)
let draftCounter = 0
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

onBeforeUnmount(() => {
  stop()
  draftImages.value.forEach(image => URL.revokeObjectURL(image.url))
})

function addFiles(files: File[]): void {
  for (const file of files) {
    if (draftImages.value.length >= MAX_DRAFT_IMAGES) break
    if (!file.type.startsWith('image/')) continue
    draftImages.value.push({ id: `draft-${++draftCounter}`, file, url: URL.createObjectURL(file) })
  }
}

function removeImage(id: string): void {
  const image = draftImages.value.find(item => item.id === id)
  if (!image) return
  URL.revokeObjectURL(image.url)
  draftImages.value = draftImages.value.filter(item => item.id !== id)
}

async function send(): Promise<void> {
  const text = draft.value.trim()
  const drafts = draftImages.value
  if ((!text && !drafts.length) || sending.value || preparing.value) return
  draft.value = ''
  draftImages.value = []
  preparing.value = true
  let outgoing: OutgoingAppointmentsImage[]
  try {
    outgoing = await Promise.all(drafts.map(async (image, index) => ({
      blob: await downscaleScreenshot(image.file), filename: `image-${index + 1}.jpg`, url: image.url,
    })))
  } catch (reason) {
    sendError.value = reason instanceof Error ? reason.message : 'Unable to prepare the images. Try again.'
    if (!draft.value) draft.value = text
    if (draftImages.value.length) drafts.forEach(image => URL.revokeObjectURL(image.url))
    else draftImages.value = drafts
    preparing.value = false
    return
  }
  preparing.value = false
  const accepted = await store.send(text, outgoing)
  if (accepted) return
  if (!draft.value) draft.value = text
  if (!draftImages.value.length) addFiles(drafts.map(image => image.file))
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
      :events="visibleEvents"
      :image-states="images"
      :pending="pending"
      :busy="busy"
      :loading="loading"
      :own-staff-id="staff?.staffId ?? ''"
      :own-name="staff?.name ?? ''"
    />

    <AgentComposer
      :text="draft"
      :images="draftImages"
      :thinking="sending || preparing"
      @update:text="draft = $event"
      @add-files="addFiles"
      @remove-image="removeImage"
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
