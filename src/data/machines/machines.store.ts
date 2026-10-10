import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listMachines, type MachineDto } from './machines.service'

export const useMachinesStore = defineStore('machines', () => {
  const items = ref<MachineDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let sequence = 0
  async function load(): Promise<void> {
    const request = ++sequence
    loading.value = true
    error.value = null
    try {
      const rows = await listMachines()
      if (request === sequence) items.value = rows
    } catch {
      if (request === sequence) error.value = 'Could not load the machines.'
    } finally {
      if (request === sequence) loading.value = false
    }
  }
  return { items, loading, error, load }
})
