import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  cancelReminder,
  fetchHistory,
  fetchImage,
  fetchNotes,
  fetchReminders,
  markRead,
  sendMessage,
  type TeamAgentEvent,
  type TeamAgentId,
  type TeamAgentNote,
  type TeamAgentReminder,
} from './team-agent.service'

export interface OutgoingTeamAgentImage {
  blob: Blob
  filename: string
  url: string
}

export interface PendingTeamAgentMessage {
  localId: string
  text: string
  imageUrls: string[]
  eventId: string | null
}

export type TeamAgentImageState =
  | { status: 'loading' }
  | { status: 'ready', url: string }
  | { status: 'failed' }

const ATTEMPT_SUFFIX = ':attempt'
const RESULT_SUFFIX = ':result'
const ACTION_PREFIX = 'action:'

const LEGACY_APPOINTMENTS_KEY = 'appointments-agent-last-seen-event'
const CHAT_HISTORY_LIMIT = 200
const POLL_LIMIT = 500

function storeId(agentId: TeamAgentId, target: string | undefined): string {
  return agentId === 'personal' ? `team-agent-personal:${target ?? 'self'}` : `team-agent-${agentId}`
}

function lastSeenKey(agentId: TeamAgentId, target: string | undefined, viewer: string | null): string | null {
  if (agentId !== 'personal') return `team-agent-last-seen-event:${agentId}`
  return viewer === null ? null : `team-agent-last-seen-event:personal:${viewer}:${target ?? 'self'}`
}

function readLastSeen(agentId: TeamAgentId, target: string | undefined, viewer: string | null): string | null {
  const key = lastSeenKey(agentId, target, viewer)
  if (key === null) return null
  try {
    const stored = localStorage.getItem(key)
    if (stored !== null || agentId !== 'appointments') return stored
    const legacy = localStorage.getItem(LEGACY_APPOINTMENTS_KEY)
    if (legacy !== null) {
      localStorage.setItem(key, legacy)
      localStorage.removeItem(LEGACY_APPOINTMENTS_KEY)
    }
    return legacy
  } catch {
    return null
  }
}

function writeLastSeen(agentId: TeamAgentId, target: string | undefined, viewer: string | null, id: string): void {
  const key = lastSeenKey(agentId, target, viewer)
  if (key === null) return
  try {
    localStorage.setItem(key, id)
  } catch {
    // Storage blocked: the badge just starts over on this device.
  }
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Something went wrong. Try again.'
}

function attemptKey(id: string): string | null {
  if (!id.startsWith(ACTION_PREFIX) || !id.endsWith(ATTEMPT_SUFFIX)) return null
  return id.slice(ACTION_PREFIX.length, id.length - ATTEMPT_SUFFIX.length)
}

function resultKey(id: string): string | null {
  if (!id.startsWith(ACTION_PREFIX) || !id.endsWith(RESULT_SUFFIX)) return null
  return id.slice(ACTION_PREFIX.length, id.length - RESULT_SUFFIX.length)
}

let localCounter = 0

