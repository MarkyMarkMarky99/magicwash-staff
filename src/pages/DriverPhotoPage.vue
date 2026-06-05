<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CameraSuccessModal, SinglePhotoCameraInput } from '../components/camera'
import GlassNoteBox from '../components/GlassNoteBox.vue'
import { handleAppend } from '../utils/gateway'
import { uuid8 } from '../utils/uuid'

const route = useRoute()
const router = useRouter()

const SERVICE_TYPES = {
  P: {
    label: 'รับผ้า',
    defaultImageType: 'PICKUP',
    allowedImageTypes: ['PICKUP'],
    requiredImageTypes: ['PICKUP'],
  },
  D: {
    label: 'ส่งผ้า',
    defaultImageType: 'DELIVERY',
    allowedImageTypes: ['DELIVERY', 'PICKUP'],
    requiredImageTypes: ['DELIVERY'],
  },
  R: {
    label: 'รับส่ง',
    defaultImageType: 'DELIVERY',
    allowedImageTypes: ['DELIVERY', 'PICKUP'],
    requiredImageTypes: ['DELIVERY', 'PICKUP'],
  },
}

const IMAGE_TYPE_LABELS = {
  PICKUP: 'Pickup',
  DELIVERY: 'Delivery',
}

const notes = ref('')
const imageUrl = ref('')
const uploadPayload = ref(null)
const cameraInputRef = ref(null)
const imageType = ref('DELIVERY')
const pickupOrderId = ref('')
const isSubmitting = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)
const isCompleted = ref(false)
const uploadedImages = ref({
  PICKUP: '',
  DELIVERY: '',
})
const uploadPayloads = ref({
  PICKUP: null,
  DELIVERY: null,
})

const parsedCode = computed(() => parsePhotoCode(route.params.photoCode))
const serviceConfig = computed(() => SERVICE_TYPES[parsedCode.value.service_type] ?? null)
const isValidCode = computed(() => parsedCode.value.valid)
const isRoundTrip = computed(() => parsedCode.value.service_type === 'R')
const canSwitchImageType = computed(() => (serviceConfig.value?.allowedImageTypes.length ?? 0) > 1)
const serviceLabel = computed(() => serviceConfig.value?.label ?? 'งานรับส่ง')
const effectiveOrderId = computed(() => (
  imageType.value === 'PICKUP' && ['D', 'R'].includes(parsedCode.value.service_type)
    ? pickupOrderId.value
    : parsedCode.value.order_id
))

const metadata = computed(() => ({
  customer_id: parsedCode.value.customer_id,
  delivery_id: parsedCode.value.delivery_id,
  order_id: effectiveOrderId.value,
  service_type: parsedCode.value.service_type,
  image_type: imageType.value,
  notes: notes.value.trim(),
}))

function parsePhotoCode(value) {
  const rawCode = Array.isArray(value) ? value[0] : value
  const code = String(rawCode ?? '').trim()
  const parts = code.split('-')
  const [serviceType, deliveryId, customerId, orderId] = parts
  const normalizedServiceType = String(serviceType ?? '').toUpperCase()
  const idPattern = /^[A-Za-z0-9]{8}$/

  const valid = parts.length === 4
    && Object.hasOwn(SERVICE_TYPES, normalizedServiceType)
    && idPattern.test(deliveryId ?? '')
    && idPattern.test(customerId ?? '')
    && idPattern.test(orderId ?? '')

  return {
    valid,
    raw_code: code,
    service_type: normalizedServiceType,
    delivery_id: deliveryId ?? '',
    customer_id: customerId ?? '',
    order_id: orderId ?? '',
  }
}

function setImageType(nextType) {
  if (isSubmitting.value || !serviceConfig.value?.allowedImageTypes.includes(nextType)) return
  imageType.value = nextType
  imageUrl.value = uploadedImages.value[nextType] || ''
  uploadPayload.value = uploadPayloads.value[nextType]
  nextTick(() => {
    if (!imageUrl.value) cameraInputRef.value?.clearPhoto?.()
  })
}

async function handleUploadSuccess(url, item) {
  submitSuccess.value = false
  imageUrl.value = url
  uploadedImages.value[imageType.value] = url
  uploadPayload.value = createOrderImagePayload(url)
  uploadPayloads.value[imageType.value] = uploadPayload.value
  console.log('Driver photo payload:', uploadPayload.value)

  const response = await submitDriverPhoto(uploadPayload.value)
  if (!response.ok) return
  submitSuccess.value = true

  const nextType = serviceConfig.value.requiredImageTypes.find(type => !uploadedImages.value[type])
  if (!nextType) {
    closeCompletedFlow()
    return
  }

  imageType.value = nextType
  imageUrl.value = ''
  uploadPayload.value = null
  await nextTick()
  cameraInputRef.value?.clearPhoto?.()
  cameraInputRef.value?.openCamera?.()
}

async function submitDriverPhoto(payload) {
  isSubmitting.value = true
  submitError.value = ''

  try {
    await handleAppend('OrderImages', payload)
    return { ok: true }
  } catch (error) {
    submitError.value = error?.message ?? 'ส่งข้อมูลรูปภาพไม่สำเร็จ'
    submitSuccess.value = false
    return { ok: false }
  } finally {
    isSubmitting.value = false
  }
}

