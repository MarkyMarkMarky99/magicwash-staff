<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, ChecksumException, DecodeHintType, FormatException, NotFoundException } from '@zxing/library'
import { mapCoverRoi, percentile95 } from '../utils/benchmark-math'

type Mode = 'zxing-current' | 'zxing-roi' | 'native' | 'wasm'
type Resolution = '720p' | '1080p'
type Detection = { rawValue: string }
type Detector = { detect(source: HTMLCanvasElement): Promise<Detection[]> }
type DetectorConstructor = {
  new (options: { formats: string[] }): Detector
  getSupportedFormats(): Promise<readonly string[]>
}

const modes: { id: Mode; label: string }[] = [
  { id: 'zxing-current', label: 'ZXing full' },
  { id: 'zxing-roi', label: 'ZXing ROI' },
  { id: 'native', label: 'Native' },
  { id: 'wasm', label: 'WASM' },
]
const hints = new Map()
hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128])
const videoRef = ref<HTMLVideoElement | null>(null)
const frameRef = ref<HTMLDivElement | null>(null)
const mode = ref<Mode>('zxing-current')
const resolution = ref<Resolution>('720p')
const fastFocus = ref(false)
const starting = ref(false)
const running = ref(false)
const cameraError = ref('')
const constraintError = ref('')
const decodeError = ref('')
const nativeAvailable = ref(false)
const nativeFormats = ref<string[]>([])
const nativeQueryDone = ref(false)
const userAgent = navigator.userAgent
const settings = ref({ width: '—', height: '—', frameRate: '—', focusMode: '—' })
const continuousFocusSupported = ref(false)
const durations = ref<number[]>([])
const attemptTimes = ref<number[]>([])
const detectionCount = ref(0)
const lastRead = ref<{ value: string; time: string } | null>(null)
const readTimes = ref<number[]>([])
const armedAt = ref<number | null>(null)
const clockNow = ref(0)
const roiCanvas = document.createElement('canvas')
const roiContext = roiCanvas.getContext('2d', { willReadFrequently: true })
let stream: MediaStream | null = null
let controls: IScannerControls | null = null
let pendingFrame: number | null = null
let frameKind: 'video' | 'animation' | null = null
let decoderToken = 0
let cameraToken = 0
let lastValue = ''
let lastValueAt = 0
let clockInterval: number | null = null

const lastDuration = computed(() => durations.value.at(-1) ?? null)
const averageDuration = computed(() => durations.value.length
  ? durations.value.reduce((sum, value) => sum + value, 0) / durations.value.length : null)
const p95Duration = computed(() => percentile95(durations.value))
const attemptsPerSecond = computed(() => attemptTimes.value.filter(time => time > clockNow.value - 1000).length)
const averageReadTime = computed(() => readTimes.value.length
  ? readTimes.value.reduce((sum, value) => sum + value, 0) / readTimes.value.length : null)

