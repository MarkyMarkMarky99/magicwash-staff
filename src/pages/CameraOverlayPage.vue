<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { encodeCanvasToJpeg } from '../utils/imageCompression'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'capture'])

const videoRef = ref(null)
const flyoutCanvasRef = ref(null)
const stream = ref(null)
const errorMessage = ref('')
const isStarting = ref(false)
const isCapturing = ref(false)
const flashActive = ref(false)
const flyoutActive = ref(false)
const lastPreviewUrl = ref('')
const previewPulse = ref(false)
let flashTimer = null
let flyoutTimer = null
let previewStartTimer = null
let previewTimer = null
let processQueueTimer = null
let shutterTimer = null
let isProcessingCaptureQueue = false
let captureCounter = 0
let disposed = false
let cameraStartToken = 0
let captureSessionId = 0
const captureQueue = []
const CAPTURE_MAX_DIMENSION = 1280
const CAPTURE_JPEG_QUALITY = 0.82
const CAPTURE_FEEDBACK_MS = 900

function capDimensions(w, h, maxDim) {
  if (w <= maxDim && h <= maxDim) return { w, h }
  const ratio = Math.min(maxDim / w, maxDim / h)
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) }
}

const canCapture = computed(
  () => props.open && !errorMessage.value && !isStarting.value && !isCapturing.value,
)

function clearFeedbackTimers() {
  window.clearTimeout(flashTimer)
  window.clearTimeout(flyoutTimer)
  window.clearTimeout(previewStartTimer)
  window.clearTimeout(previewTimer)
  window.clearTimeout(shutterTimer)
  flashTimer = null
  flyoutTimer = null
  previewStartTimer = null
  previewTimer = null
  shutterTimer = null
}

function clearLastPreview() {
  if (!lastPreviewUrl.value) return
  URL.revokeObjectURL(lastPreviewUrl.value)
  lastPreviewUrl.value = ''
}

function showShutterFlash() {
  window.clearTimeout(flashTimer)
  flashActive.value = true

  flashTimer = window.setTimeout(() => {
    flashActive.value = false
    flashTimer = null
  }, 140)
}

function clearPreviewTimers() {
  window.clearTimeout(flyoutTimer)
  window.clearTimeout(previewStartTimer)
  window.clearTimeout(previewTimer)
  flyoutTimer = null
  previewStartTimer = null
  previewTimer = null
}

function clearThumbnailTimers() {
  window.clearTimeout(previewStartTimer)
  window.clearTimeout(previewTimer)
  previewStartTimer = null
  previewTimer = null
}

function clearCaptureProcessing() {
  window.clearTimeout(processQueueTimer)
  processQueueTimer = null
  captureQueue.length = 0
}

function drawCanvasCover(targetCanvas, sourceCanvas) {
  const rect = targetCanvas.getBoundingClientRect()
  const pixelRatio = window.devicePixelRatio || 1
  const targetWidth = Math.max(1, Math.round(rect.width * pixelRatio))
  const targetHeight = Math.max(1, Math.round(rect.height * pixelRatio))

  targetCanvas.width = targetWidth
  targetCanvas.height = targetHeight

  const sourceRatio = sourceCanvas.width / sourceCanvas.height
  const targetRatio = targetWidth / targetHeight
  let sx = 0
  let sy = 0
  let sw = sourceCanvas.width
  let sh = sourceCanvas.height

  if (sourceRatio > targetRatio) {
    sw = Math.round(sourceCanvas.height * targetRatio)
    sx = Math.round((sourceCanvas.width - sw) / 2)
  } else {
    sh = Math.round(sourceCanvas.width / targetRatio)
    sy = Math.round((sourceCanvas.height - sh) / 2)
  }

  const context = targetCanvas.getContext('2d')
  if (!context) throw new Error('Canvas context unavailable')
  context.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)
}

function scheduleShutterRelease() {
  window.clearTimeout(shutterTimer)
  shutterTimer = window.setTimeout(() => {
    isCapturing.value = false
    shutterTimer = null
  }, CAPTURE_FEEDBACK_MS)
}

async function showCaptureFeedback(canvas) {
  try {
    clearPreviewTimers()

    if (!props.open || disposed) return

    flyoutActive.value = false
    previewPulse.value = false

    await nextTick()
    if (!props.open || disposed) return

    flyoutActive.value = true

    await nextTick()
    if (!props.open || disposed) return

    if (flyoutCanvasRef.value) drawCanvasCover(flyoutCanvasRef.value, canvas)

    flyoutTimer = window.setTimeout(() => {
      flyoutActive.value = false
      flyoutTimer = null
    }, CAPTURE_FEEDBACK_MS)
  } catch {
    flyoutActive.value = false
    previewPulse.value = false
  }
}

function setLastPreview(file) {
  clearThumbnailTimers()
  clearLastPreview()

  lastPreviewUrl.value = URL.createObjectURL(file)
  previewPulse.value = false

  previewStartTimer = window.setTimeout(() => {
    previewPulse.value = true
  }, 0)

  previewTimer = window.setTimeout(() => {
    previewPulse.value = false
    previewTimer = null
  }, 340)
}

