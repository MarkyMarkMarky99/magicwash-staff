<script setup lang="ts">
import type { GarmentUploadStatus } from '@/shared/composables/useGarmentPhotoUploads'

defineProps<{ status?: GarmentUploadStatus }>()
</script>

<template>
  <span v-if="status === 'uploading' || status === 'failed'" class="absolute inset-0 grid place-items-center rounded-[inherit] bg-black/50 text-white" :aria-label="status === 'failed' ? 'Upload failed. Tap to retry' : 'Uploading'">
    <span class="material-symbols-outlined text-[20px]" :class="{ 'animate-spin': status === 'uploading' }" aria-hidden="true">{{ status === 'uploading' ? 'progress_activity' : 'error' }}</span>
  </span>
</template>
