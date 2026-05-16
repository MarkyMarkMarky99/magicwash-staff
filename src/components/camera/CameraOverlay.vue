<script setup>
import { computed, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { encodeCanvasToJpeg } from '../../utils/imageCompression'
import { useCameraStream } from './composables/useCameraStream'
import { useCaptureFeedback } from './composables/useCaptureFeedback'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  lastPreviewUrl: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'capture'])

const videoRef = ref(null)
const flyoutCanvasRef = ref(null)
const isCapturing = ref(false)

const CAPTURE_MAX_DIMENSION = 1280
const CAPTURE_JPEG_QUALITY = 1.0

const {
  errorMessage,
  isStarting,
  startCamera,
  stopCamera,
} = useCameraStream(videoRef, () => props.open && !disposed)

const {
  flashActive,
  flyoutActive,
  previewPulse,
  showShutterFlash,
  scheduleShutterRelease,
  showFlyout,
  pulsePreview,
  resetFeedback,
} = useCaptureFeedback(flyoutCanvasRef)

let disposed = false
let captureCounter = 0

const canCapture = computed(
  () => props.open && !errorMessage.value && !isStarting.value && !isCapturing.value,
)

function capDimensions(w, h, maxDim) {
  if (w <= maxDim && h <= maxDim) return { w, h }
  const ratio = Math.min(maxDim / w, maxDim / h)
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) }
}

async function capturePhoto() {
  if (!canCapture.value || !videoRef.value) return

  const video = videoRef.value
  const width = video.videoWidth
  const height = video.videoHeight

  if (!width || !height) {
    errorMessage.value = 'กล้องยังไม่พร้อม'
    return
  }

  isCapturing.value = true
  showShutterFlash()

  try {
    const dimensions = capDimensions(width, height, CAPTURE_MAX_DIMENSION)
    const canvas = document.createElement('canvas')
    canvas.width = dimensions.w
    canvas.height = dimensions.h

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas context unavailable')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(video, 0, 0, width, height, 0, 0, dimensions.w, dimensions.h)

    showFlyout(canvas)

    const blob = await encodeCanvasToJpeg(canvas, CAPTURE_JPEG_QUALITY)
    if (!blob || disposed) throw new Error('Unable to create image')

    const filename = `camera_${Date.now()}_${captureCounter++}.jpg`
    const file = new File([blob], filename, { type: 'image/jpeg' })
    pulsePreview()
    emit('capture', file, { source: 'camera', skipCompression: true })
  } catch {
    if (!disposed) errorMessage.value = 'ถ่ายภาพไม่สำเร็จ'
  } finally {
    scheduleShutterRelease(() => {
      isCapturing.value = false
    })
  }
}

function closeCamera() {
  stopCamera()
  resetFeedback()
  isCapturing.value = false
  emit('close')
}

function cleanupCamera() {
  stopCamera()
  resetFeedback()
  isCapturing.value = false
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      startCamera()
    } else {
      stopCamera()
      resetFeedback()
      isCapturing.value = false
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  disposed = true
  cleanupCamera()
})

onDeactivated(cleanupCamera)
</script>

<template>
  <div v-if="open" class="absolute inset-0 z-[60] bg-black text-white">
    <video
      ref="videoRef"
      class="absolute inset-0 h-full w-full object-cover"
      autoplay
      muted
      playsinline
    />

    <div
      class="pointer-events-none absolute inset-0 bg-white transition-opacity duration-150"
      :class="flashActive ? 'opacity-75' : 'opacity-0'"
    />

    <canvas
      v-if="flyoutActive"
      ref="flyoutCanvasRef"
      aria-hidden="true"
      class="capture-flyout pointer-events-none absolute inset-0 h-full w-full object-cover"
    ></canvas>

    <div class="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-4">
      <div class="flex items-center justify-between gap-3">
        <div class="h-11 w-11" aria-hidden="true" />
        <button
          class="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 active:opacity-80"
          aria-label="ปิดกล้อง"
          @click="closeCamera"
        >
          <span class="material-symbols-outlined text-2xl">close</span>
        </button>
      </div>
    </div>

    <div v-if="isStarting || errorMessage" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center">
      <span
        class="material-symbols-outlined text-5xl"
        :class="{ 'animate-spin': isStarting }"
      >
        {{ isStarting ? 'progress_activity' : 'photo_camera' }}
      </span>
      <p class="font-body text-sm text-white/80">
        {{ isStarting ? 'กำลังเปิดกล้อง...' : errorMessage }}
      </p>
      <button
        v-if="errorMessage"
        class="mt-2 rounded-full bg-white px-5 py-2.5 font-body text-sm font-medium text-black"
        @click="startCamera"
      >
        ลองใหม่
      </button>
    </div>

    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
      <div class="grid grid-cols-3 items-center">
        <div class="flex justify-start">
          <button
            class="h-14 w-14 overflow-hidden rounded-lg border border-white/45 bg-white/15 shadow-lg transition-transform active:scale-95"
            :class="{ 'preview-pop': previewPulse }"
            aria-label="ดูภาพล่าสุด"
            @click="closeCamera"
          >
            <img
              v-if="lastPreviewUrl"
              :src="lastPreviewUrl"
              alt="ภาพล่าสุด"
              class="h-full w-full object-cover"
            />
            <div v-else class="flex h-full w-full items-center justify-center text-white/70">
              <span class="material-symbols-outlined text-2xl">photo_library</span>
            </div>
          </button>
        </div>

        <div class="flex justify-center">
          <button
            class="h-20 w-20 rounded-full border-4 border-white bg-white/20 p-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!canCapture"
            aria-label="ถ่ายภาพ"
            @click="capturePhoto"
          >
            <span class="block h-full w-full rounded-full bg-white" />
          </button>
        </div>

        <div aria-hidden="true" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-pop {
  animation: preview-pop 0.34s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.capture-flyout {
  animation: capture-flyout 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  transform-origin: left bottom;
  will-change: transform, opacity, border-radius;
}

@keyframes preview-pop {
  0% {
    transform: scale(0.72);
    opacity: 0;
  }
  70% {
    transform: scale(1.08);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes capture-flyout {
  0% {
    border-radius: 0;
    transform: translateY(0) scale(1);
    opacity: 0.96;
  }
  18% {
    border-radius: 10px;
    transform: translateY(-18px) scale(0.96);
    opacity: 0.98;
  }
  72% {
    border-radius: 16px;
    transform: translate(1.35rem, -5.6rem) scale(0.16);
    opacity: 0.92;
  }
  100% {
    border-radius: 14px;
    transform: translate(1.25rem, -5rem) scale(0.11);
    opacity: 0;
  }
}
</style>
