import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  cancelReminder,
  fetchHistory,
  fetchNotes,
  fetchReminders,
  sendMessage,
  type AppointmentsAgentEvent,
  type AppointmentsAgentNote,
  type AppointmentsAgentReminder,
} from './appointments-agent.service'

export interface PendingAppointmentsMessage {
  localId: string
  text: string
  eventId: string | null
}

const LAST_SEEN_KEY = 'appointments-agent-last-seen-event'
const CHAT_HISTORY_LIMIT = 200
const POLL_LIMIT = 500

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY)
  } catch {
    return null
  }
}

function writeLastSeen(id: string): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, id)
  } catch {
    // Storage blocked: the badge just starts over on this device.
  }
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong. Try again.'
}

let localCounter = 0

export const useAppointmentsAgentStore = defineStore('appointments-agent', () => {
  const events = ref<AppointmentsAgentEvent[]>([])
  const busy = ref(false)
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const sendError = ref<string | null>(null)
  const sending = ref(false)
  const pending = ref<PendingAppointmentsMessage[]>([])
  const unreadCount = ref(0)
  const reminders = ref<AppointmentsAgentReminder[]>([])
  const notes = ref<AppointmentsAgentNote[]>([])
  const panelLoading = ref(false)
  const panelError = ref<string | null>(null)
  const cancellingId = ref<string | null>(null)

  let viewing = false
  let latestId: string | null = null
  let lastSeenId: string | null = readLastSeen()
  let baselineEmpty = false
  let tail: Promise<void> = Promise.resolve()
  let queuedRefresh: Promise<void> | null = null

  function enqueue(operation: () => Promise<void>): Promise<void> {
    const next = tail.then(operation)
    tail = next.catch(() => undefined)
    return next
  }

  function markSeen(): void {
    unreadCount.value = 0
    if (latestId === null || latestId === lastSeenId) return
    lastSeenId = latestId
    writeLastSeen(latestId)
  }

  function dropReconciledPending(): void {
    const ids = new Set(events.value.map(event => event.id))
    pending.value = pending.value.filter(entry => entry.eventId === null || !ids.has(entry.eventId))
  }

  async function runRefresh(): Promise<void> {
    queuedRefresh = null
    const cursor = latestId ?? lastSeenId
    const baseline = cursor === null && !loaded.value && !baselineEmpty
    try {
      const history = await fetchHistory(baseline ? { limit: 1 } : { after: cursor ?? undefined, limit: POLL_LIMIT })
      busy.value = history.busy
      error.value = null
      if (baseline) {
        const first = history.events.at(-1)
        if (first) {
          latestId = first.id
          markSeen()
        } else {
          baselineEmpty = true
        }
        return
      }
      const known = new Set(events.value.map(event => event.id))
      const fresh = history.events.filter(event => !known.has(event.id))
      if (!fresh.length) return
      latestId = fresh[fresh.length - 1]!.id
      if (loaded.value) {
        events.value = [...events.value, ...fresh]
        dropReconciledPending()
      }
      if (viewing) markSeen()
      else unreadCount.value += fresh.length
    } catch (reason) {
      error.value = errorMessage(reason)
    }
  }

  function refresh(): Promise<void> {
    queuedRefresh ??= enqueue(runRefresh)
    return queuedRefresh
  }

  async function runLoadLatest(): Promise<void> {
    loading.value = true
    try {
      const history = await fetchHistory({ limit: CHAT_HISTORY_LIMIT })
      events.value = history.events
      busy.value = history.busy
      loaded.value = true
      error.value = null
      latestId = history.events.at(-1)?.id ?? latestId
      dropReconciledPending()
      if (viewing) markSeen()
    } catch (reason) {
      error.value = errorMessage(reason)
    } finally {
      loading.value = false
    }
  }

  function openChat(): Promise<void> {
    viewing = true
    return enqueue(runLoadLatest)
  }

  function closeChat(): void {
    viewing = false
  }

  async function send(text: string): Promise<boolean> {
    const localId = `local-${++localCounter}`
    pending.value = [...pending.value, { localId, text, eventId: null }]
    sendError.value = null
    sending.value = true
    try {
      const accepted = await sendMessage(text)
      const entry = pending.value.find(item => item.localId === localId)
      if (entry) entry.eventId = accepted.eventId
      dropReconciledPending()
      sending.value = false
      await refresh()
      if (!error.value) pending.value = pending.value.filter(item => item.localId !== localId)
      return true
    } catch (reason) {
      pending.value = pending.value.filter(item => item.localId !== localId)
      sendError.value = errorMessage(reason)
      sending.value = false
      void refresh()
      return false
    }
  }

  async function loadPanel(): Promise<void> {
    panelLoading.value = true
    panelError.value = null
    try {
      const [nextReminders, nextNotes] = await Promise.all([fetchReminders(), fetchNotes()])
      reminders.value = nextReminders
      notes.value = nextNotes
    } catch (reason) {
      panelError.value = errorMessage(reason)
    } finally {
      panelLoading.value = false
    }
  }

  async function cancelPendingReminder(id: string): Promise<void> {
    if (cancellingId.value !== null) return
    cancellingId.value = id
    panelError.value = null
    try {
      await cancelReminder(id)
      reminders.value = reminders.value.filter(reminder => reminder.id !== id)
      void refresh()
    } catch (reason) {
      panelError.value = errorMessage(reason)
    } finally {
      cancellingId.value = null
    }
  }

  return {
    events,
    busy,
    loaded,
    loading,
    error,
    sendError,
    sending,
    pending,
    unreadCount,
    reminders,
    notes,
    panelLoading,
    panelError,
    cancellingId,
    refresh,
    openChat,
    closeChat,
    send,
    loadPanel,
    cancelPendingReminder,
  }
})
