<script setup lang="ts">
import BaseOverlayFrame from '@/shared/layouts/BaseOverlayFrame.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'

withDefaults(defineProps<{
  open: boolean
  ariaLabel: string
  closeOnBackdrop?: boolean
  panelClass?: string
}>(), {
  closeOnBackdrop: true,
  panelClass: '',
})

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <BaseOverlayFrame
    :open="open"
    placement="bottom"
    size="84dvh"
    backdrop="translucent"
    draggable
    close-button
    :panel-class="panelClass"
    :ariaLabel="ariaLabel"
    :close-on-backdrop="closeOnBackdrop"
    @close="emit('close')"
  >
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="flex-none">
        <slot name="header" />
      </div>
      <ScrollRegion>
        <slot />
      </ScrollRegion>
    </div>
  </BaseOverlayFrame>
</template>
