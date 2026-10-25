<script setup lang="ts">
import type { GarmentUpload } from '@/shared/composables/useGarmentPhotoUploads'
import OrderIntakeUploadState from './OrderIntakeUploadState.vue'
import { computed } from 'vue'
import type { OrderIntakePhoto } from '@/features/orders/utils/order-intake-draft'

const props = defineProps<{ photos: readonly OrderIntakePhoto[], uploads: Readonly<Record<string, GarmentUpload>> }>()
const emit = defineEmits<{ open: [], view: [id: string] }>()

const ROTATIONS = [-4, 2, 6]
const visible = computed(() => props.photos.slice(-3))
</script>

<template>
  <div v-if="photos.length > 0" class="stack">
    <button
      v-for="(photo, index) in visible"
      :key="photo.id"
      type="button"
      class="thumb"
      :aria-label="uploads[photo.id]?.status === 'failed' ? 'Retry photo upload' : 'Open photos'"
      @click="uploads[photo.id]?.status === 'failed' ? emit('view', photo.id) : emit('open')"
      :style="{ left: `${index * 6}px`, top: `${index * 3 + 2}px`, transform: `rotate(${ROTATIONS[index]}deg)`, zIndex: index + 1 }"
    >
      <img :src="photo.previewUrl" alt="">
      <OrderIntakeUploadState :status="uploads[photo.id]?.status" />
    </button>
    <span class="badge" :style="{ left: `${(visible.length - 1) * 6 + 24}px` }">{{ photos.length }}</span>
  </div>
</template>

<style scoped>
.stack {
  position: relative;
  flex: none;
  width: 52px;
  height: 52px;
  padding: 0;
}

.thumb:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 4px;
  border-radius: 8px;
}

.thumb {
  position: absolute;
  width: 34px;
  height: 46px;
  border: 2px solid var(--color-primary);
  border-radius: 7px 9px 7px 8px;
  background: white;
  box-shadow: 2px 2px 0 color-mix(in srgb, var(--color-primary) 70%, black);
}

.thumb img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 5px 7px 5px 6px;
  object-fit: cover;
}

.badge {
  position: absolute;
  pointer-events: none;
  top: -4px;
  z-index: 9;
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border: 2px solid white;
  border-radius: 999px;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 10px;
  font-weight: 800;
}
</style>
