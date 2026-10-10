<script setup lang="ts">
import StickerFab from '@/shared/components/StickerFab.vue'

defineProps<{ saving: boolean; disabled: boolean }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <StickerFab class="!h-12 !w-12 !rounded-[17px_20px_17px_19px]" label="Photo" aria-label="Book a basket: take photo" saving-label="Upload" :saving="saving" :disabled="disabled" @click="$emit('click')">
    <span class="material-symbols-outlined text-[22px]" aria-hidden="true">photo_camera</span>
  </StickerFab>
</template>