function message(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

function retryable(error: unknown): boolean {
  return error instanceof NotFoundException || error instanceof ChecksumException || error instanceof FormatException
}

function recordAttempt(duration: number): void {
  durations.value = [...durations.value.slice(-99), duration]
  const now = performance.now()
  attemptTimes.value = [...attemptTimes.value.filter(time => time > now - 1000), now]
  clockNow.value = now
}

function acceptRead(value: string): void {
  if (!value) return
  const now = performance.now()
  if (value === lastValue && now - lastValueAt < 2000) return
  lastValue = value
  lastValueAt = now
  detectionCount.value++
  lastRead.value = { value, time: new Date().toLocaleTimeString() }
  if (armedAt.value !== null) {
    readTimes.value = [...readTimes.value.slice(-9), now - armedAt.value]
    armedAt.value = null
  }
  navigator.vibrate?.(60)
}

function resetMetrics(): void {
  durations.value = []
  attemptTimes.value = []
  detectionCount.value = 0
  lastRead.value = null
  readTimes.value = []
  armedAt.value = null
  lastValue = ''
  lastValueAt = 0
}

function armReadTimer(): void {
  armedAt.value = performance.now()
}

function updateSettings(): void {
  const track = stream?.getVideoTracks()[0]
  if (!track) return
  const current = track.getSettings() as MediaTrackSettings & { focusMode?: string }
  settings.value = {
    width: current.width?.toString() ?? '—',
    height: current.height?.toString() ?? '—',
    frameRate: current.frameRate?.toFixed(1) ?? '—',
    focusMode: current.focusMode ?? '—',
  }
  try {
    const capabilities = track.getCapabilities() as MediaTrackCapabilities & { focusMode?: string[] }
    continuousFocusSupported.value = capabilities.focusMode?.includes('continuous') ?? false
  } catch (error) {
    continuousFocusSupported.value = false
    constraintError.value = message(error)
  }
}

function stopDecoder(): void {
  decoderToken++
  if (pendingFrame !== null && videoRef.value) {
    if (frameKind === 'video') videoRef.value.cancelVideoFrameCallback(pendingFrame)
    else cancelAnimationFrame(pendingFrame)
  }
  pendingFrame = null
  frameKind = null
  if (controls) {
    void Promise.resolve(controls.stop()).catch(error => { decodeError.value = message(error) })
    controls = null
  }
}

function stopCamera(): void {
  cameraToken++
  stopDecoder()
  stream?.getTracks().forEach(track => track.stop())
  stream = null
  if (videoRef.value) videoRef.value.srcObject = null
  running.value = false
  starting.value = false
}

function drawRoi(): boolean {
  const video = videoRef.value
  const frame = frameRef.value
  if (!video || !frame || !roiContext || !video.videoWidth || !video.videoHeight) return false
  const displayRect = video.getBoundingClientRect()
  const frameRect = frame.getBoundingClientRect()
  const roi = mapCoverRoi(video.videoWidth, video.videoHeight, displayRect, frameRect)
  if (roi.width <= 0 || roi.height <= 0) return false
  const scale = Math.min(1, 480 / Math.max(roi.width, roi.height))
  roiCanvas.width = Math.max(1, Math.round(roi.width * scale))
  roiCanvas.height = Math.max(1, Math.round(roi.height * scale))
  roiContext.drawImage(video, roi.x, roi.y, roi.width, roi.height, 0, 0, roiCanvas.width, roiCanvas.height)
  return true
}

function scheduleFrame(token: number, detect: () => Promise<void>): void {
  const video = videoRef.value
  if (!video || token !== decoderToken) return
  if ('requestVideoFrameCallback' in video) {
    frameKind = 'video'
    pendingFrame = video.requestVideoFrameCallback(() => { void detect() })
  } else {
    frameKind = 'animation'
    pendingFrame = requestAnimationFrame(() => { void detect() })
  }
}

async function startDecoder(): Promise<void> {
  const video = videoRef.value
  if (!stream || !video) return
  const token = ++decoderToken
  decodeError.value = ''
  if (mode.value === 'zxing-current') {
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80, delayBetweenScanSuccess: 250 })
    const originalDecode = reader.decodeFromCanvas.bind(reader)
    reader.decodeFromCanvas = canvas => {
      const start = performance.now()
      try { return originalDecode(canvas) } finally {
        if (token === decoderToken) recordAttempt(performance.now() - start)
      }
    }
    try {
      const nextControls = await reader.decodeFromStream(stream, video, (result, error) => {
        if (token !== decoderToken) return
        if (result) acceptRead(result.getText().trim())
        if (error && !retryable(error)) {
          const detail = message(error)
          stopCamera()
          decodeError.value = detail
        }
      })
      if (token === decoderToken) controls = nextControls
      else void Promise.resolve(nextControls.stop()).catch(() => {})
    } catch (error) {
      if (token === decoderToken) decodeError.value = message(error)
    }
    return
  }

  let decode: () => Promise<string | null>
  if (mode.value === 'zxing-roi') {
    const reader = new BrowserMultiFormatReader(hints)
    decode = async () => {
      try { return reader.decodeFromCanvas(roiCanvas).getText().trim() }
      catch (error) { if (retryable(error)) return null; throw error }
    }
  } else {
    let constructor: DetectorConstructor
    if (mode.value === 'native') {
      const native = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
      if (!native) { decodeError.value = 'Not supported on this device'; return }
      constructor = native
    } else {
      try {
        const module = await import('barcode-detector/ponyfill')
        if (token !== decoderToken) return
        constructor = module.BarcodeDetector as DetectorConstructor
      } catch (error) {
        if (token === decoderToken) decodeError.value = message(error)
        return
      }
    }
    const formats = mode.value === 'native'
      ? ['qr_code', 'code_128'].filter(format => nativeFormats.value.includes(format))
      : ['qr_code', 'code_128']
    if (!formats.length) { decodeError.value = 'QR Code and Code 128 are not supported on this device'; return }
    const detector = new constructor({ formats })
    decode = async () => (await detector.detect(roiCanvas))[0]?.rawValue.trim() ?? null
  }

  const detect = async (): Promise<void> => {
    pendingFrame = null
    if (token !== decoderToken) return
    if (drawRoi()) {
      const start = performance.now()
      try {
        const value = await decode()
        if (token === decoderToken) {
          recordAttempt(performance.now() - start)
          if (value) acceptRead(value)
        }
      } catch (error) {
        if (token === decoderToken) {
          recordAttempt(performance.now() - start)
          decodeError.value = message(error)
        }
      }
    }
    scheduleFrame(token, detect)
  }
  scheduleFrame(token, detect)
}

