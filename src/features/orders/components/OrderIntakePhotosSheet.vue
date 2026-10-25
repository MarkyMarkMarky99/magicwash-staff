<script setup lang="ts">
import type { GarmentUpload } from '@/shared/composables/useGarmentPhotoUploads'
import UploadStateOverlay from '@/shared/components/UploadStateOverlay.vue'
import DetailOverlay from '@/shared/layouts/DetailOverlay.vue'
import {
  orderIntakePhotoCategories,
  photosOf,
  type OrderIntakePhoto,
} from '@/features/orders/utils/order-intake-draft'

defineProps<{ open: boolean, photos: readonly OrderIntakePhoto[], uploads: Readonly<Record<string, GarmentUpload>> }>()
const emit = defineEmits<{ close: [], view: [id: string] }>()
</script>

<template>
  <DetailOverlay :open="open" ariaLabel="Photos" @close="emit('close')">
    <template #header>
      <h2 class="px-5 pb-2 pr-16 pt-1 font-headline text-lg font-extrabold">Photos<small class="ml-1.5 text-xs font-bold text-on-surface-variant">{{ photos.length }}</small></h2>
    </template>
    <div class="px-5 pb-5">
      <section v-for="category in orderIntakePhotoCategories" :key="category.key" class="mt-3 first:mt-0">
        <div class="sticky top-0 z-[3] mb-2.5 flex items-center gap-2 border-b border-outline-variant bg-surface py-2 font-headline text-[15px] font-extrabold">
          <span class="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">{{ category.icon }}</span>
          <span>{{ category.name }}</span>
          <span class="ml-auto rounded-full bg-secondary-container px-2 py-0.5 text-xs font-extrabold text-on-secondary-container">{{ photosOf(photos, category.key).length }}</span>
        </div>
        <p v-if="photosOf(photos, category.key).length === 0" class="pb-1.5 pt-1 text-[13px] text-on-surface-variant">No photos yet</p>
        <ul v-else class="grid grid-cols-3 gap-2">
          <li v-for="photo in photosOf(photos, category.key)" :key="photo.id">
            <button type="button" class="relative block aspect-square w-full overflow-hidden rounded-[10px] border border-outline-variant bg-surface-container focus-visible:outline-2 focus-visible:outline-lime" :aria-label="uploads[photo.id]?.status === 'failed' ? `Retry ${category.name} photo upload` : `View ${category.name} photo`" @click="emit('view', photo.id)">
              <img :src="photo.previewUrl" alt="" class="h-full w-full object-cover">
              <UploadStateOverlay :status="uploads[photo.id]?.status" />
            </button>
          </li>
        </ul>
      </section>
    </div>
  </DetailOverlay>
</template>
