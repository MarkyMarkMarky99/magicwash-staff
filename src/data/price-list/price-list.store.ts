import { defineStore } from 'pinia'
import { onScopeDispose, ref, shallowRef } from 'vue'
import {
  createPriceList,
  listPriceList,
  updatePriceList,
  type PriceListCreatePayload,
  type PriceListDto,
  type PriceListResult,
  type PriceListUpdatePayload,
} from './price-list.service'
import { onCacheInvalidated } from '@/shared/api/response-cache'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export const usePriceListStore = defineStore('price-list', () => {
  const items = shallowRef<PriceListDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const truncated = ref(false)
  const loaded = ref(false)
  const persistedRows = new Map<string, PriceListDto>()
  let loadPromise: Promise<void> | null = null
  let requestId = 0

  function clearMutationError(): void {
    if (loaded.value) error.value = null
  }

  function rowsMatch(left: PriceListDto, right: PriceListDto): boolean {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]) as Set<keyof PriceListDto>
    return [...keys].every((key) => Object.is(left[key], right[key]))
  }

  function mergePersistedRows(readItems: PriceListDto[]): PriceListDto[] {
    const merged = [...readItems]
    for (const [persistedId, persisted] of persistedRows) {
      const index = merged.findIndex((item) => item.id === persistedId)
      if (index >= 0 && rowsMatch(merged[index]!, persisted)) {
        persistedRows.delete(persistedId)
      } else if (index >= 0) {
        merged[index] = persisted
      } else {
        merged.push(persisted)
      }
    }
    return merged
  }

  function reconcileWrite(item: PriceListDto): void {
    persistedRows.set(item.id, item)
    items.value = mergePersistedRows(items.value)
  }

  function applyResult(result: PriceListResult, id: number): void {
    if (id !== requestId) return
    items.value = mergePersistedRows(result.items)
    truncated.value = result.truncated
    loaded.value = !result.truncated
    error.value = null
  }

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    if (loadPromise) return loadPromise

    const id = ++requestId
    loadPromise = (async () => {
      loading.value = true
      error.value = null
      try {
        const result = await listPriceList((fresh) => applyResult(fresh, id))
        applyResult(result, id)
      } catch (reason) {
        if (id === requestId) error.value = errorMessage(reason, 'Unable to load price list')
      } finally {
        if (id === requestId) loading.value = false
        loadPromise = null
      }
    })()

    return loadPromise
  }

  async function create(payload: PriceListCreatePayload): Promise<PriceListDto> {
    loading.value = true
    clearMutationError()
    try {
      const created = await createPriceList(payload)
      reconcileWrite(created)
      await load(true)
      return created
    } catch (reason) {
      error.value = errorMessage(reason, 'Unable to create price list item')
      throw reason
    } finally {
      loading.value = false
    }
  }

  async function update(id: string, payload: PriceListUpdatePayload): Promise<PriceListDto> {
    loading.value = true
    clearMutationError()
    try {
      const updated = await updatePriceList(id, payload)
      reconcileWrite(updated)
      await load(true)
      return updated
    } catch (reason) {
      error.value = errorMessage(reason, 'Unable to update price list item')
      throw reason
    } finally {
      loading.value = false
    }
  }

  const stopInvalidationListener = onCacheInvalidated('/api/price-list', () => {
    if (items.value.length > 0 || loaded.value || truncated.value) void load(true)
  })
  onScopeDispose(stopInvalidationListener)

  return { items, loading, error, loaded, truncated, load, create, update }
})
