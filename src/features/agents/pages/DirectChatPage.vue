<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { AiGatewayError } from '@shared/ai-gateway/ai-gateway.errors'
import InlineNotice from '@/shared/components/InlineNotice.vue'
import { useGoBack } from '@/shared/composables/use-go-back'
import { useAuthStore } from '@/data/auth/auth.store'
import { useDirectChatStore } from '@/data/direct-chat/direct-chat.store'
import type { TeamAgentEvent } from '@/data/team-agent/team-agent.service'
import type { TeamAgentImageState } from '@/data/team-agent/team-agent.store'
import { ChatImagePreparationError } from '@/utils/prepare-chat-image'
import AgentComposer from '../components/AgentComposer.vue'
import DirectChatBar from '../components/DirectChatBar.vue'
import DirectChatTranslation from '../components/DirectChatTranslation.vue'
import TeamAgentEventList from '../components/TeamAgentEventList.vue'
import { MAX_DRAFT_IMAGES, type DraftImage } from '../agent-chat.types'

const MAX_TEXT_LENGTH = 4000
const IMAGE_PRELOAD_MARGIN = '300px 0px'

const props = defineProps<{ conversationId: string }>()

const router = useRouter()
const { goBack } = useGoBack()
const { staff } = storeToRefs(useAuthStore())
const store = useDirectChatStore()
const { messages, peer, loading, loadingOlder, hasOlder, sending, error, pendingSend, imageUrls } = storeToRefs(store)

const viewerId = computed(() => staff.value?.staffId ?? '')
const draft = ref('')
const draftImages = ref<DraftImage[]>([])
const sendError = ref<string | null>(null)
const loadFailed = ref(false)
const olderFailed = ref(false)
const failedImages = ref<Record<string, true>>({})
const retryingTranslations = ref<number[]>([])
const atBottom = ref(false)
const pageVisible = ref(!document.hidden)
const threadReady = ref(false)
const list = ref<InstanceType<typeof TeamAgentEventList> | null>(null)
let draftCounter = 0
let openTicket = 0
let observer: IntersectionObserver | null = null
const requestedImages = new Set<string>()

/** The page owns the NOT_FOUND route error: an inaccessible conversation returns to Chats. */
function leaveIfUnavailable(reason: unknown): boolean {
  if (!(reason instanceof AiGatewayError) || reason.code !== 'NOT_FOUND') return false
  void router.replace({ name: 'agent-list', query: { notice: 'conversation-unavailable' } })
  return true
}

async function open(id: string, viewer: string): Promise<void> {
  const ticket = ++openTicket
  threadReady.value = false
  loadFailed.value = false
  olderFailed.value = false
  failedImages.value = {}
  requestedImages.clear()
  if (!viewer) return
  try {
    await store.openThread(id)
    if (ticket !== openTicket) return
    threadReady.value = true
    store.setThreadVisible(pageVisible.value)
  } catch (reason) {
    if (ticket !== openTicket || leaveIfUnavailable(reason)) return
    loadFailed.value = true
  }
}

watch([() => props.conversationId, viewerId], ([id, viewer]) => void open(id, viewer), { immediate: true })

watch(error, (reason) => {
  if (reason) leaveIfUnavailable(reason)
})

function onVisibilityChange(): void {
  pageVisible.value = !document.hidden
  if (threadReady.value) store.setThreadVisible(pageVisible.value)
}
document.addEventListener('visibilitychange', onVisibilityChange)

onBeforeUnmount(() => {
  openTicket++
  document.removeEventListener('visibilitychange', onVisibilityChange)
  observer?.disconnect()
  observer = null
  store.closeThread()
  draftImages.value.forEach(image => URL.revokeObjectURL(image.url))
})

// Messages shown by the shared event list.
const messageById = computed(() => new Map(messages.value.map(message => [message.id, message])))
const events = computed<TeamAgentEvent[]>(() => messages.value.map(message => ({
  id: message.id,
  at: message.at,
  kind: 'staff',
  speaker: message.speaker,
  text: message.text,
  images: message.images?.map(image => ({ id: image.id, name: 'Photo', type: image.type })),
})))

const imageStates = computed(() => {
  const states: Record<string, TeamAgentImageState> = {}
  for (const message of messages.value) {
    for (const image of message.images ?? []) {
      const url = imageUrls.value[image.id]
      states[image.id] = url ? { status: 'ready', url } : failedImages.value[image.id] ? { status: 'failed' } : { status: 'loading' }
    }
  }
  return states
})

// Images download lazily, once their placeholder is near the viewport.
function onImageIntersect(entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    const element = entry.target as HTMLElement
    const id = element.dataset.imageId
    observer?.unobserve(element)
    if (!id || requestedImages.has(id)) continue
    requestedImages.add(id)
    store.loadImage(id).catch((reason) => {
      if (leaveIfUnavailable(reason)) return
      failedImages.value = { ...failedImages.value, [id]: true }
    })
  }
}