async function startCamera(): Promise<void> {
  if (starting.value || stream) return
  const token = ++cameraToken
  cameraError.value = ''
  constraintError.value = ''
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value = 'Camera requires HTTPS or localhost and a supported browser'
    return
  }
  starting.value = true
  try {
    const height = resolution.value === '720p' ? 720 : 1080
    const nextStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: height * 16 / 9 },
        height: { ideal: height },
        ...(fastFocus.value ? { frameRate: { ideal: 60 } } : {}),
      },
    })
    if (token !== cameraToken) { nextStream.getTracks().forEach(track => track.stop()); return }
    stream = nextStream
    await nextTick()
    const video = videoRef.value
    if (!video || token !== cameraToken) {
      if (token === cameraToken) stopCamera()
      return
    }
    video.srcObject = nextStream
    await video.play()
    if (token !== cameraToken) return
    updateSettings()
    if (fastFocus.value && continuousFocusSupported.value) {
      try {
        await nextStream.getVideoTracks()[0]!.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
      } catch (error) {
        constraintError.value = message(error)
      }
      if (token !== cameraToken) return
      updateSettings()
    }
    running.value = true
    await nextTick()
    if (token !== cameraToken) return
    await startDecoder()
  } catch (error) {
    if (token === cameraToken) { stopCamera(); cameraError.value = message(error) }
  } finally {
    if (token === cameraToken) starting.value = false
  }
}

async function changeMode(nextMode: Mode): Promise<void> {
  if (mode.value === nextMode || (nextMode === 'native' && !nativeAvailable.value)) return
  const previous = mode.value
  stopDecoder()
  mode.value = nextMode
  resetMetrics()
  if (!stream) return
  if (previous === 'zxing-current') {
    stopCamera()
    await startCamera()
  } else {
    await startDecoder()
  }
}

async function restartCamera(): Promise<void> {
  if (!stream && !starting.value) return
  stopCamera()
  await startCamera()
}

onMounted(async () => {
  clockInterval = window.setInterval(() => { clockNow.value = performance.now() }, 250)
  const native = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector
  nativeAvailable.value = Boolean(native)
  if (native) {
    try { nativeFormats.value = [...await native.getSupportedFormats()] }
    catch (error) { decodeError.value = message(error) }
  }
  nativeQueryDone.value = true
})

onBeforeUnmount(() => {
  stopCamera()
  if (clockInterval !== null) window.clearInterval(clockInterval)
})
</script>

