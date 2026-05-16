<script setup>
import { computed, onActivated, onDeactivated, ref } from 'vue'
import CameraOverlay from './CameraOverlay.vue'
import PhotoGallery from '../photo-gallery/PhotoGallery.vue'
import { usePhotoFiles } from './composables/usePhotoFiles'
import { uploadRaw } from '../../api/storage'

const props = defineProps({
  title: {
    type: String,
    default: 'รูปภาพ',
  },
  emptyText: {
    type: String,
    default: 'ยังไม่มีรูปภาพ',
  },
  openCameraOnMount: {
    type: Boolean,
    default: false,
  },
  uploadFolder: {
    type: String,
    default: 'images',
  },
})

const emit = defineEmits(['change', 'submit', 'upload-start', 'upload-error', 'camera-open', 'camera-close'])

const {
  localPhotos,
  hasPhotos,
  hasProcessingPhotos,
  hasFailedPhotos,
  isReady,
  addFiles,
  removePhoto,
  updatePhoto,
  clearLocalPhotos,
} = usePhotoFiles()

const showCamera = ref(props.openCameraOnMount)
const uploadedItems = ref([])
const isUploading = ref(false)
const uploadError = ref('')

const photos = computed(() => localPhotos.value.map((photo) => ({
  id: photo.id,
  src: photo.previewUrl,
  label: photo.name,
  badge: 'Camera',
  source: photo.source,
  status: photo.status,
  removable: !photo.uploadedItem,
})))

const lastPreviewUrl = computed(() => localPhotos.value.at(-1)?.previewUrl ?? '')

const data = computed(() => uploadedItems.value)

const canSubmit = computed(() => isReady.value && !isUploading.value)
const isValid = computed(() => canSubmit.value)

const statusText = computed(() => {
  if (isUploading.value) return 'กำลังอัพโหลดรูปภาพ...'
  if (hasProcessingPhotos.value) return 'กำลังเตรียมรูปภาพ...'
  if (hasFailedPhotos.value) return 'มีรูปภาพที่เตรียมไม่สำเร็จ กรุณาลบแล้วถ่ายใหม่'
  if (hasPhotos.value) return 'รูปภาพพร้อมอัพโหลด'
  return props.emptyText
})

function notifyChange() {
  emit('change', data.value)
}

function openCamera() {
  showCamera.value = true
  emit('camera-open')
}

function closeCamera() {
  showCamera.value = false
  emit('camera-close')
}

function closeCameraIfOpen() {
  if (!showCamera.value) return
  closeCamera()
}

function handleCameraCapture(file, options = {}) {
  addFiles([file], { ...options, source: 'camera' })
  notifyChange()
}

function handleRemove(id) {
  const target = localPhotos.value.find((photo) => photo.id === id)
  if (target?.uploadedItem) return

  removePhoto(id)
  uploadedItems.value = []
  uploadError.value = ''
  notifyChange()
}

function createUploadFilename() {
  const id = globalThis.crypto?.randomUUID?.().slice(0, 8)
    ?? Math.random().toString(16).slice(2, 10).padEnd(8, '0')
  return `${id}.jpg`
}

async function uploadPhotos() {
  if (!canSubmit.value) return

  isUploading.value = true
  uploadError.value = ''
  emit('upload-start')

  try {
    const items = []

    for (const photo of localPhotos.value) {
      if (photo.uploadedItem) {
        items.push(photo.uploadedItem)
        continue
      }

      if (!photo.file) throw new Error('รูปภาพยังไม่พร้อมอัพโหลด')
      updatePhoto(photo.id, { status: 'uploading' })
      try {
        const filename = createUploadFilename()
        const imageUrl = await uploadRaw(photo.file, props.uploadFolder, filename)
        const uploadedItem = {
          filename,
          image_url: imageUrl,
          size: photo.file.size,
          type: photo.file.type,
          timestamp: new Date().toISOString(),
        }
        updatePhoto(photo.id, { status: 'uploaded', uploadedItem })
        items.push(uploadedItem)
      } catch (error) {
        updatePhoto(photo.id, {
          status: 'error',
          errorMessage: error?.message ?? 'อัพโหลดรูปภาพไม่สำเร็จ',
        })
        throw error
      }
    }

    uploadedItems.value = items
    emit('change', items)
    emit('submit', items)
  } catch (error) {
    uploadError.value = error?.message ?? 'อัพโหลดรูปภาพไม่สำเร็จ'
    emit('upload-error', uploadError.value)
  } finally {
    isUploading.value = false
  }
}

defineExpose({
  data,
  isValid,
  uploadPhotos,
  clearLocalPhotos,
})

onDeactivated(closeCameraIfOpen)

onActivated(() => {
  if (props.openCameraOnMount) openCamera()
})
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col overflow-hidden bg-black">
    <div class="gallery-scroll flex-1 overflow-y-auto">
      <div class="flex h-full min-h-full flex-col">
        <PhotoGallery
          :photos="photos"
          :empty-text="emptyText"
          title="Library"
          action-label="Upload"
          :action-disabled="!canSubmit"
          secondary-action-icon="photo_camera"
          secondary-action-label="เพิ่มรูปภาพ"
          :status-text="uploadError || hasFailedPhotos || isUploading || hasProcessingPhotos ? (uploadError || statusText) : ''"
          :status-error="!!(uploadError || hasFailedPhotos)"
          @action="uploadPhotos"
          @secondary-action="openCamera"
          @remove="handleRemove"
        />
      </div>
    </div>

    <CameraOverlay
      :open="showCamera"
      :last-preview-url="lastPreviewUrl"
      @capture="handleCameraCapture"
      @close="closeCamera"
    />
  </div>
</template>

<style scoped>
.gallery-scroll {
  scrollbar-width: none;
}

.gallery-scroll::-webkit-scrollbar {
  display: none;
}
</style>
