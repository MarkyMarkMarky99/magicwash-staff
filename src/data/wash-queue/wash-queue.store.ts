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
        if (request === sequence) items.value = rows
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
    await createWashQueue(payload)
    await load()
  }
  async function action(id: string, body: WashQueueUpdate): Promise<void> {
    await actOnWashQueue(id, body)
    await load()
  }
  onScopeDispose(onCacheInvalidated('/api/wash-queue', () => {
    if (started) void reload()
  }))
  return { items, loading, error, load, create, action }
})
