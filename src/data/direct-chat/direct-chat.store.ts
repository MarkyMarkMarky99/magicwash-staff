import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useAuthStore } from '@/data/auth/auth.store'
import { prepareChatImage } from '@/utils/prepare-chat-image'
import * as service from './direct-chat.service'
import type { DirectChatInbox, DirectChatMessage, DirectChatPeer } from './direct-chat.service'

export interface PendingDirectChatSend { text: string, clientId: string, files: File[] }

export function createDirectChatState(api = service, prepareImage = prepareChatImage) {
  const inbox = ref<DirectChatInbox>([])
  const conversationId = ref<string | null>(null)
  const peer = ref<DirectChatPeer | null>(null)
  const messages = ref<DirectChatMessage[]>([])
  const nextAfter = ref(0)
  const readSeq = ref(0)
  const hasOlder = ref(false)
  const loading = ref(false)
  const loadingOlder = ref(false)
  const inboxLoading = ref(false)
  const sending = ref(false)
  const error = shallowRef<unknown>(null)
  const inboxError = shallowRef<unknown>(null)
  const pendingSend = shallowRef<PendingDirectChatSend | null>(null)
  const imageUrls = ref<Record<string, string>>({})
  const threadVisible = ref(false)
  const unreadTotal = computed(() => inbox.value.reduce((sum, row) => sum + row.unread, 0))
  let viewer: string | null = null
  let session: unknown = null
  let authGeneration = 0
  let threadGeneration = 0
  let inboxVersion = 0
  let inboxFlight: Promise<void> | null = null
  let afterFlight: Promise<void> | null = null
  const imageFlights = new Map<string, Promise<string | null>>()

  function token() { return { auth: authGeneration, thread: threadGeneration, id: conversationId.value } }
  function current(key: ReturnType<typeof token>) { return key.auth === authGeneration && key.thread === threadGeneration && key.id === conversationId.value }
  function closeThread(): void {
    threadGeneration++
    Object.values(imageUrls.value).forEach(url => URL.revokeObjectURL(url))
    imageUrls.value = {}
    imageFlights.clear()
    conversationId.value = null
    peer.value = null
    messages.value = []
    nextAfter.value = 0
    readSeq.value = 0
    hasOlder.value = false
    loading.value = false
    loadingOlder.value = false
    sending.value = false
    error.value = null
    pendingSend.value = null
    threadVisible.value = false
    afterFlight = null
  }
  function bindSession(staffId: string | null, sessionKey: unknown = staffId): void {
    if (viewer === staffId && session === sessionKey) return
    viewer = staffId
    session = sessionKey
    authGeneration++
    inboxVersion++
    inboxFlight = null
    inbox.value = []
    inboxLoading.value = false
    inboxError.value = null
    closeThread()
  }
  function refreshInbox(): Promise<void> {
    if (!viewer) return Promise.resolve()
    if (inboxFlight) return inboxFlight
    const auth = authGeneration
    inboxLoading.value = true
    const flight = (async () => {
      try {
        let version: number
        do {
          version = inboxVersion
          const result = await api.fetchInbox()
          if (auth !== authGeneration) return
          if (version === inboxVersion) { inbox.value = result.conversations; inboxError.value = null }
        } while (version !== inboxVersion)
      } catch (reason) { if (auth === authGeneration) inboxError.value = reason }
      finally { if (auth === authGeneration) { inboxLoading.value = false; inboxFlight = null } }
    })()
    inboxFlight = flight
    return flight
  }
  function invalidateInbox(): Promise<void> { inboxVersion++; return refreshInbox() }
  function mergeMessages(incoming: DirectChatMessage[]): void {
    const merged = new Map(messages.value.map(message => [message.seq, message]))
    incoming.forEach(message => merged.set(message.seq, message))
    messages.value = [...merged.values()].sort((a, b) => a.seq - b.seq)
  }
  async function openThread(id: string): Promise<void> {
    closeThread()
    if (!viewer) return
    conversationId.value = id
    const key = token()
    loading.value = true
    try {
      const result = await api.fetchHistory(id)
      if (!current(key)) return
      peer.value = result.peer
      mergeMessages(result.messages)
      nextAfter.value = result.highWater
      readSeq.value = result.readSeq
      hasOlder.value = result.hasMore
    } catch (reason) { if (current(key)) { error.value = reason; throw reason } }
    finally { if (current(key)) loading.value = false }
  }
  async function startConversation(peerStaffId: string): Promise<string | null> {
    if (!viewer) return null
    const key = token()
    try {
      const result = await api.createConversation(peerStaffId)
      return current(key) ? result.conversationId : null
    } catch (reason) { if (current(key)) throw reason; return null }
  }
  async function loadOlder(): Promise<void> {
    if (!conversationId.value || loading.value || loadingOlder.value || !hasOlder.value) return
    const key = token()
    const before = messages.value[0]?.seq
    loadingOlder.value = true
    try {
      const result = await api.fetchHistory(key.id!, { before })
      if (!current(key)) return
      // Older snapshots must not overwrite translations updated by concurrent polling.
      const loaded = new Set(messages.value.map(message => message.seq))
      mergeMessages(result.messages.filter(message => !loaded.has(message.seq)))
      hasOlder.value = result.hasMore
    } catch (reason) { if (current(key)) { error.value = reason; throw reason } }
    finally { if (current(key)) loadingOlder.value = false }
  }
  function pollThread(): Promise<void> {
    if (!conversationId.value || loading.value) return Promise.resolve()
    if (afterFlight) return afterFlight
    const key = token()
    const flight = (async () => {
      try {
        let hasMore: boolean
        do {
          const cursor = nextAfter.value
          const result = await api.fetchAfter(key.id!, cursor)
          if (!current(key)) return
          if (result.nextAfter < cursor || (result.hasMore && result.nextAfter === cursor)) throw new Error('Direct chat cursor did not advance')
          mergeMessages(result.messages)
          for (const update of result.translationUpdates) {
            const message = messages.value.find(message => message.seq === update.refSeq)
            if (message) message.translate = {
              to: update.lang, state: update.error === 'pending' ? 'pending' : update.error ? 'unavailable' : 'done',
              ...(update.text === undefined ? {} : { text: update.text }),
              ...(update.same === undefined ? {} : { same: update.same }),
              ...(update.error === undefined ? {} : { error: update.error }),
            }
          }
          nextAfter.value = result.nextAfter
          hasMore = result.hasMore
        } while (hasMore)
      } catch (reason) { if (current(key)) error.value = reason }
      finally { if (current(key)) afterFlight = null }
    })()
    afterFlight = flight
    return flight
  }
  async function markVisiblePeerRead(seq: number): Promise<void> {
    if (!threadVisible.value || (typeof document !== 'undefined' && document.hidden) || !conversationId.value || seq <= readSeq.value) return
    const message = messages.value.find(message => message.seq === seq && message.speaker.staffId !== viewer)
    if (!message) return
    const key = token()
    try {
      const result = await api.markRead(key.id!, message.id)
      if (!current(key)) return
      readSeq.value = Math.max(readSeq.value, result.readSeq)
      await invalidateInbox()
    } catch (reason) { if (current(key)) { error.value = reason; throw reason } }
  }
  async function retrySend(): Promise<void> {
    if (!conversationId.value || !pendingSend.value || sending.value) return
    const key = token()
    const pending = pendingSend.value
    sending.value = true
    error.value = null
    try {
      const result = await api.sendMessage(key.id!, { text: pending.text, clientId: pending.clientId }, pending.files)
      if (!current(key)) return
      mergeMessages([result.message])
      pendingSend.value = null
      void invalidateInbox()
    } catch (reason) { if (current(key)) { error.value = reason; throw reason } }
    finally { if (current(key)) sending.value = false }
  }
  async function send(text: string, files: File[] = [], options: { prepared?: boolean } = {}): Promise<void> {
    if (!conversationId.value || sending.value || pendingSend.value) return
    if (text.length > 4000 || files.length > 3 || (!text.trim() && !files.length)) throw new Error('Invalid direct chat message')
    const key = token()
    sending.value = true
    error.value = null
    try {
      const prepared = options.prepared ? files.slice() : await Promise.all(files.map(prepareImage))
      if (!current(key)) return
      pendingSend.value = { text, clientId: crypto.randomUUID(), files: prepared }
    } catch (reason) { if (current(key)) { error.value = reason; throw reason } }
    finally { if (current(key)) sending.value = false }
    if (current(key)) await retrySend()
  }
  function discardPendingSend(): void { if (!sending.value) pendingSend.value = null }
  async function retryTranslation(seq: number): Promise<void> {
    if (!conversationId.value) return
    const key = token()
    try {
      const result = await api.retryTranslation(key.id!, seq)
      if (!current(key)) return
      const message = messages.value.find(message => message.seq === seq)
      if (message) message.translate = result.translate
    } catch (reason) { if (current(key)) { error.value = reason; throw reason } }
  }
  function loadImage(imageId: string): Promise<string | null> {
    if (!conversationId.value) return Promise.resolve(null)
    if (imageUrls.value[imageId]) return Promise.resolve(imageUrls.value[imageId])
    const existing = imageFlights.get(imageId)
    if (existing) return existing
    const key = token()
    const flight = (async () => {
      try {
        const blob = await api.fetchImage(key.id!, imageId)
        if (!current(key)) return null
        const url = URL.createObjectURL(blob)
        imageUrls.value[imageId] = url
        return url
      } catch (reason) { if (current(key)) throw reason; return null }
      finally { if (current(key)) imageFlights.delete(imageId) }
    })()
    imageFlights.set(imageId, flight)
    return flight
  }
  function setThreadVisible(visible: boolean): void { threadVisible.value = visible }
  return { inbox, inboxLoading, inboxError, unreadTotal, conversationId, peer, messages, nextAfter, readSeq, hasOlder,
    loading, loadingOlder, sending, error, pendingSend, imageUrls, threadVisible,
    bindSession, refreshInbox, invalidateInbox, startConversation, openThread, closeThread, loadOlder, pollThread,
    markVisiblePeerRead, send, retrySend, discardPendingSend, retryTranslation, loadImage, setThreadVisible }
}

export const useDirectChatStore = defineStore('direct-chat', () => {
  const state = createDirectChatState()
  const auth = useAuthStore()
  watch([() => auth.status, () => auth.staff, () => auth.role], () => {
    const allowed = !!auth.staff && auth.status === 'signedIn' && (auth.role === 'admin' || auth.role === 'staff')
    state.bindSession(allowed ? auth.staff!.staffId : null, auth.staff)
  }, { immediate: true, flush: 'sync' })
  let timer: ReturnType<typeof setInterval> | undefined
  function stop() { clearInterval(timer); timer = undefined }
  function resume() {
    stop()
    if (!state.threadVisible.value || (typeof document !== 'undefined' && document.hidden)) return
    void state.pollThread()
    timer = setInterval(() => void state.pollThread(), 15000)
  }
  watch([state.threadVisible, state.conversationId, state.loading], resume, { flush: 'sync' })
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', resume)
  onScopeDispose(() => {
    stop()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', resume)
    state.closeThread()
  })
  return state
})
