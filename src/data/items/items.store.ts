import { defineStore } from 'pinia'
import { onScopeDispose, ref, shallowRef } from 'vue'
import { onCacheInvalidated } from '@/shared/api/response-cache'
import { createItem, listItems, type ItemCreatePayload, type ItemDto, type ItemsResult } from './items.service'

export const useItemsStore = defineStore('items', () => {
  const items = shallowRef<ItemDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const truncated = ref(false)
  const createdRows = new Map<string, ItemDto>()
  let loaded = false
  let loadPromise: Promise<void> | null = null

  function apply(result: ItemsResult) {
    const rows = new Map(result.items.map((item) => [item.id, item]))
    // A successful append can precede its appearance in GViz reads.
    for (const [id, item] of createdRows) {
      if (rows.has(id)) createdRows.delete(id)
      else rows.set(id, item)
    }
    items.value = [...rows.values()]
    truncated.value = result.truncated
    error.value = null
    loaded = true
  }

  async function load(): Promise<void> {
    if (loadPromise) return loadPromise
    loading.value = true
    error.value = null
    loadPromise = (async () => {
      try { apply(await listItems(apply)) }
      catch (reason) { error.value = reason instanceof Error ? reason.message : 'Unable to load items' }
      finally { loading.value = false; loadPromise = null }
    })()
    return loadPromise
  }

  async function create(payload: ItemCreatePayload): Promise<ItemDto> {
    const item = await createItem(payload)
    createdRows.set(item.id, item)
    items.value = [...items.value.filter((row) => row.id !== item.id), item]
    return item
  }

  const stopInvalidationListener = onCacheInvalidated('/api/items', () => {
    if (loaded || items.value.length > 0) void load()
  })
  onScopeDispose(stopInvalidationListener)

  return { items, loading, error, truncated, load, create }
})
