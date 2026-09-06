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

function isDisplayableImagePath(imagePath: string | null): imagePath is string {
  return typeof imagePath === 'string' && /^https?:\/\//i.test(imagePath)
}
</script>

<template>
  <section class="relative overflow-hidden bg-primary px-4 py-5 text-on-primary">
    <div class="pointer-events-none absolute -bottom-[96px] -left-[104px] h-[220px] w-[220px] rounded-full border-[30px] border-mint/[0.14]" />
    <div class="pointer-events-none absolute -top-[18px] right-[52px] h-[36px] w-[36px] rounded-full bg-lime shadow-[22px_11px_0_rgba(178,223,38,0.22)]" />
    <div class="relative mb-3 flex items-start justify-between gap-3">
      <div>
        <p class="font-label text-[9px] font-bold uppercase tracking-widest text-mint">หลักฐานรับผ้า</p>
        <h2 class="font-headline text-base font-bold">รูปภาพของออเดอร์</h2>
      </div>
      <OrderImageCaptureMenu @capture="emit('capture', $event)" />
    </div>

    <div v-if="uploadError" class="relative mb-3 flex items-center justify-between gap-2">
      <p class="font-body text-sm text-mint">{{ uploadError }}</p>
      <button type="button" class="font-body text-sm text-mint" @click="emit('clearUploadError')">ปิด</button>
    </div>

    <div v-if="loading" class="relative flex gap-2">
      <span v-for="index in 3" :key="index" class="h-24 w-24 animate-pulse rounded-xl bg-white/15" />
    </div>
    <p v-else-if="error" class="relative font-body text-sm text-mint">{{ error }}</p>
    <div v-else-if="images.length || uploadingCount > 0" class="relative flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      <figure v-for="image in images" :key="image.orderImageId" class="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white/15">
        <img v-if="isDisplayableImagePath(image.imagePath)" :src="image.imagePath" :alt="getOrderImageTypeLabel(image.imageType)" class="h-full w-full object-cover">
        <div v-else class="flex h-full items-center justify-center text-mint/70"><span class="material-symbols-outlined">image</span></div>
        <figcaption class="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center font-label text-[9px] font-bold text-white">{{ getOrderImageTypeLabel(image.imageType) }}</figcaption>
      </figure>
      <span v-for="index in uploadingCount" :key="'uploading-' + index" class="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-white/15" />
    </div>
    <p v-else class="relative rounded-xl border border-dashed border-mint/35 bg-white/5 px-3 py-4 font-body text-sm text-mint/80">ยังไม่มีรูปภาพสำหรับออเดอร์นี้</p>
  </section>
</template>
