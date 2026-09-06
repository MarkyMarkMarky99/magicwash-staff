import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const STORAGE_KEY = 'document-scanner-debug'
const debugEnabled = ref(false)

function readQueryValue(value: unknown): string | null {
  const firstValue = Array.isArray(value) ? value[0] : value
  return typeof firstValue === 'string' ? firstValue : null
}

function readStoredDebug(): boolean | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === '1') return true
    if (stored === '0') return false
  } catch {
    // Storage can be unavailable in private browsing or when site data is blocked.
  }
  return null
}

function writeStoredDebug(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // Keep the in-memory toggle usable even when persistence is unavailable.
  }
}

export function useDocumentScannerDebug() {
  const route = useRoute()

  watch(() => route.query.debug, (rawDebug) => {
    const queryDebug = readQueryValue(rawDebug)
    if (queryDebug === '1' || queryDebug === '0') {
      debugEnabled.value = queryDebug === '1'
      writeStoredDebug(debugEnabled.value)
      return
    }

    const storedDebug = readStoredDebug()
    if (storedDebug !== null) debugEnabled.value = storedDebug
  }, { immediate: true })

  return computed(() => debugEnabled.value)
}
