import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { itemsCreateSchema } from '@contracts/items/items-api.schema'
import { useItemsStore } from '@/data/items/items.store'
import { uploadItemPhoto } from '@/data/items/items.service'
import { ApiError } from '@/shared/api/api-client'
import { useCloseRoute } from '@/shared/navigation/use-close-route'

export function useItemCreateForm() {
  const route = useRoute()
  const router = useRouter()
  const store = useItemsStore()
  const routeText = (value: unknown) => typeof value === 'string' ? value.trim() : ''
  const item = reactive({
    category: routeText(route.query.category), subcategory: routeText(route.query.subcategory),
    itemType: '', variant: '', displayNameTh: '', displayNameEn: '',
  })
  const orderId = routeText(route.query.orderId)
  const destination = orderId
    ? { name: 'order-detail', params: { orderId }, query: { orderAction: 'item' } }
    : { name: 'price-list' }
  const { close: closeRoute } = useCloseRoute(destination)
  const saving = ref(false)
  const formError = ref<string | null>(null)
  const initializing = ref(true)
  const contextLoading = computed(() => initializing.value || store.loading)
  const contextLoadError = computed(() => store.error !== null)
  const contextReady = computed(() => !initializing.value && !store.error && store.items.some((row) =>
    row.category === item.category && row.subcategory === item.subcategory))
  const error = computed(() => contextLoadError.value
    ? 'Unable to load item categories. Please try again.'
    : !contextLoading.value && !contextReady.value
      ? 'Return to the item picker and select a category and subcategory.'
      : formError.value)
  const uncertain = ref(false)
  const saved = ref(false)
  const photoInput = ref<HTMLInputElement | null>(null)
  const photoPreviewUrl = ref<string | null>(null)
  const photoName = ref('')
  let photo: File | null = null
  let uploadedUrl: string | null = null
  const payload = computed(() => ({ ...item, variant: item.variant.trim() || null,
    displayNameEn: item.displayNameEn.trim() || null, imageUrl: uploadedUrl }))
  const canSubmit = computed(() => contextReady.value && !saving.value && !uncertain.value
    && !saved.value && itemsCreateSchema.safeParse(payload.value).success)

  function clearPhoto() {
    if (saving.value) return
    if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value)
    photoPreviewUrl.value = null
    photoName.value = ''
    photo = null
    uploadedUrl = null
    if (photoInput.value) photoInput.value.value = ''
  }

  function selectPhoto(event: Event) {
    if (saving.value) return
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      formError.value = 'Choose an image smaller than 10 MB.'
      if (photoInput.value) photoInput.value.value = ''
      return
    }
    clearPhoto()
    photo = file
    photoPreviewUrl.value = URL.createObjectURL(file)
    photoName.value = file.name
    formError.value = null
  }

  function close() { if (!saving.value) closeRoute() }
  onBeforeRouteLeave(() => !saving.value)
  onBeforeUnmount(() => {
    if (photoPreviewUrl.value) URL.revokeObjectURL(photoPreviewUrl.value)
  })
  async function retryContext() {
    await store.load()
    initializing.value = false
  }
  onMounted(retryContext)

  async function submit() {
    if (!canSubmit.value) return
    saving.value = true
    formError.value = null
    let creating = false
    try {
      if (photo && !uploadedUrl) uploadedUrl = await uploadItemPhoto(photo)
      const data = itemsCreateSchema.parse({ ...payload.value, imageUrl: uploadedUrl })
      creating = true
      await store.create(data)
      saved.value = true
    } catch (reason) {
      uncertain.value = creating && !(reason instanceof ApiError && reason.status >= 400 && reason.status < 500)
      formError.value = uncertain.value
        ? 'The save could not be confirmed. Return to the picker and check for the item before creating it again.'
        : creating ? 'Unable to save the item. Check the details and try again.' : 'Unable to upload the photo. Please try again.'
    } finally { saving.value = false }
    if (saved.value) {
      try { await router.replace(destination) }
      catch { formError.value = 'Item saved. Close this form to return to the picker.' }
    }
  }

  return { item, photoInput, photoPreviewUrl, photoName, clearPhoto, selectPhoto,
    saving, error, canSubmit, submit, close, contextLoading, contextLoadError, retryContext }
}
