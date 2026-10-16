<script setup lang="ts">
import { ref, watch } from 'vue'
import type { ScanDisplay } from '../scan-result'

const props = defineProps<{ result: ScanDisplay; dismissible?: boolean }>()
defineEmits<{ dismiss: [] }>()

const imageFailed = ref(false)
watch(() => props.result.scan?.photoUrl, () => { imageFailed.value = false })

const checkPath = 'M8 34 L16 26 L26 36 L48 12 L56 20 L26 52 Z'
const markPaths = { warning: 'M25 13 v14 M25 35 v0.5', error: 'M17 17 l16 16 M33 17 l-16 16' } as const
</script>

<template>
  <div v-if="result.scan" role="status" class="relative mx-auto flex max-w-sm items-stretch overflow-hidden rounded-2xl bg-black/60 pr-10 font-body text-white shadow-lg backdrop-blur-md backdrop-saturate-150">
    <div v-if="result.scan.matched" class="relative min-h-[88px] w-24 shrink-0 self-stretch overflow-hidden">
      <img v-if="result.scan.photoUrl && !imageFailed" :src="result.scan.photoUrl" alt="" class="absolute inset-0 h-full w-full object-cover" @error="imageFailed = true">
      <div v-else class="no-photo absolute inset-0 flex flex-col items-center justify-center text-white/60">
        <span class="material-symbols-outlined text-[30px]" aria-hidden="true">checkroom</span>
        <em class="text-[10px] font-bold not-italic">No photo</em>
      </div>
      <span class="absolute inset-0 grid place-items-center bg-black/25">
        <svg v-if="result.tone === 'success'" class="check-mark h-[60px] w-[60px]" viewBox="0 0 64 64" aria-hidden="true">
          <path class="check-core" :d="checkPath" />
          <g transform="translate(32 32) scale(1.17) translate(-32 -32)"><path class="check-line check-outer" pathLength="100" :d="checkPath" /></g>
          <path class="check-line check-inner" pathLength="100" :d="checkPath" />
        </svg>
        <svg v-else-if="result.tone === 'warning' || result.tone === 'error'" class="status-mark h-[52px] w-[52px]" :class="result.tone === 'warning' ? 'text-warning' : 'text-error'" viewBox="0 0 50 50" aria-hidden="true">
          <circle cx="25" cy="25" r="21" /><path :d="markPaths[result.tone]" />
        </svg>
      </span>
    </div>
    <div v-else class="grid min-h-[88px] w-24 shrink-0 place-items-center bg-error text-on-error" aria-hidden="true">
      <span class="material-symbols-outlined text-[36px]">cancel</span>
    </div>
    <div class="flex min-w-0 flex-1 flex-col justify-center gap-[3px] py-2 pl-2.5">
      <span v-if="result.tone !== 'success'" class="w-max max-w-full rounded-full px-2.5 py-0.5 text-xs font-bold leading-tight text-on-error" :class="result.tone === 'warning' ? 'bg-warning' : 'bg-error'">{{ result.message }}</span>
      <p v-if="result.scan.matched" class="line-clamp-1 font-headline text-[15px] font-bold leading-tight">{{ result.customerName }}</p>
      <span v-if="result.scan.customerIndex" class="w-max rounded-lg bg-white/15 px-2 py-0.5 font-headline text-sm font-bold tracking-wide text-white">{{ result.scan.customerIndex }}</span>
      <p v-if="!result.scan.matched" class="text-[11px] font-semibold text-white/85">Not found in this department</p>
    </div>
    <button v-if="dismissible" type="button" class="absolute right-1.5 top-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/15 text-white focus-visible:outline-2 focus-visible:outline-lime" aria-label="Dismiss notice" @click="$emit('dismiss')"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span></button>
  </div>

  <div v-else role="status" class="relative mx-auto max-w-sm rounded-xl p-4 font-body shadow-lg" :class="result.tone === 'success' ? 'bg-success-container text-on-success-container' : result.tone === 'warning' ? 'bg-warning-container text-on-warning-container' : result.tone === 'error' ? 'bg-error-container text-on-error-container' : 'bg-surface text-on-surface'">
    <button v-if="dismissible" type="button" class="absolute right-2 top-2 rounded-full p-1 focus-visible:outline-2 focus-visible:outline-lime" aria-label="Dismiss notice" @click="$emit('dismiss')"><span class="material-symbols-outlined text-[18px]" aria-hidden="true">close</span></button>
    <p class="font-headline font-bold" :class="dismissible ? 'pr-6' : ''">{{ result.title }}</p>
    <p v-if="result.orderId" class="text-sm">{{ result.customerName }} · {{ result.orderId }}</p>
    <p v-if="result.status" class="text-sm">Status {{ result.status }}</p>
    <p class="mt-1 text-sm font-semibold">{{ result.message }}</p>
  </div>
</template>

<style scoped>
.no-photo {
  background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-on-surface) 85%, transparent) 0 10px, color-mix(in srgb, var(--color-on-surface) 65%, transparent) 10px 20px);
}
.check-mark {
  overflow: visible;
  filter: drop-shadow(0 0 3px var(--color-lime)) drop-shadow(0 0 8px color-mix(in srgb, var(--color-lime) 75%, transparent));
}
.check-core { fill: color-mix(in srgb, var(--color-primary) 60%, transparent); stroke: none; animation: check-fade 0.2s 0.3s both; }
.check-line { fill: none; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 100 150; stroke-dashoffset: 105; }
.check-inner { stroke: color-mix(in srgb, var(--color-lime) 70%, white); stroke-width: 2.8; animation: check-draw 0.4s 0.04s ease-out forwards, check-flick 0.16s 0.46s linear; }
.check-outer { stroke: var(--color-lime); stroke-width: 1.6; opacity: 0.8; animation: check-draw 0.4s 0.14s ease-out forwards; }
.status-mark { overflow: visible; filter: drop-shadow(0 1px 3px color-mix(in srgb, black 50%, transparent)); }
.status-mark circle { fill: none; stroke: currentColor; stroke-width: 3; stroke-dasharray: 132; stroke-dashoffset: 132; transform: rotate(-90deg); transform-origin: 25px 25px; animation: check-draw 0.45s ease-out forwards; }
.status-mark path { fill: none; stroke: white; stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 60; stroke-dashoffset: 60; animation: check-draw 0.3s 0.4s ease-out forwards; }
@keyframes check-draw { to { stroke-dashoffset: 0; } }
@keyframes check-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes check-flick { 0% { opacity: 1; } 30% { opacity: 0.35; } 60% { opacity: 1; } 80% { opacity: 0.6; } 100% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .check-core, .check-inner, .check-outer, .status-mark circle, .status-mark path { animation: none; stroke-dashoffset: 0; }
}
</style>
