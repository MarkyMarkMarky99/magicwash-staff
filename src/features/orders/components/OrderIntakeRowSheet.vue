<script setup lang="ts">
import CloseButton from '@/shared/components/CloseButton.vue'
import SquareImageCard from '@/shared/components/SquareImageCard.vue'
import DetailOverlay from '@/shared/layouts/DetailOverlay.vue'
import type { OrderIntakeGarment } from '@/features/orders/utils/order-intake-draft'

defineProps<{ open: boolean, title: string, garments: readonly OrderIntakeGarment[] }>()
const emit = defineEmits<{ close: [], openItem: [tag: string] }>()
</script>

<template>
  <DetailOverlay :open="open" :ariaLabel="title" size="auto" :close-button="false" @close="emit('close')">
    <template #header>
      <!-- Same header as the Packing bag sheet: pulled up over the drag-handle row; pointer-events stay off so the handle still drags. -->
      <header class="row-sec pointer-events-none relative -mt-[26px]">
        <div class="row-sec__bar" />
        <div class="min-w-0 flex-1">
          <h2 class="row-sec__title">{{ title }}</h2>
          <small class="row-sec__sub">{{ garments.length }} {{ garments.length === 1 ? 'garment' : 'garments' }}</small>
        </div>
        <CloseButton class="pointer-events-auto shrink-0 text-on-surface-variant" @click="emit('close')" />
      </header>
    </template>
    <ul class="grid grid-cols-3 content-start gap-2.5 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5">
      <li v-for="garment in garments" :key="garment.tag" class="relative min-w-0" :aria-label="garment.tag">
        <button type="button" class="block w-full rounded-xl focus-visible:outline-2 focus-visible:outline-lime" :aria-label="`Open ${garment.tag}`" @click="emit('openItem', garment.tag)"><SquareImageCard :image-url="garment.imageUrl" /></button>
      </li>
    </ul>
  </DetailOverlay>
</template>

<style scoped>
/* Section header matches the Packing bag sheet (PackagingBagSheet .bag-sec). */
.row-sec {
  display: flex;
  align-items: center;
  margin: 0 12px 8px 16px;
}

.row-sec__bar {
  align-self: stretch;
  width: 4px;
  margin-right: 10px;
  border-radius: 2px;
  background: var(--color-lime);
}

.row-sec__title {
  margin: 0;
  overflow: hidden;
  font: 800 20px/1.1 var(--font-headline);
  color: var(--color-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-sec__sub {
  display: block;
  margin-top: 3px;
  font: 800 10px/1 var(--font-body);
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--color-on-surface-variant);
}
</style>
