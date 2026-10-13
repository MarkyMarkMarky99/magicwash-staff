<script setup lang="ts">
import { computed } from 'vue'
import StickerFab from '@/shared/components/StickerFab.vue'
import type { SlipPhoto } from '@/features/orders/utils/corporate-order-draft'

const props = defineProps<{ photos: readonly SlipPhoto[] }>()
const emit = defineEmits<{ scan: [], view: [] }>()

const topPages = computed(() => props.photos.slice(-3))
</script>

<template>
  <div class="flex items-center gap-3">
    <button
      v-if="photos.length > 0"
      type="button"
      class="stack"
      :aria-label="`View count slip photos, ${photos.length} ${photos.length === 1 ? 'page' : 'pages'}`"
      @click="emit('view')"
    >
      <span v-for="(photo, index) in topPages" :key="photo.id" class="thumb">
        <img :src="photo.url" alt="">
        <span v-if="index === topPages.length - 1" class="thumb__count">{{ photos.length }}</span>
      </span>
    </button>
    <StickerFab class="!h-[46px] !w-[46px] !rounded-[17px_20px_17px_19px]" label="Scan" aria-label="Scan the count slip" @click="emit('scan')">
      <span class="material-symbols-outlined text-[22px]" aria-hidden="true">document_scanner</span>
    </StickerFab>
  </div>
</template>

<style scoped>
.stack {
  position: relative;
  flex: none;
  width: 42px;
  height: 50px;
  padding: 0;
}

.stack:focus-visible {
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

.thumb:nth-child(2) {
  top: 2px;
  left: 6px;
  transform: rotate(4deg);
}

.thumb:nth-child(3) {
  top: 1px;
  left: 3px;
  transform: rotate(-3deg);
}

.thumb__count {
  position: absolute;
  top: -8px;
  right: -8px;
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border: 2px solid var(--color-primary);
  border-radius: 9px;
  background: var(--color-lime);
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}
</style>
