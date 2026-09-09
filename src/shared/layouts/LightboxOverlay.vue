<script setup lang="ts">
import BaseOverlayFrame from '@/shared/layouts/BaseOverlayFrame.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'

defineProps<{
  open: boolean
  ariaLabel: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <BaseOverlayFrame
    :open="open"
    placement="center"
    size="full"
    backdrop="none"
    :draggable="false"
    close-button
    panel-class="lightbox-overlay-panel !h-[calc(100%+2rem)] !max-h-none !w-[calc(100%+2rem)] !max-w-none !rounded-none bg-black/90 text-white shadow-none"
    :ariaLabel="ariaLabel"
    @close="emit('close')"
  >
    <ScrollRegion class="flex flex-col items-center justify-center p-4" @click="emit('close')">
      <slot />
    </ScrollRegion>
  </BaseOverlayFrame>
</template>

<style>
.lightbox-overlay-panel > button[aria-label="Close"] {
  color: #ffffff;
}
</style>
