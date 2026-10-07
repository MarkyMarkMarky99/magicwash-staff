<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  url: string | null
  alt: string
}>()

const emit = defineEmits<{
  open: []
}>()

const failed = ref(false)
const retrying = ref(false)
const attempt = ref(0)

watch(() => props.url, () => {
  failed.value = false
  retrying.value = false
  attempt.value = 0
})

function onError() {
  failed.value = true
  retrying.value = false
}

function onLoad() {
  retrying.value = false
}

function retry() {
  retrying.value = true
  failed.value = false
  attempt.value += 1
}
</script>

<template>
  <div
    v-if="url === null || failed"
    role="alert"
    class="grid aspect-[3/4] w-full place-content-center justify-items-center gap-[18px] bg-primary text-center text-on-primary/85"
  >
    <svg class="h-[38px] w-[38px] text-on-primary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /><path d="M3 3l18 18" /></svg>
    <p class="m-0 max-w-[24ch] text-[15px] font-medium">{{ url === null ? 'There is no photo for this bag. Your weight is below.' : 'The photo didn’t load. Your weight is below.' }}</p>
    <button
      v-if="url !== null"
      type="button"
      class="min-h-[52px] -rotate-[7deg] rounded-2xl bg-lime px-6 py-4 text-base font-bold leading-none text-on-surface shadow-[4px_4px_0_color-mix(in_srgb,var(--color-primary)_70%,black)] transition-[transform,box-shadow] duration-100 hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_color-mix(in_srgb,var(--color-primary)_70%,black)] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-progress disabled:opacity-80 motion-reduce:transition-none"
      :disabled="retrying"
      @click="retry"
    >{{ retrying ? 'Trying…' : 'Try again' }}</button>
  </div>
  <button
    v-else
    type="button"
    class="relative block aspect-[3/4] w-full cursor-zoom-in border-0 bg-gradient-to-b from-surface-container-highest to-outline-variant p-0 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-lime"
    aria-haspopup="dialog"
    aria-label="Open photo of your bag on the scale, full screen"
    @click="emit('open')"
  >
    <img :key="attempt" :src="url" :alt="alt" class="absolute inset-0 h-full w-full object-cover" @load="onLoad" @error="onError">
    <span class="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-on-surface/80 px-2.5 py-1 text-xs font-medium text-white" aria-hidden="true">
      <svg class="h-[13px] w-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
      Tap to enlarge
    </span>
  </button>
</template>
