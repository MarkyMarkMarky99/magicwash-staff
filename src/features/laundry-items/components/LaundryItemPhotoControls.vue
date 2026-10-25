<script setup lang="ts">
import { computed } from 'vue'
import UploadStateOverlay from '@/shared/components/UploadStateOverlay.vue'
import type { GarmentPhotoPreviewItem } from '../composables/useLaundryItemPhotoCapture'
import type { GarmentPhotoType } from '../utils/laundry-item-detail'
import LaundryItemPhotoTypeMenu from './LaundryItemPhotoTypeMenu.vue'

const props = defineProps<{ photos: readonly GarmentPhotoPreviewItem[], canAdd: boolean, saving: boolean, destination: string }>()
const emit = defineEmits<{ view: [], select: [type: GarmentPhotoType] }>()

const BACK = { left: 0, top: 0, rotate: -7 }
const FRONT = { left: 7, top: 5, rotate: -2 }
const SINGLE = { left: 4, top: 4, rotate: -2 }
const front = computed(() => props.photos[0] ?? null)
const back = computed(() => props.photos[1] ?? null)
const place = (sheet: typeof BACK) => ({ left: `${sheet.left}px`, top: `${sheet.top}px`, transform: `rotate(${sheet.rotate}deg)` })
const label = computed(() => `${props.photos.length} ${props.photos.length === 1 ? 'photo' : 'photos'}`)
</script>

<template>
  <div class="flex items-center gap-3">
    <button
      v-if="photos.length > 0"
      type="button"
      class="stack"
      :aria-label="`Open photo album, ${label}`"
      @click="emit('view')"
    >
      <span v-if="back" class="thumb" :style="place(BACK)">
        <img :src="back.src" alt="">
        <UploadStateOverlay :status="back.status" />
      </span>
      <span v-if="front" class="thumb" :style="place(back ? FRONT : SINGLE)">
        <img :src="front.src" alt="">
        <UploadStateOverlay :status="front.status" />
        <span class="badge">{{ photos.length }}</span>
      </span>
    </button>
    <LaundryItemPhotoTypeMenu v-if="canAdd" :destination="destination" :saving="saving" @select="emit('select', $event)" />
  </div>
</template>

<style scoped>
.stack {
  position: relative;
  flex: none;
  width: 50px;
  height: 56px;
  padding: 0;
}

.stack:focus-visible {
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
  top: -9px;
  right: -10px;
  z-index: 9;
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border: 2px solid var(--color-primary);
  border-radius: 999px;
  background: var(--color-lime);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 800;
}
</style>
