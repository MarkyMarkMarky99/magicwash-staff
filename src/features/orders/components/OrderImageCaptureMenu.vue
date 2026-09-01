<script setup lang="ts">
import BaseDropdown from '@/shared/components/BaseDropdown.vue'
import { ORDER_IMAGE_TYPES, orderImageTypeIcons, orderImageTypeLabels, type OrderImageType } from '@/features/orders/order-image-labels'

const emit = defineEmits<{
  capture: [imageType: OrderImageType]
}>()

function capture(imageType: OrderImageType, close: () => void) {
  close()
  emit('capture', imageType)
}
</script>

<template>
  <BaseDropdown panel-class="w-48 overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest py-1 shadow-2xl">
    <template #trigger="{ open, setTrigger, toggle, triggerAttrs }">
      <button
        :ref="setTrigger"
        v-bind="triggerAttrs"
        type="button"
        class="relative flex h-[22px] items-center gap-1 whitespace-nowrap rounded-full bg-surface-container px-2.5 pr-1.5 font-label text-[9px] font-bold uppercase tracking-wider text-on-surface-variant transition-all after:absolute after:-inset-2 after:content-[''] hover:bg-surface-container-high active:scale-95 focus:outline-none"
        @click="toggle"
      >
        เพิ่มรูป
        <span class="material-symbols-outlined text-[14px] leading-none transition-transform" :class="open ? 'rotate-180' : ''" aria-hidden="true">expand_more</span>
      </button>
    </template>

    <template #default="{ close }">
      <div class="py-1">
        <button
          v-for="imageType in ORDER_IMAGE_TYPES"
          :key="imageType"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-2 text-left font-body text-[12px] text-on-surface transition-colors hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none active:bg-surface-container"
          @click="capture(imageType, close)"
        >
          <span class="material-symbols-outlined text-[16px] leading-none text-primary" aria-hidden="true">{{ orderImageTypeIcons[imageType] }}</span>
          {{ orderImageTypeLabels[imageType] }}
        </button>
      </div>
    </template>
  </BaseDropdown>
</template>
