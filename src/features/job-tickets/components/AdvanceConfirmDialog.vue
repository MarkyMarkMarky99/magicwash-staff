<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

defineProps<{ title: string; message: string; count: number; sendLabel: string; showCancel: boolean }>()
defineEmits<{ send: []; discard: []; cancel: [] }>()

let overlayRoot: HTMLElement | null = null
let previousZIndex = ''
onMounted(() => {
  overlayRoot = document.getElementById('overlay-root')
  if (overlayRoot) {
    previousZIndex = overlayRoot.style.zIndex
    overlayRoot.style.zIndex = '80'
  }
})
onBeforeUnmount(() => {
  if (overlayRoot) overlayRoot.style.zIndex = previousZIndex
})
</script>

<template>
  <Teleport to="#overlay-root">
    <div class="pointer-events-auto absolute inset-0 z-[70] flex items-center justify-center bg-black/65 p-5" role="dialog" aria-modal="true" :aria-label="title" @keydown.esc="$emit('cancel')">
      <div class="w-full max-w-sm rounded-2xl bg-surface p-5 text-on-surface shadow-xl">
        <h2 class="font-headline text-xl font-bold">{{ title }}</h2>
        <p class="mt-2 font-body text-sm">{{ message }}</p>
        <p class="mt-2 font-label text-sm font-semibold">{{ count }} selected</p>
        <div class="mt-5 flex flex-wrap justify-end gap-2">
          <button v-if="showCancel" type="button" class="rounded-full px-4 py-2 font-label text-sm focus-visible:outline-2 focus-visible:outline-lime" autofocus @click="$emit('cancel')">Cancel</button>
          <button type="button" class="rounded-full border border-outline px-4 py-2 font-label text-sm focus-visible:outline-2 focus-visible:outline-lime" @click="$emit('discard')">Discard</button>
          <button type="button" class="rounded-full bg-primary px-4 py-2 font-label text-sm text-on-primary focus-visible:outline-2 focus-visible:outline-lime" @click="$emit('send')">{{ sendLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
