<script setup lang="ts">
import StickerFab from '@/shared/components/StickerFab.vue'
import type { SlipPhoto } from '@/features/orders/utils/corporate-order-draft'

defineProps<{ photos: readonly SlipPhoto[] }>()
const emit = defineEmits<{ scan: [], view: [] }>()
</script>

<template>
  <div class="flex items-center gap-3">
    <button
      v-if="photos.length > 0"
      type="button"
      class="preview"
      aria-label="View count slip"
      @click="emit('view')"
    >
      <span class="thumb">
        <img :src="photos[0]!.url" alt="">
      </span>
    </button>
    <StickerFab class="!h-[46px] !w-[46px] !rounded-[17px_20px_17px_19px]" :label="photos.length ? 'Retake' : 'Scan'" :aria-label="photos.length ? 'Retake the count slip' : 'Scan the count slip'" @click="emit('scan')">
      <span class="material-symbols-outlined text-[22px]" aria-hidden="true">document_scanner</span>
    </StickerFab>
  </div>
</template>

<style scoped>
.preview {
  position: relative;
  flex: none;
  width: 42px;
  height: 50px;
  padding: 0;
}

.preview:focus-visible {
  outline: 2px solid var(--color-lime);
  outline-offset: 4px;
  border-radius: 8px;
}

.thumb {
  position: absolute;
  top: 0;
  left: 0;
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
</style>