<template>
  <main class="min-h-screen bg-surface px-4 py-5 font-body text-on-surface">
    <div class="mx-auto flex max-w-2xl flex-col gap-4">
      <header>
        <p class="font-label text-xs font-bold uppercase tracking-widest text-secondary">Camera benchmark</p>
        <h1 class="font-headline text-2xl font-bold">QR scan benchmark</h1>
        <dl class="mt-2 break-words text-xs text-on-surface-variant">
          <div><dt class="inline font-bold">User agent: </dt><dd class="inline">{{ userAgent }}</dd></div>
          <div><dt class="inline font-bold">BarcodeDetector: </dt><dd class="inline">{{ nativeAvailable ? 'Yes' : 'No' }}</dd></div>
          <div><dt class="inline font-bold">Supported formats: </dt><dd class="inline">{{ nativeQueryDone ? (nativeFormats.join(', ') || 'None') : 'Checking…' }}</dd></div>
        </dl>
      </header>

      <section class="overflow-hidden rounded-xl bg-primary text-white">
        <div class="relative h-[min(70vh,28rem)] min-h-64">
          <video ref="videoRef" class="absolute inset-0 h-full w-full object-cover" autoplay muted playsinline />
          <div v-if="running" class="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div ref="frameRef" class="relative aspect-square w-[min(60vmin,16rem)]">
              <span class="absolute left-0 top-0 h-7 w-7 border-l-4 border-t-4 border-lime" />
              <span class="absolute right-0 top-0 h-7 w-7 border-r-4 border-t-4 border-lime" />
              <span class="absolute bottom-0 left-0 h-7 w-7 border-b-4 border-l-4 border-lime" />
              <span class="absolute bottom-0 right-0 h-7 w-7 border-b-4 border-r-4 border-lime" />
            </div>
          </div>
          <div v-if="!running" class="absolute inset-0 flex items-center justify-center bg-primary/80 text-sm">
            {{ starting ? 'Opening camera…' : 'Camera stopped' }}
          </div>
        </div>
        <div class="flex flex-wrap gap-2 p-3">
          <button type="button" class="min-h-11 rounded-full bg-lime px-5 font-semibold text-primary disabled:opacity-50" :disabled="starting" @click="running ? stopCamera() : startCamera()">
            {{ running ? 'Stop camera' : starting ? 'Opening…' : 'Open camera' }}
          </button>
          <button type="button" class="min-h-11 rounded-full border border-white/50 px-5 disabled:opacity-50" :disabled="!running" @click="armReadTimer">Start time-to-read</button>
          <span v-if="armedAt !== null" class="self-center text-xs text-lime">Armed</span>
        </div>
      </section>

      <section class="rounded-xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant/50">
        <h2 class="font-headline font-bold">Capture settings</h2>
        <div class="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <label>Resolution
            <select v-model="resolution" class="ml-1 rounded-lg border border-outline-variant bg-surface px-2 py-2" @change="restartCamera">
              <option value="720p">720p</option><option value="1080p">1080p</option>
            </select>
          </label>
          <label class="flex items-center gap-2"><input v-model="fastFocus" type="checkbox" class="accent-lime" @change="restartCamera">60 fps + continuous focus</label>
        </div>
        <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>Width: {{ settings.width }}</div><div>Height: {{ settings.height }}</div>
          <div>Frame rate: {{ settings.frameRate }}</div><div>Focus mode: {{ settings.focusMode }}</div>
          <div class="col-span-2">Continuous focus supported: {{ continuousFocusSupported ? 'Yes' : 'No' }}</div>
        </dl>
      </section>

      <section class="rounded-xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant/50">
        <h2 class="font-headline font-bold">Decoder</h2>
        <div class="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-surface-container p-1 sm:grid-cols-4" role="group" aria-label="Decoder mode">
          <button v-for="item in modes" :key="item.id" type="button" class="min-h-11 rounded-lg px-2 text-sm font-semibold disabled:opacity-40" :class="mode === item.id ? 'bg-lime text-primary' : 'text-on-surface'" :aria-pressed="mode === item.id" :disabled="item.id === 'native' && (!nativeAvailable || !nativeQueryDone)" @click="changeMode(item.id)">{{ item.label }}</button>
        </div>
        <p v-if="!nativeAvailable" class="mt-2 text-sm text-on-surface-variant">Native: Not supported on this device</p>
        <p v-if="mode === 'wasm'" class="mt-2 text-xs text-on-surface-variant">WASM loads from the package default jsDelivr CDN.</p>
      </section>

      <p v-for="error in [cameraError, constraintError, decodeError].filter(Boolean)" :key="error" role="alert" class="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{{ error }}</p>

      <section class="rounded-xl bg-surface-container-lowest p-4 ring-1 ring-outline-variant/50">
        <h2 class="font-headline font-bold">Active mode metrics</h2>
        <dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div><dt class="text-on-surface-variant">Last decode</dt><dd>{{ lastDuration?.toFixed(1) ?? '—' }} ms</dd></div>
          <div><dt class="text-on-surface-variant">Average (last 100)</dt><dd>{{ averageDuration?.toFixed(1) ?? '—' }} ms</dd></div>
          <div><dt class="text-on-surface-variant">P95 (last 100)</dt><dd>{{ p95Duration?.toFixed(1) ?? '—' }} ms</dd></div>
          <div><dt class="text-on-surface-variant">Attempts / second</dt><dd>{{ attemptsPerSecond }}</dd></div>
          <div><dt class="text-on-surface-variant">Detections</dt><dd>{{ detectionCount }}</dd></div>
        </dl>
        <div class="mt-4 border-t border-outline-variant/50 pt-3 text-sm">
          <p class="text-on-surface-variant">Last decoded value</p>
          <p class="break-all font-semibold">{{ lastRead?.value ?? '—' }}</p>
          <p class="text-xs text-on-surface-variant">{{ lastRead?.time ?? '—' }}</p>
        </div>
        <div class="mt-4 border-t border-outline-variant/50 pt-3 text-sm">
          <h3 class="font-bold">Time to read</h3>
          <p>Last 10 average: {{ averageReadTime?.toFixed(0) ?? '—' }} ms</p>
          <ol class="mt-1 flex flex-wrap gap-2"><li v-for="(time, index) in readTimes" :key="index" class="rounded-full bg-secondary-container px-2 py-1 text-xs text-on-secondary-container">{{ time.toFixed(0) }} ms</li></ol>
        </div>
      </section>
    </div>
  </main>
</template>
