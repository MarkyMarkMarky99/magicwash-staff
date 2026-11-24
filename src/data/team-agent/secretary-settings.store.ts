import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchSecretarySettings, updateSecretarySettings, type SecretarySettings, type UpdateSecretarySettingsInput } from './team-agent.service'

export const useSecretarySettingsStore = defineStore('secretary-settings', () => {
  const staffId = ref<string | null>(null)
  const settings = ref<SecretarySettings | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  let requestId = 0

  async function request(target: string, body?: UpdateSecretarySettingsInput): Promise<SecretarySettings> {
    const id = ++requestId
    if (staffId.value !== target) settings.value = null
    staffId.value = target
    loading.value = body === undefined
    saving.value = body !== undefined
    error.value = null
    try {
      const result = body === undefined ? await fetchSecretarySettings(target) : await updateSecretarySettings(target, body)
      if (id === requestId) settings.value = result
      return result
    } catch (reason) {
      if (id === requestId) {
        settings.value = null
        error.value = reason instanceof Error ? reason.message : 'Could not load secretary settings'
      }
      throw reason
    } finally {
      if (id === requestId) {
        loading.value = false
        saving.value = false
      }
    }
  }

  function load(staffId: string): Promise<SecretarySettings> {
    return request(staffId)
  }

  function update(staffId: string, body: UpdateSecretarySettingsInput): Promise<SecretarySettings> {
    return request(staffId, body)
  }

  function reset(): void {
    requestId += 1
    staffId.value = null
    settings.value = null
    loading.value = false
    saving.value = false
    error.value = null
  }

  return { staffId, settings, loading, saving, error, load, update, reset }
})
