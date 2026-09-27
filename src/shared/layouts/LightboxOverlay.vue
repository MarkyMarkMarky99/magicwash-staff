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
    backdrop="opaque"
    :draggable="false"
    close-button
    close-button-tone="onDark"
    close-button-class="text-white"
    panel-class="!rounded-none !bg-transparent text-white !shadow-none"
    :ariaLabel="ariaLabel"
    @close="emit('close')"
  >
    <ScrollRegion class="flex flex-col items-center justify-center px-4 pb-4 pt-16" @click="emit('close')">
      <slot />
    </ScrollRegion>
  </BaseOverlayFrame>
</template>
