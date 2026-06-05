<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { uploadRaw } from '../../api/storage'
import CameraOverlay from './CameraOverlay.vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  uploadFolder: {
    type: String,
    default: 'images',
  },
  filenamePrefix: {
    type: String,
    default: 'camera',
  },
  autoOpen: {
    type: Boolean,
    default: true,
  },
  uploadLabel: {
    type: String,
    default: 'อัปโหลด',
  },
  retakeLabel: {
    type: String,
    default: 'ถ่ายใหม่',
  },
  captureLabel: {
    type: String,
    default: 'ถ่ายภาพ',
  },
  emptyText: {
    type: String,
    default: 'ยังไม่มีรูปภาพ',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  metadata: {
    type: Object,
    default: () => ({}),
  },
  uploader: {
    type: Function,
    default: uploadRaw,
  },
})

const emit = defineEmits([
  'update:modelValue',
  'change',
  'capture',
  'retake',
  'upload-start',
  'upload-success',
  'upload-error',
  'camera-open',
  'camera-close',
])

const showCamera = ref(props.autoOpen)
const capturedFile = ref(null)
const previewUrl = ref('')
const uploadedUrl = ref(props.modelValue)
const uploadResult = ref(null)
const isUploading = ref(false)
const uploadError = ref('')

const hasPhoto = computed(() => !!capturedFile.value)
const canUpload = computed(() => hasPhoto.value && !uploadedUrl.value && !isUploading.value && !props.disabled)

function revokePreviewUrl() {
  if (!previewUrl.value) return
  URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

function createFilename(file) {
  const prefix = props.filenamePrefix.trim() || 'camera'
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8)
    ?? Math.random().toString(16).slice(2, 10).padEnd(8, '0')
  const extension = file.type === 'image/png' ? 'png' : 'jpg'
  return `${prefix}_${Date.now()}_${suffix}.${extension}`
}

function notifyChange(value) {
  emit('update:modelValue', value)
  emit('change', value)
}

function openCamera() {
  if (props.disabled) return
  showCamera.value = true
  emit('camera-open')
}

function closeCamera() {
  showCamera.value = false
  emit('camera-close')
}

function handleCapture(file, options = {}) {
  revokePreviewUrl()
  capturedFile.value = file
  previewUrl.value = URL.createObjectURL(file)
  uploadedUrl.value = ''
  uploadResult.value = null
  uploadError.value = ''
  showCamera.value = false
  notifyChange('')
  emit('capture', file, options)
}

function retakePhoto() {
  if (props.disabled || isUploading.value) return
  capturedFile.value = null
  uploadedUrl.value = ''
  uploadResult.value = null
  uploadError.value = ''
  revokePreviewUrl()
  notifyChange('')
  emit('retake')
  openCamera()
}

async function uploadPhoto() {
  if (!canUpload.value) return

  isUploading.value = true
  uploadError.value = ''
  emit('upload-start', capturedFile.value)

  try {
    const file = capturedFile.value
    const filename = createFilename(file)
    const imageUrl = await props.uploader(file, props.uploadFolder, filename)
    const item = {
      filename,
      image_url: imageUrl,
      size: file.size,
      type: file.type,
      timestamp: new Date().toISOString(),
      metadata: props.metadata,
    }

    uploadedUrl.value = imageUrl
    uploadResult.value = item
    notifyChange(imageUrl)
    emit('upload-success', imageUrl, item)
  } catch (error) {
    uploadError.value = error?.message ?? 'อัปโหลดรูปภาพไม่สำเร็จ'
    emit('upload-error', uploadError.value)
  } finally {
    isUploading.value = false
  }
}

function clearPhoto() {
  capturedFile.value = null
  uploadedUrl.value = ''
  uploadResult.value = null
  uploadError.value = ''
  revokePreviewUrl()
  notifyChange('')
}

watch(
  () => props.modelValue,
  (value) => {
    uploadedUrl.value = value
  },
)

onBeforeUnmount(revokePreviewUrl)

defineExpose({
  openCamera,
  closeCamera,
  retakePhoto,
  uploadPhoto,
  clearPhoto,
  capturedFile,
  uploadedUrl,
  uploadResult,
})
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col overflow-hidden bg-black text-white">
    <div v-if="previewUrl" class="relative flex min-h-0 flex-1 flex-col">
      <img
        :src="previewUrl"
        alt="ภาพที่ถ่าย"
        class="absolute inset-0 h-full w-full object-cover"
      />
      <div class="absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent px-4 pb-10 pt-4">
        <slot name="preview-top" />
      </div>
      <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-12">
        <slot name="preview-bottom" />

        <p v-if="uploadError" class="mb-3 rounded-lg bg-error-container px-3 py-2 text-sm font-medium text-on-error-container">
          {{ uploadError }}
        </p>

        <div class="grid grid-cols-2 gap-3">
          <button
            class="flex h-12 items-center justify-center gap-2 rounded-full bg-white/15 px-4 text-sm font-semibold text-white ring-1 ring-white/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="disabled || isUploading"
            @click="retakePhoto"
          >
            <span class="material-symbols-outlined text-[20px]">photo_camera</span>
            {{ retakeLabel }}
          </button>
          <button
            class="flex h-12 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            :disabled="!canUpload"
            @click="uploadPhoto"
          >
            <span
              class="material-symbols-outlined text-[20px]"
              :class="{ 'animate-spin': isUploading }"
            >
              {{ isUploading ? 'progress_activity' : uploadedUrl ? 'check_circle' : 'cloud_upload' }}
            </span>
            {{ isUploading ? 'กำลังอัปโหลด...' : uploadedUrl ? 'อัปโหลดแล้ว' : uploadLabel }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
      <slot name="empty">
        <span class="material-symbols-outlined text-[48px] text-white/70">photo_camera</span>
        <p class="font-body text-sm text-white/70">{{ emptyText }}</p>
      </slot>
      <button
        class="flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
        :disabled="disabled"
        @click="openCamera"
      >
        <span class="material-symbols-outlined text-[20px]">photo_camera</span>
        {{ captureLabel }}
      </button>
    </div>

    <CameraOverlay
      :open="showCamera"
      :last-preview-url="previewUrl"
      :show-preview-button="false"
      @capture="handleCapture"
      @close="closeCamera"
    >
      <template #top>
        <slot name="camera-top" />
      </template>
      <template #bottom>
        <slot name="camera-bottom" />
      </template>
    </CameraOverlay>
  </div>
</template>
