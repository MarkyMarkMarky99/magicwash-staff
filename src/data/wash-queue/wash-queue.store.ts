import type { z } from 'zod'
import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import { onCacheInvalidated } from '@/shared/api/response-cache'
import type { washQueueRowSchema, washQueueCreateSchema, washQueueUpdateSchema } from '@contracts/wash-queue/wash-queue-api.schema'
import { listWashQueue, createWashQueue, actOnWashQueue } from './wash-queue.service'

type WashQueueDto = z.infer<typeof washQueueRowSchema>
type WashQueueCreate = z.infer<typeof washQueueCreateSchema>
type WashQueueUpdate = z.infer<typeof washQueueUpdateSchema>

export const useWashQueueStore = defineStore('wash-queue', () => {
  const items = ref<WashQueueDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pending = new Map<string, Partial<WashQueueDto>>()
  const confirmed = new Map<string, { row: WashQueueDto; confirmedAt: number }>()
  let sequence = 0
  let started = false
  let inFlight: Promise<void> | null = null
  function load(): Promise<void> {
    return inFlight ?? reload()
  }
  function reload(): Promise<void> {
    const request = ++sequence
    started = true
    loading.value = true
    error.value = null
    inFlight = (async () => {
      try {
        const rows = await listWashQueue()
        if (request === sequence) {
          const now = Date.now()
          for (const [id, saved] of confirmed) {
            if (now - saved.confirmedAt >= 30_000) confirmed.delete(id)
          }
          const fetchedIds = new Set(rows.map(row => row.id))
          items.value = rows.map(row => {
            const saved = confirmed.get(row.id)
            if (saved && row.updatedAt < saved.row.updatedAt) row = saved.row
            else confirmed.delete(row.id)
            const patch = pending.get(row.id)
            return patch ? { ...row, ...patch } : row
          })
          for (const [id, saved] of confirmed) {
            if (!fetchedIds.has(id)) items.value.push(saved.row)
          }
          items.value.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        }
      } catch {
        if (request === sequence) error.value = 'Could not load the wash queue.'
      } finally {
        if (request === sequence) {
          loading.value = false
          inFlight = null
        }
      }
    })()
    return inFlight
  }
  async function create(payload: WashQueueCreate): Promise<void> {
    const row = await createWashQueue(payload)
    if (!items.value.some(item => item.id === row.id)) {
      items.value.push(row)
      items.value.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
    confirmed.set(row.id, { row, confirmedAt: Date.now() })
  }
  // holdMs delays showing the optimistic move; the server row replaces it as soon as the PATCH resolves.
  async function action(id: string, body: WashQueueUpdate, holdMs = 0): Promise<void> {
    const patch: Partial<WashQueueDto> = {
      status: ({ load: 'In Progress', unload: 'Completed', collect: 'Collected', cancel: 'Cancelled' } as const)[body.action],
    }
    if (body.action === 'load') patch.loadedAt = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' })
    pending.set(id, patch)
    const reveal = (): void => {
      if (pending.get(id) === patch) items.value = items.value.map(row => row.id === id ? { ...row, ...patch } : row)
    }
    const timer = holdMs > 0 ? setTimeout(reveal, holdMs) : undefined
    if (holdMs <= 0) reveal()
    try {
      const updated = await actOnWashQueue(id, body)
      clearTimeout(timer)
      pending.delete(id)
      confirmed.set(id, { row: updated, confirmedAt: Date.now() })
      items.value = items.value.map(row => row.id === id ? updated : row)
    } catch (reason) {
      clearTimeout(timer)
      pending.delete(id)
      await load()
      throw reason
    }
  }
  onScopeDispose(onCacheInvalidated('/api/wash-queue', () => {
    if (started) void reload()
  }))
  return { items, loading, error, load, create, action }
})
