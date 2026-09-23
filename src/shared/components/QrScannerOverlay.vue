<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { startBarcodeScanner } from '@/shared/utils/barcode-scanner'

const props = defineProps<{ open: boolean; title: string; vibrateOnRead?: boolean }>()
const emit = defineEmits<{ close: []; scan: [value: string] }>()

const videoRef = ref<HTMLVideoElement | null>(null)
const cameraError = ref('')
const starting = ref(false)
let stream: MediaStream | null = null
let stopScanner: (() => void) | null = null
let startToken = 0
let lastResult = ''
let lastResultAt = 0

function stopCamera(): void {
  startToken += 1
  stopScanner?.()
  stopScanner = null
  if (videoRef.value) videoRef.value.srcObject = null
  stream?.getTracks().forEach(track => track.stop())
  stream = null
  starting.value = false
}

async function startCamera(): Promise<void> {
  if (!props.open || starting.value || stream) return
  const token = ++startToken
  cameraError.value = ''
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value = 'กล้องใช้ได้เมื่อเปิดผ่าน HTTPS หรือ localhost'
    return
  }
  starting.value = true
  try {
    const nextStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    })
    if (!props.open || token !== startToken) {
      nextStream.getTracks().forEach(track => track.stop())
      return
    }
    stream = nextStream
    await nextTick()
    if (token !== startToken) return
    if (!videoRef.value) {
      stopCamera()
      cameraError.value = 'เปิดกล้องไม่สำเร็จ'
      return
    }
    videoRef.value.srcObject = nextStream
    await videoRef.value.play()
    const nextStop = await startBarcodeScanner(videoRef.value, value => {
      if (token !== startToken || !props.open) return
      const trimmed = value.trim()
      const now = Date.now()
      if (trimmed && (trimmed !== lastResult || now - lastResultAt > 2000)) {
        lastResult = trimmed
        lastResultAt = now
        if (props.vibrateOnRead !== false) navigator.vibrate?.(70)
        emit('scan', trimmed)
      }
    }, () => {
      if (token !== startToken || !props.open) return
      stopCamera()
      cameraError.value = 'กล้องหยุดทำงาน กรุณาลองใหม่'
    })
    if (token !== startToken) {
      nextStop()
      return
    }
    stopScanner = nextStop
  } catch (error) {
    if (token !== startToken) return
    stopCamera()
    cameraError.value = error instanceof DOMException && error.name === 'NotAllowedError'
      ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง'
      : 'เปิดกล้องไม่สำเร็จ'
  } finally {
    if (token === startToken) starting.value = false
  }
}

watch(() => props.open, open => {
  if (open) {
    lastResult = ''
    lastResultAt = 0
    void startCamera()
  } else {
    stopCamera()
  }
}, { immediate: true })

onBeforeUnmount(stopCamera)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[60] bg-black text-white" role="dialog" aria-modal="true" :aria-label="title">
      <video ref="videoRef" class="absolute inset-0 h-full w-full object-cover" autoplay muted playsinline />
      <div class="absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 to-transparent px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 focus-visible:outline-2 focus-visible:outline-white" aria-label="ปิดกล้องสแกน" @click="emit('close')">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
          <h2 class="font-headline text-sm font-bold">{{ title }}</h2>
          <div />
        </div>
      </div>

      <div v-if="!cameraError && !starting" class="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
        <div class="relative aspect-square w-[min(60vmin,16rem)]">
          <span class="absolute left-0 top-0 h-7 w-7 border-l-4 border-t-4 border-lime" />
          <span class="absolute right-0 top-0 h-7 w-7 border-r-4 border-t-4 border-lime" />
          <span class="absolute bottom-0 left-0 h-7 w-7 border-b-4 border-l-4 border-lime" />
          <span class="absolute bottom-0 right-0 h-7 w-7 border-b-4 border-r-4 border-lime" />
          <span class="scan-line absolute inset-x-0 top-1/2 border-t border-lime" />
        </div>
      </div>

      <div v-if="starting || cameraError" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 px-6 text-center">
        <span class="material-symbols-outlined text-5xl" aria-hidden="true">{{ starting ? 'progress_activity' : 'photo_camera' }}</span>
        <p class="font-body text-sm">{{ starting ? 'กำลังเปิดกล้อง…' : cameraError }}</p>
        <button v-if="cameraError" type="button" class="pointer-events-auto rounded-full bg-white px-5 py-2 text-black" @click="startCamera">ลองใหม่</button>
      </div>

      <div v-if="$slots.result" class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
        <slot name="result" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.scan-line {
  animation: scan-line 2s ease-in-out infinite;
}

@keyframes scan-line {
  0%, 100% { transform: translateY(calc(2rem - min(30vmin, 8rem))); }
  50% { transform: translateY(calc(min(30vmin, 8rem) - 2rem)); }
}

@media (prefers-reduced-motion: reduce) {
  .scan-line { animation: none; transform: translateY(0); }
}
</style>
