<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { startBarcodeScanner } from '@/shared/utils/barcode-scanner'
import { canVibrate, setSoundEnabled, setVibrationEnabled, soundEnabled, vibrationEnabled } from '@/shared/utils/scan-feedback'
import { encodeCanvasToJpeg } from '@/utils/imageCompression'

const props = defineProps<{
  open: boolean
  tag: string | null
  hasPhoto: boolean
  registeredCount: number
  pendingCount: number
  tagChecking: boolean
  warning: string | null
  errors: string[]
  loadError: string | null
  itemLabel: string
  resetVersion: number
}>()

const emit = defineEmits<{
  close: []
  tag: [value: string]
  photo: [file: File]
  redoTag: []
  retry: []
  clearError: [index: number]
}>()
const vibrationAvailable = canVibrate()

const videoRef = ref<HTMLVideoElement | null>(null)
const flyoutCanvasRef = ref<HTMLCanvasElement | null>(null)
const mode = ref<'scan' | 'photo'>('photo')
const tagInput = ref('')
const cameraError = ref('')
const starting = ref(false)
const capturing = ref(false)
const flashActive = ref(false)
const flyoutActive = ref(false)
const lastPreviewUrl = ref('')
const previewPulse = ref(false)
let stream: MediaStream | null = null
let stopScanner: (() => void) | null = null
let startToken = 0
let lastResult = ''
let lastResultAt = 0
let flashTimer: number | null = null
let flyoutTimer: number | null = null
let previewStartTimer: number | null = null
let previewTimer: number | null = null
let shutterTimer: number | null = null
let captureSessionId = 0
let disposed = false
const CAPTURE_FEEDBACK_MS = 900

function clearFeedbackTimers(): void {
  if (flashTimer !== null) window.clearTimeout(flashTimer)
  if (flyoutTimer !== null) window.clearTimeout(flyoutTimer)
  if (previewStartTimer !== null) window.clearTimeout(previewStartTimer)
  if (previewTimer !== null) window.clearTimeout(previewTimer)
  if (shutterTimer !== null) window.clearTimeout(shutterTimer)
  flashTimer = null
  flyoutTimer = null
  previewStartTimer = null
  previewTimer = null
  shutterTimer = null
}

function clearLastPreview(): void {
  if (!lastPreviewUrl.value) return
  URL.revokeObjectURL(lastPreviewUrl.value)
  lastPreviewUrl.value = ''
}

function showShutterFlash(): void {
  if (flashTimer !== null) window.clearTimeout(flashTimer)
  flashActive.value = true
  flashTimer = window.setTimeout(() => {
    flashActive.value = false
    flashTimer = null
  }, 140)
}

