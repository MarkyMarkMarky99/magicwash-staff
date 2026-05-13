import { ref } from 'vue'
import { compressImage } from '../utils/imageCompression'
import { uploadRaw } from '../api/storage'
import { savePhoto } from '../api/photos'

const MAX_FILES_PER_PICK = 10

function genId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function usePhotoUpload(type, orderId, orderitemId, createdBy) {
  const images = ref([])

  function updateItem(id, patch) {
    const item = images.value.find((img) => img.id === id)
    if (item) Object.assign(item, patch)
  }

  async function processFile(file, options = {}) {
    const id = genId()
    images.value.push({
      id,
      previewUrl: URL.createObjectURL(file),
      originalSize: file.size,
      compressedSize: null,
      imageUrl: null,
      status: 'compressing',
      errorMsg: null,
    })

    try {
      const compressed = options.skipCompression ? file : await compressImage(file)
      updateItem(id, { compressedSize: compressed.size, status: 'uploading' })

      const imageUrl = await uploadRaw(compressed)
      updateItem(id, { imageUrl, status: 'saving' })

      const photoData = { id, order_id: orderId, image_url: imageUrl, created_by: createdBy }
      if (orderitemId) photoData.orderitem_id = orderitemId
      await savePhoto(type, photoData)
      updateItem(id, { status: 'done' })
    } catch (err) {
      updateItem(id, { status: 'error', errorMsg: err?.message ?? 'เกิดข้อผิดพลาด' })
    }
  }

  function addFiles(files, options = {}) {
    Array.from(files).slice(0, MAX_FILES_PER_PICK).forEach((file) => {
      processFile(file, options)
    })
  }

  function remove(id) {
    const idx = images.value.findIndex((img) => img.id === id)
    if (idx === -1) return
    URL.revokeObjectURL(images.value[idx].previewUrl)
    images.value.splice(idx, 1)
  }

  function clearAll() {
    images.value.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    images.value = []
  }

  return { images, MAX_FILES_PER_PICK, addFiles, remove, clearAll }
}
