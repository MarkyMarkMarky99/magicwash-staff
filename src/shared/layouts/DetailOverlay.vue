<script setup lang="ts">
import BaseOverlayFrame from '@/shared/layouts/BaseOverlayFrame.vue'
import ScrollRegion from '@/shared/components/ScrollRegion.vue'

withDefaults(defineProps<{
  open: boolean
  ariaLabel: string
  closeOnBackdrop?: boolean
  panelClass?: string
  size?: '84dvh' | 'auto'
}>(), {
  closeOnBackdrop: true,
  panelClass: '',
  size: '84dvh',
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
    draggable
    close-button
    :panel-class="panelClass"
    :ariaLabel="ariaLabel"
    :close-on-backdrop="closeOnBackdrop"
    @close="emit('close')"
  >
    <div class="flex min-h-0 flex-col" :class="size === 'auto' ? 'flex-none' : 'flex-1'">
      <div class="flex-none">
        <slot name="header" />
      </div>
      <ScrollRegion :sizing="size === 'auto' ? 'auto' : 'fill'" :class="size === 'auto' ? 'max-h-[60dvh]' : ''">
        <slot />
      </ScrollRegion>
    </div>
  </BaseOverlayFrame>
</template>