function observeImages(): void {
  const root = list.value?.$el as HTMLElement | undefined
  if (!root || typeof IntersectionObserver === 'undefined') return
  observer ??= new IntersectionObserver(onImageIntersect, { root, rootMargin: IMAGE_PRELOAD_MARGIN })
  root.querySelectorAll<HTMLElement>('[data-image-id]').forEach(element => observer?.observe(element))
}

watch([messages, loading], () => void nextTick(observeImages), { flush: 'post' })

// The read marker only follows what the viewer can actually see.
const latestPeerSeq = computed(() => {
  for (let index = messages.value.length - 1; index >= 0; index--) {
    const message = messages.value[index]
    if (message.speaker.staffId !== viewerId.value) return message.seq
  }
  return 0
})

function markRead(): void {
  if (!threadReady.value || !pageVisible.value || !atBottom.value || loading.value) return
  const seq = latestPeerSeq.value
  if (seq <= store.readSeq) return
  store.markVisiblePeerRead(seq).catch(leaveIfUnavailable)
}

watch([atBottom, latestPeerSeq, pageVisible, threadReady, loading], markRead, { flush: 'post' })

function loadOlder(): void {
  store.loadOlder().then(
    () => { olderFailed.value = false },
    (reason) => {
      if (!leaveIfUnavailable(reason)) olderFailed.value = true
    },
  )
}

async function retryLoad(): Promise<void> {
  await open(props.conversationId, viewerId.value)
}

function retryTranslation(seq: number): void {
  if (retryingTranslations.value.includes(seq)) return
  retryingTranslations.value = [...retryingTranslations.value, seq]
  store.retryTranslation(seq).catch(leaveIfUnavailable).finally(() => {
    retryingTranslations.value = retryingTranslations.value.filter(item => item !== seq)
  })
}

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

function clearDraft(): void {
  draft.value = ''
  draftImages.value.forEach(image => URL.revokeObjectURL(image.url))
  draftImages.value = []
}

async function send(): Promise<void> {
  const text = draft.value.trim()
  const files = draftImages.value.map(image => image.file)
  if ((!text && !files.length) || !threadReady.value || sending.value || pendingSend.value) return
  sendError.value = null
  try {
    await store.send(text, files)
    // A failed send keeps its payload as pendingSend, and the draft stays in the composer.
    if (!store.pendingSend) clearDraft()
  } catch (reason) {
    if (leaveIfUnavailable(reason) || store.pendingSend) return
    sendError.value = reason instanceof ChatImagePreparationError
      ? 'Could not prepare an image. Remove it and try again.'
      : 'Could not send the message. Try again.'
  }
}

async function retrySend(): Promise<void> {
  const sentText = store.pendingSend?.text
  try {
    await store.retrySend()
    if (!store.pendingSend && draft.value.trim() === sentText) clearDraft()
  } catch (reason) {
    leaveIfUnavailable(reason)
  }
}
</script>

<template>
  <div class="relative flex h-full w-full flex-col overflow-hidden bg-surface font-body text-on-surface">
    <DirectChatBar :name="peer?.name ?? ''" @back="goBack" />

    <div v-if="loadFailed" class="flex-none px-3 pt-2">
      <InlineNotice tone="error" size="sm">
        Could not load this chat
        <button type="button" class="ml-1 min-h-8 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="retryLoad">Retry</button>
      </InlineNotice>
    </div>

    <TeamAgentEventList
      ref="list"
      :events="events"
      :image-states="imageStates"
      :pending="[]"
      :busy="false"
      :loading="loading"
      :has-older="hasOlder"
      :older-loading="loadingOlder"
      :auto-load-older="!olderFailed"
      :own-staff-id="viewerId"
      :own-name="staff?.name ?? ''"
      @load-older="loadOlder"
      @bottom-change="atBottom = $event"
    >
      <template #staff-extra="{ event, own }">
        <DirectChatTranslation
          v-if="messageById.get(event.id)"
          :message="messageById.get(event.id)!"
          :own="own"
          :retrying="retryingTranslations.includes(messageById.get(event.id)!.seq)"
          @retry="retryTranslation"
        />
      </template>
    </TeamAgentEventList>

    <div v-if="pendingSend && !sending" class="flex-none px-3 pb-2">
      <InlineNotice tone="error" size="sm">
        Message not sent
        <button type="button" class="ml-2 min-h-8 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="retrySend">Retry</button>
        <button type="button" class="ml-2 min-h-8 font-bold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime" @click="store.discardPendingSend()">Discard</button>
      </InlineNotice>
    </div>
    <div v-else-if="sendError" class="flex-none px-3 pb-2">
      <InlineNotice tone="error" size="sm" dismissible @dismiss="sendError = null">{{ sendError }}</InlineNotice>
    </div>

    <AgentComposer
      :text="draft"
      :images="draftImages"
      :thinking="sending || !!pendingSend || !threadReady"
      :maxlength="MAX_TEXT_LENGTH"
      @update:text="draft = $event"
      @add-files="addFiles"
      @remove-image="removeImage"
      @send="send"
    />
  </div>
</template>
