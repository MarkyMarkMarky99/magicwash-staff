<script setup lang="ts">
import BaseOverlayFrame from '@/shared/layouts/BaseOverlayFrame.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'

withDefaults(defineProps<{
  open: boolean
  ariaLabel: string
  closeOnBackdrop?: boolean
  panelClass?: string
  size?: '90dvh' | 'full'
  draggable?: boolean
}>(), {
  closeOnBackdrop: true,
  panelClass: '',
  size: '90dvh',
  draggable: true,
})

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <BaseOverlayFrame
    :open="open"
    placement="bottom"
    :size="size"
    backdrop="translucent"
    :draggable="draggable"
    close-button
    :panel-class="`picker-overlay-panel ${panelClass}`"
    :ariaLabel="ariaLabel"
    :close-on-backdrop="closeOnBackdrop"
    @close="emit('close')"
  >
    <div class="flex min-h-0 flex-1 flex-col bg-surface text-on-surface">
      <div class="flex-none">
        <slot name="header" />
      </div>
      <ScrollRegion>
        <slot />
      </ScrollRegion>
    </div>
  </BaseOverlayFrame>
</template>

<style>
.picker-overlay-panel > button[aria-label="Close"] {
  color: #ffffff;
}

.picker-overlay-panel > button[aria-label="Close"]:hover,
.picker-overlay-panel > button[aria-label="Close"]:focus-visible {
  background-color: rgb(255 255 255 / 0.12);
}
</style>
