<script setup lang="ts">
import StickerFab from '@/shared/components/StickerFab.vue'

defineProps<{ saving: boolean; disabled: boolean }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <StickerFab size="sm" label="Photo" aria-label="Book a basket: take photo" saving-label="Upload" :saving="saving" :disabled="disabled" @click="$emit('click')">
    <span class="material-symbols-outlined text-[22px]" aria-hidden="true">photo_camera</span>
  </StickerFab>
</template>
