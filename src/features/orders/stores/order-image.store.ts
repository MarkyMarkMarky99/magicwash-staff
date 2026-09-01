import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createOrderImage, listOrderImages, type OrderImageDto } from '@/features/orders/services/order-image.service'
import { uploadOrderImage } from '@/features/orders/services/order-image-storage.service'
import type { OrderImageType } from '@/features/orders/order-image-labels'

const ORDER_IMAGE_CREATED_BY = 'admin'

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback
}

export const useOrderImageStore = defineStore('order-images', () => {
  const images = ref<OrderImageDto[]>([])
  const imagesOrderId = ref<string | null>(null)
  const imagesLoading = ref(false)
  const imagesError = ref<string | null>(null)
  const uploadingCount = ref(0)
  const uploadError = ref<string | null>(null)
  let imagesRequestSequence = 0

  async function loadImages(orderId: string): Promise<void> {
    const requestSequence = ++imagesRequestSequence
    imagesOrderId.value = orderId
    imagesLoading.value = true
    imagesError.value = null
    try {
      const result = await listOrderImages(orderId)
      if (requestSequence !== imagesRequestSequence) return
      images.value = result.items
    } catch (reason) {
      if (requestSequence !== imagesRequestSequence) return
      images.value = []
      imagesError.value = errorMessage(reason, 'โหลดรูปภาพไม่สำเร็จ')
    } finally {
      if (requestSequence === imagesRequestSequence) imagesLoading.value = false
    }
  }

  async function captureImage(input: { orderId: string; imageType: OrderImageType; file: File; quantity: number | null }): Promise<void> {
    if (input.imageType === 'WEIGHT' && (input.quantity === null || !(input.quantity > 0))) {
      uploadError.value = 'รูปน้ำหนักต้องระบุน้ำหนักก่อน'
      return
    }
    const quantity = input.imageType === 'WEIGHT' ? input.quantity : null
    uploadingCount.value += 1
    uploadError.value = null
    try {
      const imagePath = await uploadOrderImage(input.orderId, input.file)
      const created = await createOrderImage({ orderId: input.orderId, customerId: null, deliveryId: null, imageType: input.imageType, imagePath, notes: null, quantity, createdBy: ORDER_IMAGE_CREATED_BY })
      if (imagesOrderId.value === input.orderId) images.value = [...images.value, created]
    } catch (reason) {
      uploadError.value = errorMessage(reason, 'อัปโหลดรูปภาพไม่สำเร็จ')
    } finally {
      uploadingCount.value -= 1
    }
  }

  function clearImages(): void {
    imagesRequestSequence += 1
    images.value = []
    imagesOrderId.value = null
    imagesLoading.value = false
    imagesError.value = null
  }

  function clearUploadError(): void {
    uploadError.value = null
  }

  return { images, imagesOrderId, imagesLoading, imagesError, uploadingCount, uploadError, loadImages, captureImage, clearImages, clearUploadError }
})