function defineTeamAgentStore(agentId: TeamAgentId, target: string | undefined) {
  return defineStore(storeId(agentId, target), () => {
    const events = ref<TeamAgentEvent[]>([])
    const busy = ref(false)
    const loaded = ref(false)
    const loading = ref(false)
    const olderLoading = ref(false)
    const hasOlder = ref(false)
    const error = ref<string | null>(null)
    const sendError = ref<string | null>(null)
    const sending = ref(false)
    const pending = ref<PendingTeamAgentMessage[]>([])
    const unreadCount = ref(0)
    const latestUnreadAi = ref<TeamAgentEvent | null>(null)
    const reminders = ref<TeamAgentReminder[]>([])
    const notes = ref<TeamAgentNote[]>([])
    const panelLoading = ref(false)
    const panelError = ref<string | null>(null)
    const cancellingId = ref<string | null>(null)
    const images = ref<Record<string, TeamAgentImageState>>({})

    const visibleEvents = computed(() => {
      const finished = new Set<string>()
      for (const event of events.value) {
        const key = resultKey(event.id)
        if (key !== null) finished.add(key)
      }
      return events.value.filter((event) => {
        const key = attemptKey(event.id)
        return key === null || !finished.has(key)
      })
    })

    let viewing = false
    let latestId: string | null = null
    let viewer: string | null = null
    let lastSeenId: string | null = readLastSeen(agentId, target, viewer)
    let migrationId = lastSeenId
    let confirmedReadId: string | null = null
    let readVersion = 0
    const readWrites = new Set<string>()
    let unreadCursor: string | null = null
    const unreadAttempts = new Set<string>()
    let generation = 0
    let baselineEmpty = false
    let tail: Promise<void> = Promise.resolve()
    let queuedRefresh: Promise<void> | null = null
    let imageGeneration = 0

    function enqueue(operation: () => Promise<void>): Promise<void> {
      const next = tail.then(operation)
      tail = next.catch(() => undefined)
      return next
    }

    function clearUnread(): void {
      unreadCount.value = 0
      latestUnreadAi.value = null
      unreadCursor = null
      unreadAttempts.clear()
    }

    function postRead(id: string): void {
      if (target !== undefined || id === confirmedReadId || readWrites.has(id)) return
      const run = generation
      readWrites.add(id)
      void markRead(agentId, target, id).then(({ readId }) => {
        if (run !== generation || readId === null) return
        readVersion += 1
        if (lastSeenId === id) confirmedReadId = readId
      }).catch(() => undefined).finally(() => {
        if (run === generation) readWrites.delete(id)
      })
    }

    function markSeen(): void {
      clearUnread()
      if (latestId === null) return
      if (latestId !== lastSeenId) {
        lastSeenId = latestId
        writeLastSeen(agentId, target, viewer, latestId)
      }
      migrationId = null
      postRead(latestId)
    }

    function countUnread(fresh: TeamAgentEvent[]): void {
      const finished = new Set<string>()
      for (const event of fresh) {
        const key = resultKey(event.id)
        if (key === null) continue
        finished.add(key)
        if (unreadAttempts.delete(key)) unreadCount.value -= 1
      }
      const counted = fresh.filter((event) => {
        if (event.speaker?.staffId === viewer) return false
        const key = attemptKey(event.id)
        if (key === null) return true
        if (finished.has(key)) return false
        unreadAttempts.add(key)
        return true
      })
      unreadCount.value += counted.length
      const latestAi = counted.findLast(event => event.kind === 'agent' || event.kind === 'system')
      if (latestAi) latestUnreadAi.value = latestAi
      unreadCursor = fresh.at(-1)?.id ?? unreadCursor
    }

    async function fetchUnread(after: string | null, run: number, firstPage?: TeamAgentEvent[]): Promise<TeamAgentEvent[]> {
      let page = firstPage ?? (await fetchHistory(agentId, target, { after: after ?? undefined, limit: POLL_LIMIT })).events
      const unread = [...page]
      while (run === generation && page.length === POLL_LIMIT) {
        const cursor = page[page.length - 1]!.id
        page = (await fetchHistory(agentId, target, { after: cursor, limit: POLL_LIMIT })).events
        if (page.at(-1)?.id === cursor) break
        unread.push(...page)
      }
      return unread
    }

    async function reconcileReadId(readId: string | null | undefined, run: number, version: number): Promise<boolean> {
      // History can contain a snapshot from before a concurrent read write.
      if (target !== undefined || readId === undefined || version !== readVersion || readWrites.size > 0) return false
      const previousMigrationId = migrationId
      migrationId = null
      if (readId === null) {
        if (previousMigrationId !== null) postRead(previousMigrationId)
        return false
      }
      confirmedReadId = readId
      if (readId === lastSeenId) return false
      const unread = viewing ? [] : await fetchUnread(readId, run)
      if (run !== generation) return false
      lastSeenId = readId
      writeLastSeen(agentId, target, viewer, readId)
      clearUnread()
      if (!viewing) countUnread(unread)
      return true
    }

    function removePending(keep: (entry: PendingTeamAgentMessage) => boolean): void {
      const kept: PendingTeamAgentMessage[] = []
      for (const entry of pending.value) {
        if (keep(entry)) kept.push(entry)
        else entry.imageUrls.forEach(url => URL.revokeObjectURL(url))
      }
      pending.value = kept
    }

    function dropReconciledPending(): void {
      const ids = new Set(events.value.map(event => event.id))
      removePending(entry => entry.eventId === null || !ids.has(entry.eventId))
    }

    async function loadImage(id: string, generation: number): Promise<void> {
      let next: TeamAgentImageState
      try {
        next = { status: 'ready', url: URL.createObjectURL(await fetchImage(agentId, target, id)) }
      } catch {
        next = { status: 'failed' }
      }
      if (generation !== imageGeneration) {
        if (next.status === 'ready') URL.revokeObjectURL(next.url)
        return
      }
      images.value = { ...images.value, [id]: next }
    }

    function loadEventImages(list: TeamAgentEvent[]): void {
      const wanted = list.flatMap(event => event.images ?? []).map(image => image.id)
      const missing = [...new Set(wanted)].filter(id => images.value[id] === undefined)
      if (!missing.length) return
      const loading: Record<string, TeamAgentImageState> = {}
      for (const id of missing) loading[id] = { status: 'loading' }
      images.value = { ...images.value, ...loading }
      for (const id of missing) void loadImage(id, imageGeneration)
    }

    function releaseImages(): void {
      imageGeneration += 1
      for (const state of Object.values(images.value)) {
        if (state.status === 'ready') URL.revokeObjectURL(state.url)
      }
      images.value = {}
    }

    async function runRefresh(): Promise<void> {
      queuedRefresh = null
      const run = generation
      const version = readVersion
      const unreadAfter = unreadCursor ?? lastSeenId
      const cursor = loaded.value ? latestId ?? unreadAfter : unreadAfter
      const baseline = cursor === null && !loaded.value && !baselineEmpty
      try {
        const history = await fetchHistory(agentId, target, baseline ? { limit: 1 } : { after: cursor ?? undefined, limit: POLL_LIMIT })
        if (run !== generation) return
        busy.value = history.busy
        error.value = null
        const readChanged = await reconcileReadId(history.readId, run, version)
        if (run !== generation) return
        if (baseline) {
          if (readChanged) return
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
        latestId = fresh.at(-1)?.id ?? latestId
        if (loaded.value && fresh.length) {
          events.value = [...events.value, ...fresh]
          if (viewing) loadEventImages(fresh)
          dropReconciledPending()
        }
        if (viewing) {
          if (!readChanged || fresh.length) markSeen()
        } else if (!readChanged) {
          const unread = await fetchUnread(unreadAfter, run, cursor === unreadAfter ? history.events : undefined)
          if (run === generation) countUnread(unread)
        }
      } catch (reason) {
        if (run === generation) error.value = errorMessage(reason)
      }
    }

    function refresh(): Promise<void> {
      queuedRefresh ??= enqueue(runRefresh)
      return queuedRefresh
    }

    async function runLoadLatest(): Promise<void> {
      const run = generation
      const version = readVersion
      loading.value = true
      try {
        const history = await fetchHistory(agentId, target, { limit: CHAT_HISTORY_LIMIT })
        if (run !== generation) return
        events.value = history.events
        hasOlder.value = history.events.length >= CHAT_HISTORY_LIMIT
        if (viewing) loadEventImages(history.events)
        busy.value = history.busy
        loaded.value = true
        error.value = null
        latestId = history.events.at(-1)?.id ?? latestId
        dropReconciledPending()
        await reconcileReadId(history.readId, run, version)
        if (run === generation && viewing) markSeen()
      } catch (reason) {
        if (run === generation) error.value = errorMessage(reason)
      } finally {
        if (run === generation) loading.value = false
      }
    }

    async function runLoadOlder(): Promise<void> {
      const run = generation
      const version = readVersion
      const oldest = events.value[0]?.id
      try {
        if (oldest === undefined) return
        const history = await fetchHistory(agentId, target, { before: oldest, limit: CHAT_HISTORY_LIMIT })
        if (run !== generation) return
        const known = new Set(events.value.map(event => event.id))
        const older = history.events.filter(event => !known.has(event.id))
        events.value = [...older, ...events.value]
        hasOlder.value = history.events.length >= CHAT_HISTORY_LIMIT
        if (viewing) loadEventImages(older)
        error.value = null
        await reconcileReadId(history.readId, run, version)
      } catch (reason) {
        if (run === generation) error.value = errorMessage(reason)
      } finally {
        if (run === generation) olderLoading.value = false
      }
    }

    function loadOlder(): Promise<void> {
      if (!loaded.value || !hasOlder.value || olderLoading.value) return Promise.resolve()
      olderLoading.value = true
      return enqueue(runLoadOlder)
    }

    function openChat(): Promise<void> {
      viewing = true
      return enqueue(runLoadLatest)
    }

    function closeChat(): void {
      viewing = false
      releaseImages()
    }

    async function send(text: string, outgoing: OutgoingTeamAgentImage[] = []): Promise<boolean> {
      const run = generation
      const localId = `local-${++localCounter}`
      pending.value = [...pending.value, { localId, text, imageUrls: outgoing.map(image => image.url), eventId: null }]
      sendError.value = null
      sending.value = true
      try {
        const accepted = await sendMessage(agentId, target, text, outgoing.map(({ blob, filename }) => ({ blob, filename })))
        if (run !== generation) return true
        const entry = pending.value.find(item => item.localId === localId)
        if (entry) entry.eventId = accepted.eventId
        dropReconciledPending()
        sending.value = false
        await refresh()
        if (!error.value) removePending(item => item.localId !== localId)
        return true
      } catch (reason) {
        if (run !== generation) return false
        removePending(item => item.localId !== localId)
        sendError.value = errorMessage(reason)
        sending.value = false
        void refresh()
        return false
      }
    }

    async function loadPanel(): Promise<void> {
      const run = generation
      panelLoading.value = true
      panelError.value = null
      try {
        const [nextReminders, nextNotes] = await Promise.all([fetchReminders(agentId, target), fetchNotes(agentId, target)])
        if (run !== generation) return
        reminders.value = nextReminders
        notes.value = nextNotes
      } catch (reason) {
        if (run === generation) panelError.value = errorMessage(reason)
      } finally {
        if (run === generation) panelLoading.value = false
      }
    }

    async function cancelPendingReminder(id: string): Promise<void> {
      if (cancellingId.value !== null) return
      const run = generation
      cancellingId.value = id
      panelError.value = null
      try {
        await cancelReminder(agentId, target, id)
        if (run !== generation) return
        reminders.value = reminders.value.filter(reminder => reminder.id !== id)
        void refresh()
      } catch (reason) {
        if (run === generation) panelError.value = errorMessage(reason)
      } finally {
        if (run === generation) cancellingId.value = null
      }
    }

    function reset(): void {
      generation += 1
      events.value = []
      busy.value = false
      loaded.value = false
      loading.value = false
      olderLoading.value = false
      hasOlder.value = false
      error.value = null
      sendError.value = null
      sending.value = false
      removePending(() => false)
      clearUnread()
      reminders.value = []
      notes.value = []
      panelLoading.value = false
      panelError.value = null
      cancellingId.value = null
      releaseImages()
      latestId = null
      confirmedReadId = null
      readWrites.clear()
      baselineEmpty = false
      queuedRefresh = null
    }

    function bindViewer(staffId: string | null): void {
      if (staffId === viewer) return
      reset()
      viewer = staffId
      lastSeenId = readLastSeen(agentId, target, viewer)
      migrationId = lastSeenId
    }

    return {
      events,
      visibleEvents,
      images,
      busy,
      loaded,
      loading,
      olderLoading,
      hasOlder,
      error,
      sendError,
      sending,
      pending,
      unreadCount,
      latestUnreadAi,
      reminders,
      notes,
      panelLoading,
      panelError,
      cancellingId,
      refresh,
      loadOlder,
      bindViewer,
      reset,
      openChat,
      closeChat,
      send,
      loadPanel,
      cancelPendingReminder,
    }
  })
}

const definitions = new Map<string, ReturnType<typeof defineTeamAgentStore>>()

export function useTeamAgentStore(agentId: TeamAgentId, target?: string) {
  const personalTarget = agentId === 'personal' ? target || undefined : undefined
  const id = storeId(agentId, personalTarget)
  let definition = definitions.get(id)
  if (!definition) {
    definition = defineTeamAgentStore(agentId, personalTarget)
    definitions.set(id, definition)
  }
  return definition()
}
