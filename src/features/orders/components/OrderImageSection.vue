<script setup lang="ts">
import OrderImageCaptureMenu from '@/features/orders/components/OrderImageCaptureMenu.vue'
import { getOrderImageTypeLabel, type OrderImageType } from '@/features/orders/order-image-labels'
import type { OrderImageDto } from '@/features/orders/services/order-image.service'

defineProps<{
  images: OrderImageDto[]
  loading: boolean
  uploadingCount: number
  error: string | null
  uploadError: string | null
}>()

const emit = defineEmits<{
  capture: [imageType: OrderImageType]
  clearUploadError: []
}>()

function isDisplayableImagePath(imagePath: string | null): boolean {
  return typeof imagePath === 'string' && /^https?:\/\//i.test(imagePath)
}
</script>

<template>
  <section class="border-t border-outline-variant/20 bg-surface px-4 py-5">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div>
        <p class="font-label text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">หลักฐานรับผ้า</p>
        <h2 class="font-headline text-base font-bold text-primary">รูปภาพของออเดอร์</h2>
      </div>
      <OrderImageCaptureMenu @capture="emit('capture', $event)" />
    </div>

    <div v-if="uploadError" class="mb-3 flex items-center justify-between gap-2">
      <p class="font-body text-sm text-error">{{ uploadError }}</p>
      <button type="button" class="font-body text-sm text-error" @click="emit('clearUploadError')">ปิด</button>
    </div>

    <div v-if="loading" class="flex gap-2">
      <span v-for="index in 3" :key="index" class="h-24 w-24 animate-pulse rounded-xl bg-surface-container" />
    </div>
    <p v-else-if="error" class="font-body text-sm text-error">{{ error }}</p>
    <div v-else-if="images.length || uploadingCount > 0" class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      <figure v-for="image in images" :key="image.orderImageId" class="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-container">
        <img v-if="isDisplayableImagePath(image.imagePath)" :src="image.imagePath" :alt="getOrderImageTypeLabel(image.imageType)" class="h-full w-full object-cover">
        <div v-else class="flex h-full items-center justify-center text-on-surface-variant"><span class="material-symbols-outlined">image</span></div>
        <figcaption class="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center font-label text-[9px] font-bold text-white">{{ getOrderImageTypeLabel(image.imageType) }}</figcaption>
      </figure>
      <span v-for="index in uploadingCount" :key="'uploading-' + index" class="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-surface-container" />
    </div>
    <p v-else class="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low px-3 py-4 font-body text-sm text-on-surface-variant">ยังไม่มีรูปภาพสำหรับออเดอร์นี้</p>
  </section>
</template>
