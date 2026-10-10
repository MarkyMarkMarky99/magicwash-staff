import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listWashProducts, type WashProductDto } from './wash-products.service'

export const useWashProductsStore = defineStore('wash-products', () => {
  const items = ref<WashProductDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let loaded = false
  let pending: Promise<void> | null = null
  function load(): Promise<void> {
    if (loaded) return Promise.resolve()
    if (pending) return pending
    loading.value = true
    error.value = null
    pending = listWashProducts().then((rows) => {
      items.value = rows
      loaded = true
    }).catch(() => {
      error.value = 'Could not load the wash products.'
    }).finally(() => {
      loading.value = false
      pending = null
    })
    return pending
  }
  function activeOf(type: WashProductDto['type']): WashProductDto[] {
    return items.value.filter((product) => product.status === 'ACTIVE' && product.type === type)
      .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.id.localeCompare(b.id))
  }
  function nameOf(id: string): string {
    return items.value.find((product) => product.id === id)?.name ?? id
  }
  return { items, loading, error, load, activeOf, nameOf }
})
