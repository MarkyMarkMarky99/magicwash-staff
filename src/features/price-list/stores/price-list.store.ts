import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createPriceList,
  listAllPriceList,
  updatePriceList,
  type PriceListCreatePayload,
  type PriceListDto,
  type PriceListUpdatePayload,
} from '../services/price-list.service'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

const PRICE_LIST_TRUNCATED_ERROR = 'รายการราคามีมากกว่า 1,000 รายการ จึงโหลดข้อมูลได้ไม่ครบ'

export const usePriceListStore = defineStore('price-list', () => {
  const items = ref<PriceListDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const truncated = ref(false)
  const loaded = ref(false)
  let loadPromise: Promise<void> | null = null

  function clearMutationError(): void {
    if (loaded.value) error.value = null
  }

  function restoreIncompleteLoadError(): void {
    if (truncated.value) error.value = PRICE_LIST_TRUNCATED_ERROR
  }

  async function load(): Promise<void> {
    if (loaded.value) return
    if (loadPromise) return loadPromise

    loadPromise = (async () => {
      loading.value = true
      error.value = null
      try {
        const result = await listAllPriceList()
        items.value = result.items
        truncated.value = result.truncated
        if (result.truncated) {
          error.value = PRICE_LIST_TRUNCATED_ERROR
          loaded.value = false
        } else {
          loaded.value = true
        }
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
    clearMutationError()
    try {
      const created = await createPriceList(payload)
      items.value = [...items.value, created]
      restoreIncompleteLoadError()
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
      items.value = items.value.map((item) => (item.id === id ? updated : item))
      restoreIncompleteLoadError()
      return updated
    } catch (reason) {
      error.value = errorMessage(reason, 'Unable to update price list item')
      throw reason
    } finally {
      loading.value = false
    }
  }

  return { items, loading, error, loaded, truncated, load, create, update }
})
