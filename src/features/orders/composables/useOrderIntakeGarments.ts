import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { canSaveGarment, isDuplicateGarmentTag, validGarmentTag } from '@/shared/utils/garment-registration'
import { feedback } from '@/shared/utils/scan-feedback'

const NO_TAGS: ReadonlySet<string> = new Set()
const WARNING_MS = 3000

// Tag and photo state for the garment camera. A complete, non-duplicate pair goes to `onRegister`.
export function useOrderIntakeGarments(draftTags: () => ReadonlySet<string>, onRegister: (tag: string, file: File) => void) {
  const tag = ref<string | null>(null)
  const photo = shallowRef<File | null>(null)
  const warning = ref<string | null>(null)
  const resetVersion = ref(0)
  let warningTimer: number | null = null

  const canSave = computed(() => canSaveGarment(tag.value, photo.value, draftTags(), NO_TAGS))

  function setWarning(message: string | null): void {
    if (warningTimer !== null) window.clearTimeout(warningTimer)
    warningTimer = null
    warning.value = message
    if (message === null) return
    warningTimer = window.setTimeout(() => {
      warning.value = null
      warningTimer = null
    }, WARNING_MS)
  }

  function reset(): void {
    tag.value = null
    photo.value = null
    setWarning(null)
    resetVersion.value += 1
  }

  function acceptTag(value: string): void {
    const valid = validGarmentTag(value)
    if (!valid) {
      setWarning('Tag ID must be 8 letters or digits')
      feedback('failure')
      return
    }
    if (isDuplicateGarmentTag(valid, draftTags(), NO_TAGS)) {
      reset()
      setWarning(`Tag ${valid} is already in this order. Use another tag`)
      feedback('failure')
      return
    }
    setWarning(null)
    feedback('success')
    tag.value = valid
  }

  function setPhoto(file: File): void {
    photo.value = file
    setWarning(null)
  }

  watch(canSave, (ready) => {
    if (!ready || !tag.value || !photo.value) return
    const savedTag = tag.value
    const savedFile = photo.value
    reset()
    onRegister(savedTag, savedFile)
  }, { flush: 'sync' })

  onScopeDispose(() => {
    if (warningTimer !== null) window.clearTimeout(warningTimer)
  })

  return { tag, photo, warning, resetVersion, acceptTag, setPhoto, reset, clearTag: () => { tag.value = null } }
}
