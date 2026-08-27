import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createPackage,
  listPackages,
  updatePackage,
  type PackageCreatePayload,
  type PackageDto,
  type PackageUpdatePayload,
} from '../services/package.service'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export const usePackageStore = defineStore('packages', () => {
  const items = ref<PackageDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)
  const activePackages = computed(() => items.value.filter((item) => item.deletedAt === null))
  let loadPromise: Promise<void> | null = null

  async function load(): Promise<void> {
    if (loaded.value) return
    if (loadPromise) return loadPromise

    loadPromise = (async () => {
      loading.value = true
      error.value = null
      try {
        items.value = await listPackages({ perPage: 200 })
        loaded.value = true
      } catch (reason) {
        error.value = errorMessage(reason, 'Unable to load packages')
      } finally {
        loading.value = false
        loadPromise = null
      }
    })()

    return loadPromise
  }

  async function create(payload: PackageCreatePayload): Promise<PackageDto> {
    loading.value = true
    error.value = null
    try {
      const created = await createPackage(payload)
      items.value = [...items.value, created]
      return created
    } catch (reason) {
      error.value = errorMessage(reason, 'Unable to create package')
      throw reason
    } finally {
      loading.value = false
    }
  }

  async function update(
    packageCode: string,
    payload: PackageUpdatePayload,
  ): Promise<PackageDto> {
    loading.value = true
    error.value = null
    try {
      const updated = await updatePackage(packageCode, payload)
      items.value = items.value.map((item) => (
        item.packageCode === packageCode ? updated : item
      ))
      return updated
    } catch (reason) {
      error.value = errorMessage(reason, 'Unable to update package')
      throw reason
    } finally {
      loading.value = false
    }
  }

  return { items, loading, error, loaded, activePackages, load, create, update }
})
