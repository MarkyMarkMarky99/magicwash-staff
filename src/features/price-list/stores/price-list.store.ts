import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createPriceList,
  listPriceList,
  updatePriceList,
  type PriceListCreatePayload,
  type PriceListDto,
  type PriceListUpdatePayload,
} from '../services/price-list.service'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export const usePriceListStore = defineStore('price-list', () => {
  const items = ref<PriceListDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)
  let loadPromise: Promise<void> | null = null

  async function load(): Promise<void> {
    if (loaded.value) return
    if (loadPromise) return loadPromise

    loadPromise = (async () => {
      loading.value = true
      error.value = null
      try {
        items.value = await listPriceList({ perPage: 100 })
        loaded.value = true
      } catch (reason) {
        error.value = errorMessage(reason, 'Unable to load price list')
      } finally {
        loading.value = false
        loadPromise = null
      }
    })()

    return loadPromise
  }

  async function create(payload: PriceListCreatePayload): Promise<PriceListDto> {
    loading.value = true
    error.value = null
    try {
      const created = await createPriceList(payload)
      items.value = [...items.value, created]
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
    error.value = null
    try {
      const updated = await updatePriceList(id, payload)
      items.value = items.value.map((item) => (item.id === id ? updated : item))
      return updated
    } catch (reason) {
      error.value = errorMessage(reason, 'Unable to update price list item')
      throw reason
    } finally {
      loading.value = false
    }
  }

  return { items, loading, error, loaded, load, create, update }
})