function drawCanvasCover(targetCanvas: HTMLCanvasElement, sourceCanvas: HTMLCanvasElement): void {
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

async function showCaptureFeedback(canvas: HTMLCanvasElement, sessionId: number): Promise<void> {
  try {
    if (flyoutTimer !== null) window.clearTimeout(flyoutTimer)
    flyoutActive.value = false
    previewPulse.value = false
    await nextTick()
    if (!props.open || disposed || sessionId !== captureSessionId) return
    flyoutActive.value = true
    await nextTick()
    if (!props.open || disposed || sessionId !== captureSessionId) return
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

function setLastPreview(file: File): void {
  if (previewStartTimer !== null) window.clearTimeout(previewStartTimer)
  if (previewTimer !== null) window.clearTimeout(previewTimer)
  clearLastPreview()
  lastPreviewUrl.value = URL.createObjectURL(file)
  previewPulse.value = false
  previewStartTimer = window.setTimeout(() => {
    previewPulse.value = true
    previewStartTimer = null
  }, 0)
  previewTimer = window.setTimeout(() => {
    previewPulse.value = false
    previewTimer = null
  }, 340)
}

function stopCamera(): void {
  startToken += 1
  captureSessionId += 1
  stopScanner?.()
  stopScanner = null
  if (videoRef.value) videoRef.value.srcObject = null
  stream?.getTracks().forEach(track => track.stop())
  stream = null
  starting.value = false
  capturing.value = false
  flashActive.value = false
  flyoutActive.value = false
  previewPulse.value = false
  clearFeedbackTimers()
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
    if (!videoRef.value || token !== startToken) return
    videoRef.value.srcObject = nextStream
    await videoRef.value.play()
    const nextStop = await startBarcodeScanner(videoRef.value, value => {
      if (token !== startToken || !props.open || props.tag) return
      const trimmed = value.trim()
      const now = Date.now()
      if (trimmed && (trimmed !== lastResult || now - lastResultAt > 2000)) {
        lastResult = trimmed
        lastResultAt = now
        emit('tag', trimmed)
      }
    }, () => {
      if (token !== startToken || !props.open) return
      stopCamera()
      cameraError.value = 'กล้องหยุดทำงาน กรุณาลองใหม่'
    }, () => !props.tag)
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

async function capturePhoto(): Promise<void> {
  const video = videoRef.value
  if (!video || !stream || capturing.value || !video.videoWidth || !video.videoHeight) return
  const sessionId = captureSessionId
  const capturedAt = Date.now()
  capturing.value = true
  showShutterFlash()
  try {
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas context unavailable')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    void showCaptureFeedback(canvas, sessionId)
    const blob = await encodeCanvasToJpeg(canvas, 0.82)
    if (!props.open || disposed || sessionId !== captureSessionId) return
    if (!blob) throw new Error('Unable to create image')
    const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' })
    setLastPreview(file)
    emit('photo', file)
    if (!props.tag) mode.value = 'scan'
  } catch {
    if (props.open && !disposed && sessionId === captureSessionId) cameraError.value = 'ถ่ายภาพไม่สำเร็จ'
  } finally {
    if (sessionId === captureSessionId && !disposed) {
      shutterTimer = window.setTimeout(() => {
        capturing.value = false
        shutterTimer = null
      }, Math.max(0, CAPTURE_FEEDBACK_MS - (Date.now() - capturedAt)))
    }
  }
}

function updateTagInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  tagInput.value = value
  if (!value || (props.tag && value !== props.tag)) {
    emit('redoTag')
    mode.value = 'scan'
  }
}

function submitTag(): void {
  const value = tagInput.value.trim()
  if (!value) return
  emit('tag', value)
  const activeElement = document.activeElement
  if (activeElement instanceof HTMLElement) activeElement.blur()
}

watch(() => props.open, open => {
  if (open) {
    mode.value = 'photo'
    void startCamera()
  } else {
    stopCamera()
    tagInput.value = ''
    clearLastPreview()
  }
}, { immediate: true })

watch(() => props.tag, (tag, oldTag) => {
  if (tag) tagInput.value = tag
  else if (oldTag && tagInput.value === oldTag) tagInput.value = ''
  if (tag && tag !== oldTag) {
    if (!props.hasPhoto) mode.value = 'photo'
  }
})

watch(() => props.resetVersion, () => {
  tagInput.value = ''
  mode.value = 'photo'
})

onBeforeUnmount(() => {
  disposed = true
  stopCamera()
  clearLastPreview()
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[60] bg-black text-white">
    <video ref="videoRef" class="absolute inset-0 h-full w-full object-cover" autoplay muted playsinline />
    <div class="pointer-events-none absolute inset-0 bg-white transition-opacity duration-150" :class="flashActive ? 'opacity-75' : 'opacity-0'" />
    <canvas v-if="flyoutActive" ref="flyoutCanvasRef" aria-hidden="true" class="capture-flyout pointer-events-none absolute inset-0 h-full w-full object-cover"></canvas>
    <div class="absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 to-transparent px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <div class="flex items-center gap-2">
        <div class="flex shrink-0 items-center gap-1">
          <button type="button" class="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 disabled:opacity-40" :disabled="pendingCount > 0" aria-label="ปิดลงทะเบียน" @click="emit('close')">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
          <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white focus-visible:outline-2 focus-visible:outline-white" :class="soundEnabled ? '' : 'opacity-45'" :aria-pressed="soundEnabled" :aria-label="soundEnabled ? 'ปิดเสียงตอบรับ' : 'เปิดเสียงตอบรับ'" @click="setSoundEnabled(!soundEnabled)">
            <span class="material-symbols-outlined text-[19px]" aria-hidden="true">{{ soundEnabled ? 'volume_up' : 'volume_off' }}</span>
          </button>
          <button v-if="vibrationAvailable" type="button" class="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white focus-visible:outline-2 focus-visible:outline-white" :class="vibrationEnabled ? '' : 'opacity-45'" :aria-pressed="vibrationEnabled" :aria-label="vibrationEnabled ? 'ปิดการสั่นตอบรับ' : 'เปิดการสั่นตอบรับ'" @click="setVibrationEnabled(!vibrationEnabled)">
            <span class="material-symbols-outlined text-[19px]" aria-hidden="true">{{ vibrationEnabled ? 'vibration' : 'mobile_off' }}</span>
          </button>
        </div>
        <div class="min-w-0 flex-1 text-right">
          <p class="truncate font-headline text-sm font-bold">ลงทะเบียน {{ itemLabel }}</p>
          <p class="font-label text-xs text-white/75">สำเร็จ {{ registeredCount }} · กำลังอัปโหลด {{ pendingCount }}</p>
        </div>
      </div>
      <div class="mt-2 flex justify-center">
        <div class="inline-flex rounded-full bg-black/65 p-1">
          <button type="button" class="rounded-full px-3 py-2 text-sm" :class="mode === 'scan' ? 'bg-lime text-primary' : 'text-white'" :aria-pressed="mode === 'scan'" @click="mode = 'scan'">สแกน</button>
          <button type="button" class="rounded-full px-3 py-2 text-sm" :class="mode === 'photo' ? 'bg-lime text-primary' : 'text-white'" :aria-pressed="mode === 'photo'" @click="mode = 'photo'">ถ่ายรูป</button>
        </div>
      </div>
      <div v-if="warning" role="alert" class="mt-3 rounded-xl bg-warning-container px-3 py-2 font-body text-sm text-on-warning-container">{{ warning }}</div>
      <div v-for="(error, index) in errors" :key="index" role="alert" class="mt-3 flex items-start gap-2 rounded-xl bg-error-container px-3 py-2 font-body text-sm text-on-error-container">
        <span class="flex-1">{{ error }}</span>
        <button type="button" :aria-label="`ปิดข้อผิดพลาด ${error}`" @click="emit('clearError', index)"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
      </div>
      <div v-if="loadError" role="alert" class="mt-3 flex items-center gap-2 rounded-xl bg-error-container px-3 py-2 font-body text-sm text-on-error-container">
        <span class="flex-1">{{ loadError }}</span>
        <button type="button" class="rounded-full border border-current px-3 py-1" @click="emit('retry')">ลองใหม่</button>
      </div>
    </div>

    <div v-if="mode === 'scan' && !cameraError && !starting" class="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
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
      <button v-if="cameraError" type="button" class="pointer-events-auto rounded-full bg-white px-5 py-2 text-black" @click="cameraError = ''; startCamera()">ลองใหม่</button>
    </div>

    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
      <div class="mb-3 flex justify-center">
        <label class="flex min-h-16 w-full max-w-xs items-center gap-2 rounded-xl border border-white/40 bg-black/60 p-2 text-left">
          <span class="material-symbols-outlined text-lime" aria-hidden="true">qr_code_2</span>
          <span class="min-w-0 flex-1">
            <span class="block font-label text-xs text-white/70">แท็ก</span>
            <input :value="tagInput" type="text" maxlength="8" autocomplete="off" enterkeyhint="done" aria-label="รหัสแท็ก" placeholder="ยังไม่มี" class="w-full bg-transparent font-body text-sm text-white outline-none placeholder:text-white/70" @input="updateTagInput" @keydown.enter.prevent="submitTag">
          </span>
          <span v-if="tagChecking" class="material-symbols-outlined animate-spin text-[18px] text-lime" role="status" aria-label="กำลังตรวจสอบแท็ก">progress_activity</span>
        </label>
      </div>
      <div class="grid grid-cols-3 items-center">
        <div class="flex justify-start">
          <div class="h-14 w-14 overflow-hidden rounded-lg border border-white/45 bg-white/15 shadow-lg" :class="{ 'preview-pop': previewPulse }" role="img" aria-label="ภาพล่าสุด">
            <img v-if="lastPreviewUrl" :src="lastPreviewUrl" alt="" class="h-full w-full object-cover">
            <div v-else class="flex h-full w-full items-center justify-center text-white/70">
              <span class="material-symbols-outlined text-2xl" aria-hidden="true">photo_library</span>
            </div>
          </div>
        </div>
        <div class="flex justify-center">
          <button type="button" class="h-20 w-20 rounded-full border-4 border-white bg-white/20 p-1 disabled:opacity-40" :disabled="starting || !!cameraError || capturing" aria-label="ถ่ายรูปก่อนซัก" @click="capturePhoto">
            <span class="block h-full w-full rounded-full bg-white" />
          </button>
        </div>
        <div />
      </div>
    </div>
  </div>
</template>

<style scoped>
.scan-line {
  animation: scan-line 2s ease-in-out infinite;
}

@keyframes scan-line {
  0%, 100% {
    transform: translateY(calc(2rem - min(30vmin, 8rem)));
  }
  50% {
    transform: translateY(calc(min(30vmin, 8rem) - 2rem));
  }
}

@media (prefers-reduced-motion: reduce) {
  .scan-line {
    animation: none;
    transform: translateY(0);
  }
}

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
