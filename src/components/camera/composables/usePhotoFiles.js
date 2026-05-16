import { computed, onBeforeUnmount, ref } from 'vue'
import { compressImage } from '../../../utils/imageCompression'

let nextPhotoId = 1

function createPhotoItem(file, source) {
  return {
    id: `local-${Date.now()}-${nextPhotoId++}`,
    originalFile: file,
    file: null,
    source,
    previewUrl: URL.createObjectURL(file),
    name: file.name,
    size: file.size,
    type: file.type,
    status: 'preprocessing',
    errorMessage: null,
    createdAt: new Date().toISOString(),
  }
}

export function usePhotoFiles() {
  const localPhotos = ref([])

  function updatePhoto(id, patch) {
    const target = localPhotos.value.find((photo) => photo.id === id)
    if (target) Object.assign(target, patch)
  }

  async function preprocessPhoto(photo, options = {}) {
    try {
      const processedFile = options.skipCompression
        ? photo.originalFile
        : await compressImage(photo.originalFile)

      updatePhoto(photo.id, {
        file: processedFile,
        size: processedFile.size,
        type: processedFile.type,
        status: 'ready',
      })
    } catch (error) {
      updatePhoto(photo.id, {
        status: 'error',
        errorMessage: error?.message ?? 'เตรียมรูปภาพไม่สำเร็จ',
      })
    }
  }

  function addFiles(files, options = {}) {
    const incomingFiles = Array.from(files ?? []).filter((file) => file?.type?.startsWith('image/'))
    if (!incomingFiles.length) return

    const source = options.source ?? 'camera'
    const photoItems = incomingFiles.map((file) => createPhotoItem(file, source))
    localPhotos.value = [...localPhotos.value, ...photoItems]
    photoItems.forEach((photo) => {
      preprocessPhoto(photo, options)
    })
  }

  function removePhoto(id) {
    const target = localPhotos.value.find((photo) => photo.id === id)
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
    localPhotos.value = localPhotos.value.filter((photo) => photo.id !== id)
  }

  function clearLocalPhotos() {
    localPhotos.value.forEach((photo) => {
      if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl)
    })
    localPhotos.value = []
  }

  const hasPhotos = computed(() => localPhotos.value.length > 0)
  const hasProcessingPhotos = computed(() => localPhotos.value.some((photo) => (
    photo.status === 'preprocessing' || photo.status === 'uploading'
  )))
  const hasFailedPhotos = computed(() => localPhotos.value.some((photo) => photo.status === 'error'))
  const isReady = computed(() => hasPhotos.value && !hasProcessingPhotos.value && !hasFailedPhotos.value)

  onBeforeUnmount(clearLocalPhotos)

  return {
    localPhotos,
    hasPhotos,
    hasProcessingPhotos,
    hasFailedPhotos,
    isReady,
    addFiles,
    removePhoto,
    updatePhoto,
    clearLocalPhotos,
  }
}
