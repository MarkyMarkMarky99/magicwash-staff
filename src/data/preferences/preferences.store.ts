import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useAuthStore } from '@/data/auth/auth.store'
import { fetchPreferences, updatePreferences, type StaffPreferences, type PreferredLanguage } from './preferences.service'

export const usePreferencesStore = defineStore('preferences', () => {
  const preferences = ref<StaffPreferences | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<unknown>(null)
  let generation = 0
  function reset(): void {
    generation++
    preferences.value = null
    loading.value = false
    saving.value = false
    error.value = null
  }
  async function request(staffId: string, language?: PreferredLanguage): Promise<StaffPreferences | null> {
    const key = ++generation
    if (preferences.value?.staffId !== staffId) preferences.value = null
    loading.value = language === undefined
    saving.value = language !== undefined
    error.value = null
    try {
      const result = language === undefined ? await fetchPreferences(staffId) : await updatePreferences(staffId, language)
      if (key !== generation) return null
      preferences.value = result
      return result
    } catch (reason) { if (key === generation) { error.value = reason; throw reason }; return null }
    finally { if (key === generation) { loading.value = false; saving.value = false } }
  }
  const auth = useAuthStore()
  watch([() => auth.status, () => auth.staff, () => auth.role], reset, { flush: 'sync' })
  return { preferences, loading, saving, error, reset,
    load: (staffId: string) => request(staffId),
    update: (staffId: string, language: PreferredLanguage) => request(staffId, language) }
})