function createOrderImagePayload(imagePath) {
  return {
    id: uuid8(),
    customer_id: parsedCode.value.customer_id,
    delivery_id: parsedCode.value.delivery_id,
    order_id: effectiveOrderId.value,
    image_type: imageType.value,
    image_path: imagePath,
    notes: notes.value.trim() || null,
  }
}

function closeCompletedFlow() {
  isCompleted.value = true
  cameraInputRef.value?.closeCamera?.()

  const payloads = serviceConfig.value.allowedImageTypes
    .map(type => uploadPayloads.value[type])
    .filter(Boolean)

  window.parent?.postMessage?.({
    type: 'driver-photo:completed',
    payloads,
  }, '*')
}

function leaveCompletedPage() {
  const returnTo = Array.isArray(route.query.return_to)
    ? route.query.return_to[0]
    : route.query.return_to

  if (returnTo) {
    router.replace(String(returnTo))
    return
  }

  router.back()
}

watch(
  parsedCode,
  (current) => {
    const nextConfig = SERVICE_TYPES[current.service_type]
    imageType.value = nextConfig?.defaultImageType ?? 'DELIVERY'
    pickupOrderId.value = ['D', 'R'].includes(current.service_type) ? uuid8() : ''
    imageUrl.value = ''
    uploadPayload.value = null
    isSubmitting.value = false
    submitError.value = ''
    submitSuccess.value = false
    isCompleted.value = false
    uploadedImages.value = {
      PICKUP: '',
      DELIVERY: '',
    }
    uploadPayloads.value = {
      PICKUP: null,
      DELIVERY: null,
    }
  },
  { immediate: true },
)
</script>

<template>
  <main class="relative h-full overflow-hidden bg-black">
    <section
      v-if="!isValidCode"
      class="flex h-full flex-col justify-center bg-surface px-6 text-on-surface"
    >
      <div class="rounded-lg border border-outline-variant bg-surface-container px-4 py-5">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-[28px] text-error">error</span>
          <h1 class="font-headline text-lg font-bold">ลิงก์ถ่ายรูปไม่ถูกต้อง</h1>
        </div>
        <p class="mt-3 text-sm text-on-surface-variant">
          รูปแบบที่ต้องใช้คือ /driver/photo/R-dlv12345-cus12345-ord12345
        </p>
      </div>
    </section>

    <CameraSuccessModal
      v-else-if="isCompleted"
      title="ส่งรูปภาพสำเร็จ"
      :message="`ระบบได้รับรูปภาพสำหรับงาน${serviceLabel}แล้ว`"
      action-label="ปิด"
      @close="leaveCompletedPage"
    />

    <SinglePhotoCameraInput
      v-else
      ref="cameraInputRef"
      v-model="imageUrl"
      upload-folder="driver-delivery-photos-ui-test"
      :metadata="metadata"
      upload-label="อัปโหลดรูป"
      retake-label="ถ่ายใหม่"
      capture-label="เปิดกล้อง"
      empty-text="พร้อมถ่ายรูปงานรับส่ง"
      :disabled="isSubmitting"
      @upload-success="handleUploadSuccess"
    >
      <template #camera-top>
        <div class="flex min-w-0 flex-1 justify-center">
          <div
            v-if="canSwitchImageType"
            class="grid h-10 grid-cols-2 rounded-full bg-black/45 p-1 ring-1 ring-white/25"
          >
            <button
              v-for="option in serviceConfig.allowedImageTypes"
              :key="option"
              class="flex min-w-[6.5rem] items-center justify-center gap-1 rounded-full px-3 text-sm font-semibold transition-colors"
              :class="imageType === option ? 'bg-white text-black' : 'text-white/75'"
              @click="setImageType(option)"
            >
              <span
                v-if="uploadedImages[option]"
                class="material-symbols-outlined text-[16px]"
                :class="imageType === option ? 'text-primary' : 'text-white/70'"
              >
                check_circle
              </span>
              {{ IMAGE_TYPE_LABELS[option] }}
            </button>
          </div>
        </div>
      </template>

      <template #preview-top>
        <div class="flex justify-center">
          <div class="rounded-full bg-black/45 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25">
            {{ serviceLabel }} · {{ IMAGE_TYPE_LABELS[imageType] }}
          </div>
        </div>
      </template>

      <template #preview-bottom>
        <p v-if="submitError" class="mb-3 rounded-lg bg-error-container px-3 py-2 text-sm font-medium text-on-error-container">
          {{ submitError }}
        </p>
        <p v-if="isSubmitting || submitSuccess" class="mb-3 flex items-center justify-center gap-2 rounded-full bg-white/85 px-3 py-2 text-center text-sm font-semibold text-black">
          <span
            class="material-symbols-outlined text-[20px]"
            :class="isSubmitting ? 'animate-spin text-black' : 'text-primary'"
          >
            {{ isSubmitting ? 'progress_activity' : 'check_circle' }}
          </span>
          {{ isSubmitting ? 'กำลังส่งข้อมูล...' : 'อัปโหลดสำเร็จ' }}
        </p>
        <GlassNoteBox
          id="driver-photo-notes"
          v-model="notes"
          class="mb-3"
          label="Notes"
          placeholder="หมายเหตุ"
          :rows="2"
        />
      </template>
    </SinglePhotoCameraInput>
  </main>
</template>
