import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { getLaundryItem } from '@/data/laundry-items/laundry-item.service'
import { canSaveGarment, isDuplicateGarmentTag, validGarmentTag } from '@/shared/utils/garment-registration'
import { feedback } from '@/shared/utils/scan-feedback'

const NO_TAGS: ReadonlySet<string> = new Set()
const WARNING_MS = 3000

export function useLaundryItemRegisterGarments(
  customerId: () => string,
  draftTags: () => ReadonlySet<string>,
  onRegister: (tag: string, file: File) => void,
) {
  const tag = ref<string | null>(null)
  const photo = shallowRef<File | null>(null)
  const warning = ref<string | null>(null)
  const tagChecking = ref(false)
  const resetVersion = ref(0)
  let warningTimer: number | null = null
  let checkToken = 0

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
    checkToken += 1
    tagChecking.value = false
    tag.value = null
    photo.value = null
    setWarning(null)
    resetVersion.value += 1
  }

  function reject(message: string): void {
    reset()
    setWarning(message)
    feedback('failure')
  }

  async function acceptTag(value: string): Promise<void> {
    const valid = validGarmentTag(value)
    if (!valid) {
      setWarning('Tag ID must be 8 letters or digits')
      feedback('failure')
      return
    }
    if (isDuplicateGarmentTag(valid, draftTags(), NO_TAGS)) {
      reject('Tag already in this list')
      return
    }
    const token = ++checkToken
    tagChecking.value = true
    try {
      const existing = await getLaundryItem(valid)
      if (token !== checkToken) return
      if (existing && !existing.deletedAt) {
        reject(existing.customerId === customerId() ? 'Already registered to this customer' : 'Tag belongs to another customer')
        return
      }
    } catch {
      if (token !== checkToken) return
      reject('Could not check the tag. Try again')
      return
    }
    tagChecking.value = false
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
    checkToken += 1
    if (warningTimer !== null) window.clearTimeout(warningTimer)
  })

  return { tag, photo, warning, tagChecking, resetVersion, acceptTag, setPhoto, reset, clearTag: () => { tag.value = null } }
}
