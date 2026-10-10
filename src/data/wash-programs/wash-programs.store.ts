import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listWashPrograms, type WashProgramDto } from './wash-programs.service'

export const useWashProgramsStore = defineStore('wash-programs', () => {
  const items = ref<WashProgramDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let loaded = false
  let pending: Promise<void> | null = null
  function load(): Promise<void> {
    if (loaded) return Promise.resolve()
    if (pending) return pending
    loading.value = true
    error.value = null
    pending = listWashPrograms().then((rows) => {
      items.value = rows
      loaded = true
    }).catch(() => {
      error.value = 'Could not load the wash programs.'
    }).finally(() => {
      loading.value = false
      pending = null
    })
    return pending
  }
  function active(): WashProgramDto[] {
    return items.value.filter((program) => program.status === 'ACTIVE')
      .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.id.localeCompare(b.id))
  }
  function nameOf(id: string): string {
    return items.value.find((program) => program.id === id)?.name ?? 'Custom'
  }
  return { items, loading, error, load, active, nameOf }
})
