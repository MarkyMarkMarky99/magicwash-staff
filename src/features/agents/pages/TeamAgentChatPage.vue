<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import type { BillingDraft } from '@contracts/ai-gateway/billing-draft.schema'
import { invoiceCreateRoute } from '@/shared/navigation/form-routes'
import { setInvoiceCreatePrefill } from '@/shared/navigation/invoice-create-prefill'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import { useGoBack } from '@/shared/composables/use-go-back'
import { useAuthStore } from '@/data/auth/auth.store'
import { useStaffStore } from '@/data/staff/staff.store'
import { useTeamAgentStore, type OutgoingTeamAgentImage } from '@/data/team-agent/team-agent.store'
import { setTargetName } from '@/data/team-agent/team-agent.service'
import AgentChatBar from '../components/AgentChatBar.vue'
import AgentComposer from '../components/AgentComposer.vue'
import TeamAgentEventList from '../components/TeamAgentEventList.vue'
import TeamAgentPanel from '../components/TeamAgentPanel.vue'
import { agentById, agentVisibleToRole } from '../agents'
import { MAX_DRAFT_IMAGES, type DraftImage, type TeamAgentId } from '../agent-chat.types'
import { downscaleScreenshot } from '../utils/downscale-screenshot'

const POLL_MS = 15000

const props = defineProps<{ agentId: TeamAgentId; staffId?: string }>()

const router = useRouter()
const { goBack } = useGoBack()
const authStore = useAuthStore()
const staffStore = useStaffStore()
const { status, role, staff, isAdmin } = storeToRefs(authStore)
const target = props.agentId === 'personal' && isAdmin.value && props.staffId && props.staffId !== staff.value?.staffId
  ? props.staffId
  : undefined
const store = useTeamAgentStore(props.agentId, target)
store.bindViewer(staff.value?.staffId ?? null)
const {
  visibleEvents, images, pending, busy, loading, olderLoading, hasOlder, error, sendError, sending,
  reminders, notes, panelLoading, panelError, cancellingId,
} = storeToRefs(store)

const agent = agentById(props.agentId)
const title = computed(() => target === undefined ? undefined : staffStore.nameOf(target))
watch(title, (name) => {
  if (target !== undefined && name && name !== target) setTargetName(target, name)
}, { immediate: true })
const canView = computed(() => agentVisibleToRole(agent, role.value))

function openBillingDraft(draft: BillingDraft): void {
  if (props.agentId !== 'billing' || !isAdmin.value) return
  setInvoiceCreatePrefill(draft)
  void router.push(invoiceCreateRoute({ customerId: draft.customerId, orderId: draft.orderId }))
}

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
  if (target !== undefined && !staffStore.loaded) void staffStore.load()
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

watch([status, canView], () => {
  if (status.value === 'loading') return
  if (!canView.value) void router.replace({ name: 'agent-list' })
}, { immediate: true })

watch(canView, (allowed) => {
  stop()
  if (allowed) start()
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
  let outgoing: OutgoingTeamAgentImage[]
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

function sendCardMessage(text: string): void {
  if (sending.value || preparing.value) return
  void store.send(text, [])
}

function openPanel(): void {
  panelOpen.value = true
  void store.loadPanel()
}
</script>

<template>
  <div v-if="canView" class="relative flex h-full w-full flex-col overflow-hidden bg-surface font-body text-on-surface">
    <AgentChatBar :agent="agent" :title="title" :show-end="false" show-panel @back="goBack" @panel="openPanel" />

    <div v-if="sendError ?? error" class="flex-none px-3 pt-2">
      <InlineNotice tone="error" size="sm" :dismissible="sendError !== null" @dismiss="sendError = null">{{ sendError ?? error }}</InlineNotice>
    </div>

    <TeamAgentEventList
      :agent="agent"
      :events="visibleEvents"
      :image-states="images"
      :pending="pending"
      :busy="busy"
      :loading="loading"
      :has-older="hasOlder"
      :older-loading="olderLoading"
      :own-staff-id="staff?.staffId ?? ''"
      :own-name="staff?.name ?? ''"
      @load-older="store.loadOlder()"
      :card-message-disabled="sending || preparing"
      @open-billing-draft="openBillingDraft"
      @open-card-route="router.push($event)"
      @send-card-message="sendCardMessage"
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

    <TeamAgentPanel
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