async function processCaptureQueue() {
  if (isProcessingCaptureQueue) return

  isProcessingCaptureQueue = true

  while (!disposed && captureQueue.length) {
    try {
      const { canvas, filename, sessionId } = captureQueue.shift()
      const blob = await encodeCanvasToJpeg(canvas, CAPTURE_JPEG_QUALITY)
      if (disposed || sessionId !== captureSessionId) continue
      if (!blob) throw new Error('Unable to create image')

      const file = new File([blob], filename, { type: 'image/jpeg' })
      if (props.open) setLastPreview(file)
      emit('capture', file, { skipCompression: true })
    } catch {
      if (props.open) errorMessage.value = 'ถ่ายภาพไม่สำเร็จ'
    }
  }

  isProcessingCaptureQueue = false
}

function scheduleCaptureProcessing() {
  if (processQueueTimer || isProcessingCaptureQueue) return

  processQueueTimer = window.setTimeout(() => {
    processQueueTimer = null
    processCaptureQueue()
  }, 0)
}

async function startCamera() {
  if (!props.open || stream.value || isStarting.value) return

  const startToken = ++cameraStartToken
  errorMessage.value = ''

  if (!navigator.mediaDevices?.getUserMedia) {
    errorMessage.value = 'กล้องใช้ได้เมื่อเปิดผ่าน HTTPS หรือ localhost'
    return
  }

  isStarting.value = true

  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    })

    if (!props.open || disposed || startToken !== cameraStartToken) {
      mediaStream.getTracks().forEach((track) => track.stop())
      return
    }

    stream.value = mediaStream
    await nextTick()

    if (!props.open || disposed || startToken !== cameraStartToken) {
      mediaStream.getTracks().forEach((track) => track.stop())
      if (stream.value === mediaStream) stream.value = null
      return
    }

    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream
      await videoRef.value.play()
    }
  } catch (err) {
    if (!props.open || disposed || startToken !== cameraStartToken) return
    errorMessage.value = err?.name === 'NotAllowedError'
      ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง'
      : 'เปิดกล้องไม่สำเร็จ'
  } finally {
    isStarting.value = false
  }
}

function stopCamera() {
  cameraStartToken++
  if (videoRef.value) videoRef.value.srcObject = null
  stream.value?.getTracks().forEach((track) => track.stop())
  stream.value = null
  isStarting.value = false
  isCapturing.value = false
  flashActive.value = false
  flyoutActive.value = false
  previewPulse.value = false
  clearFeedbackTimers()
  clearLastPreview()
}

function discardPendingCaptures() {
  captureSessionId++
  clearCaptureProcessing()
}

function closeCamera({ discardPending = false } = {}) {
  if (discardPending) discardPendingCaptures()
  stopCamera()
  emit('close')
}

function capturePhoto() {
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

    const filename = `camera_${Date.now()}_${captureCounter++}.jpg`
    showCaptureFeedback(canvas)
    captureQueue.push({ canvas, filename, sessionId: captureSessionId })
    scheduleCaptureProcessing()
  } catch {
    errorMessage.value = 'ถ่ายภาพไม่สำเร็จ'
  } finally {
    scheduleShutterRelease()
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      startCamera()
    } else {
      stopCamera()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  disposed = true
  captureSessionId++
  clearCaptureProcessing()
  stopCamera()
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[60] bg-black text-white">
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
        <button
          class="h-11 w-11 rounded-full bg-black/45 flex items-center justify-center active:opacity-80"
          aria-label="ปิดกล้อง"
          @click="closeCamera({ discardPending: true })"
        >
          <span class="material-symbols-outlined text-2xl">close</span>
        </button>

        <div class="h-11 w-11" aria-hidden="true" />
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
        {{ isStarting ? 'กำลังเปิดกล้อง…' : errorMessage }}
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
            class="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center active:opacity-80"
            aria-label="เสร็จสิ้น"
            @click="closeCamera()"
          >
            <span class="material-symbols-outlined text-2xl">check</span>
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

        <div class="flex justify-end">
          <div
            class="h-14 w-14 rounded-lg border border-white/45 bg-white/15 overflow-hidden shadow-lg transition-transform"
            :class="{ 'preview-pop': previewPulse }"
            aria-live="polite"
          >
            <img
              v-if="lastPreviewUrl"
              :src="lastPreviewUrl"
              alt="ภาพล่าสุด"
              class="h-full w-full object-cover"
            />
            <div v-else class="h-full w-full flex items-center justify-center text-white/70">
              <span class="material-symbols-outlined text-2xl">photo_library</span>
            </div>
          </div>
        </div>
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
  transform-origin: right bottom;
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
    transform: translate(-1.35rem, -5.6rem) scale(0.16);
    opacity: 0.92;
  }
  100% {
    border-radius: 14px;
    transform: translate(-1.25rem, -5rem) scale(0.11);
    opacity: 0;
  }
}
</style>
