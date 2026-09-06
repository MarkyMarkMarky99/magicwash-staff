<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import { useDocumentDetect } from '@/features/orders/composables/use-document-detect'
import {
  initialQuadForStill,
  useCornerEditor,
  warpOutputSize,
} from '@/features/orders/composables/use-corner-editor'
import { useHoldStillCapture } from '@/features/orders/composables/use-hold-still-capture'
import { enhanceDocument } from '@/features/orders/utils/document-enhance'
import type { DocumentFilterMode } from '@/features/orders/utils/document-enhance'
import { contentBox, fitScale, projectQuad } from '@/features/orders/utils/quad-projection'
import type { Point, Quad } from '@/features/orders/utils/quad-projection'

// ---- constants -------------------------------------------------------------

const DOCUMENT_MAX_DIMENSION = 2400
const DOCUMENT_JPEG_QUALITY = 0.88
const WARP_TIMEOUT_MS = 12000
const REFOCUS_CONTINUOUS_DELAY_MS = 500
const HOLD_RING_RADIUS = 43
const HOLD_RING_CIRCUMFERENCE = 2 * Math.PI * HOLD_RING_RADIUS
const LOUPE_SIZE = 110
const LOUPE_ZOOM = 2

type ScannerStage = 'viewfinder' | 'capturing' | 'adjusting' | 'warping'

type CapturedStill = {
  source: HTMLCanvasElement,
  width: number,
  height: number,
  initialQuad: Quad,
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [], capture: [file: File] }>()

// ---- refs --------------------------------------------------------------

const videoRef = ref<HTMLVideoElement | null>(null)
const outlineCanvasRef = ref<HTMLCanvasElement | null>(null)
const adjustSurfaceRef = ref<HTMLDivElement | null>(null)
const adjustCanvasRef = ref<HTMLCanvasElement | null>(null)
const loupeCanvasRef = ref<HTMLCanvasElement | null>(null)

// ---- the one state machine -------------------------------------------------
// viewfinder -> capturing -> adjusting -> warping -> viewfinder, with two failure
// edges (capturing -> viewfinder, warping -> adjusting) and one exit (close, from
// any state). See teardownScanner() and the camera-restore invariant below.
const scannerStage = ref<ScannerStage>('viewfinder')

const stream = ref<MediaStream | null>(null)
const isStarting = ref(false)
const cameraError = ref('')
const errorMessage = ref('')
const flashActive = ref(false)
const videoPlaying = ref(false)
const autoCaptureEnabled = ref(true)
const capturedStill = ref<CapturedStill | null>(null)
const adjustDisplayBox = ref({ width: 0, height: 0 })
const videoDimensions = ref({ width: 0, height: 0 })

const isWarping = computed(() => scannerStage.value === 'warping')
const showAdjustUi = computed(() => scannerStage.value === 'adjusting' || scannerStage.value === 'warping')
const canCapture = computed(() => props.open && scannerStage.value === 'viewfinder')
const detectionActive = computed(() => props.open && scannerStage.value === 'viewfinder' && videoPlaying.value)

const { quad } = useDocumentDetect(
  () => videoRef.value,
  detectionActive,
)

const emptyQuad: Quad = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]
const editorImageDimensions = computed(() => (
  capturedStill.value ? { width: capturedStill.value.width, height: capturedStill.value.height } : { width: 0, height: 0 }
))
const editorInitialQuad = computed(() => capturedStill.value?.initialQuad ?? emptyQuad)
const cornerEditor = useCornerEditor(editorImageDimensions, editorInitialQuad, adjustDisplayBox)

const loupeStyle = computed(() => {
  const { width, height } = adjustDisplayBox.value
  const pointer = cornerEditor.pointerPosition.value
  const left = pointer.x + LOUPE_SIZE + 18 > width ? pointer.x - LOUPE_SIZE - 18 : pointer.x + 18
  const top = pointer.y + LOUPE_SIZE + 18 > height ? pointer.y - LOUPE_SIZE - 18 : pointer.y + 18
  return {
    left: `${Math.max(0, Math.min(left, width - LOUPE_SIZE))}px`,
    top: `${Math.max(0, Math.min(top, height - LOUPE_SIZE))}px`,
  }
})

const {
  progress: holdProgress,
  reset: resetHoldStill,
} = useHoldStillCapture(quad, detectionActive, autoCaptureEnabled, videoDimensions, autoCapturePhoto)

const holdRingDashoffset = computed(() => HOLD_RING_CIRCUMFERENCE * (1 - holdProgress.value))
const holdRingTransition = computed(() => (holdProgress.value === 0 ? 'none' : 'stroke-dashoffset 100ms linear'))

// ---- non-reactive bookkeeping -----------------------------------------

let cameraStartToken = 0
let flashTimer: ReturnType<typeof window.setTimeout> | null = null
let refocusTimer: ReturnType<typeof window.setTimeout> | null = null
let outlineFrame: number | null = null
let outlineResizeObserver: ResizeObserver | null = null
let adjustResizeObserver: ResizeObserver | null = null
let outlineDimensions = { width: 0, height: 0, dpr: 1 }
let disposed = false

// ---- helpers ------------------------------------------------------------

function errorName(error: unknown): string {
  return error instanceof Error && error.name ? error.name : 'UnknownError'
}

function errorDetails(error: unknown): string {
  const name = errorName(error)
  const message = error instanceof Error && error.message ? error.message : String(error)
  return message && message !== name ? `${name}: ${message}` : name
}

function withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new DOMException(name, 'TimeoutError')), ms)
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value) },
      (error) => { window.clearTimeout(timer); reject(error) },
    )
  })
}

function canvasToBlobPromise(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Unable to create image'))
    }, 'image/jpeg', quality)
  })
}

function toScanicCorners(quadPoints: Quad) {
  return { topLeft: quadPoints[0], topRight: quadPoints[1], bottomRight: quadPoints[2], bottomLeft: quadPoints[3] }
}

function applyDocumentFilter(canvas: HTMLCanvasElement, mode: DocumentFilterMode): void {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('CanvasContextUnavailable')
  const source = context.getImageData(0, 0, canvas.width, canvas.height)
  const enhanced = enhanceDocument(source, mode)
  const output = context.createImageData(enhanced.width, enhanced.height)
  output.data.set(enhanced.data)
  context.putImageData(output, 0, 0)
}

function supportedModes(capabilities: MediaTrackCapabilities, name: 'focusMode' | 'exposureMode' | 'whiteBalanceMode'): string[] {
  const values = (capabilities as Record<string, unknown>)[name]
  return Array.isArray(values) ? values as string[] : []
}

async function applyAdvancedConstraints(track: MediaStreamTrack, constraints: Record<string, unknown>, label: string): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [constraints] } as MediaTrackConstraints)
    return true
  } catch (error) {
    return false
  }
}

async function configureCameraTrack(track: MediaStreamTrack): Promise<void> {
  if (typeof track.getCapabilities !== 'function') {
    return
  }

  let capabilities: MediaTrackCapabilities
  try {
    capabilities = track.getCapabilities()
  } catch (error) {
    return
  }

  const focusModes = supportedModes(capabilities, 'focusMode')
  const exposureModes = supportedModes(capabilities, 'exposureMode')
  const whiteBalanceModes = supportedModes(capabilities, 'whiteBalanceMode')
  const constraints: Record<string, unknown> = {}
  if (focusModes.includes('continuous')) constraints.focusMode = 'continuous'
  if (exposureModes.includes('continuous')) constraints.exposureMode = 'continuous'
  if (whiteBalanceModes.includes('continuous')) constraints.whiteBalanceMode = 'continuous'

  if (Object.keys(constraints).length === 0) {
    return
  }
  await applyAdvancedConstraints(track, constraints, 'focus continuous')
}

async function refocusCamera(): Promise<void> {
  const track = stream.value?.getVideoTracks()[0]
  if (!track || typeof track.getCapabilities !== 'function') return

  let focusModes: string[] = []
  try {
    focusModes = supportedModes(track.getCapabilities(), 'focusMode')
  } catch (error) {
    return
  }

  window.clearTimeout(refocusTimer ?? undefined)
  refocusTimer = null
  if (focusModes.includes('single-shot')) {
    const applied = await applyAdvancedConstraints(track, { focusMode: 'single-shot' }, 'focus single-shot')
    if (applied && focusModes.includes('continuous')) {
      refocusTimer = window.setTimeout(() => {
        if (track.readyState === 'live') void applyAdvancedConstraints(track, { focusMode: 'continuous' }, 'focus continuous')
      }, REFOCUS_CONTINUOUS_DELAY_MS)
    }
    return
  }
  if (focusModes.includes('continuous')) {
    await applyAdvancedConstraints(track, { focusMode: 'continuous' }, 'focus continuous reapplied')
  }
}

// ---- viewfinder outline drawing (rendering loop, not the detection loop) --

function updateVideoDimensions(): void {
  const video = videoRef.value
  if (!video?.videoWidth || !video.videoHeight) {
    videoDimensions.value = { width: 0, height: 0 }
    return
  }
  videoDimensions.value = { width: video.videoWidth, height: video.videoHeight }
}

function resizeOutline(): void {
  const video = videoRef.value
  const canvas = outlineCanvasRef.value
  if (!video || !canvas) return

  const width = video.clientWidth
  const height = video.clientHeight
  const dpr = window.devicePixelRatio || 1
  outlineDimensions = { width, height, dpr }
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
}

function drawOutline(): void {
  outlineFrame = window.requestAnimationFrame(drawOutline)

  const video = videoRef.value
  const canvas = outlineCanvasRef.value
  const context = canvas?.getContext('2d')
  if (!video || !context) return

  const { width, height, dpr } = outlineDimensions
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, width, height)
  // Draw nothing when no quad is found — an always-present outline would teach
  // the user nothing about whether detection actually works.
  if (!quad.value || !video.videoWidth || !video.videoHeight) return

  const box = contentBox(video.videoWidth, video.videoHeight, width, height)
  const projected = projectQuad(quad.value, box)
  context.beginPath()
  context.moveTo(projected[0].x, projected[0].y)
  for (const point of projected.slice(1)) context.lineTo(point.x, point.y)
  context.closePath()
  context.fillStyle = 'rgba(157, 245, 223, 0.15)'
  context.fill()
  context.strokeStyle = '#b2df26'
  context.lineWidth = 2.5
  context.stroke()

  context.fillStyle = '#9df5df'
  for (const point of projected) {
    context.beginPath()
    context.arc(point.x, point.y, 4, 0, Math.PI * 2)
    context.fill()
  }
}

function startOutline(): void {
  if (outlineFrame !== null) return
  resizeOutline()
  outlineResizeObserver = new ResizeObserver(resizeOutline)
  if (videoRef.value) outlineResizeObserver.observe(videoRef.value)
  window.addEventListener('orientationchange', resizeOutline)
  outlineFrame = window.requestAnimationFrame(drawOutline)
}

function stopOutline(): void {
  if (outlineFrame !== null) window.cancelAnimationFrame(outlineFrame)
  outlineFrame = null
  outlineResizeObserver?.disconnect()
  outlineResizeObserver = null
  window.removeEventListener('orientationchange', resizeOutline)
}

function handleVideoPlaying(): void {
  videoPlaying.value = true
  startOutline()
}

function handleVideoPause(): void {
  videoPlaying.value = false
  stopOutline()
}

function handleVideoMetadata(): void {
  updateVideoDimensions()
  resizeOutline()
}

// ---- camera lifecycle -----------------------------------------------------

function stopCameraStream(): void {
  cameraStartToken += 1
  window.clearTimeout(refocusTimer ?? undefined)
  refocusTimer = null
  videoPlaying.value = false
  stopOutline()
  if (videoRef.value) videoRef.value.srcObject = null
  stream.value?.getTracks().forEach((track) => track.stop())
  stream.value = null
  isStarting.value = false
  flashActive.value = false
  videoDimensions.value = { width: 0, height: 0 }
}

async function startCamera(): Promise<void> {
  if (!props.open || scannerStage.value !== 'viewfinder' || stream.value || isStarting.value) return

  const startToken = ++cameraStartToken
  cameraError.value = ''

  if (!navigator.mediaDevices?.getUserMedia) {
    cameraError.value = 'กล้องใช้ได้เมื่อเปิดผ่าน HTTPS หรือ localhost'
    return
  }

  isStarting.value = true

  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 3840 },
        height: { ideal: 2160 },
      },
      audio: false,
    })

    if (!props.open || disposed || startToken !== cameraStartToken) {
      mediaStream.getTracks().forEach((track) => track.stop())
      return
    }

    stream.value = mediaStream
    const videoTrack = mediaStream.getVideoTracks()[0]
    if (videoTrack) await configureCameraTrack(videoTrack)
    await nextTick()

    if (!props.open || disposed || startToken !== cameraStartToken) {
      mediaStream.getTracks().forEach((track) => track.stop())
      if (stream.value === mediaStream) stream.value = null
      return
    }

    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream
      await videoRef.value.play()
      updateVideoDimensions()
      videoPlaying.value = true
      startOutline()
    }
  } catch (error) {
    if (!props.open || disposed || startToken !== cameraStartToken) return
    cameraError.value = errorName(error) === 'NotAllowedError'
      ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง'
      : 'เปิดกล้องไม่สำเร็จ'
  } finally {
    isStarting.value = false
  }
}

// The invariant effect below is the only thing that restarts the camera. It
// covers every path back to 'viewfinder', including ones not foreseen here.
// Guarded by cameraError so a failing getUserMedia cannot loop — the retry
// button only clears cameraError and lets this fire again.
function retryCamera(): void {
  cameraError.value = ''
}

watchEffect(() => {
  if (props.open && scannerStage.value === 'viewfinder' && !stream.value && !isStarting.value && !cameraError.value) {
    void startCamera()
  }
})

// ---- still retention, corner editor, filter preview ------------------------

function releaseCapturedStill(): void {
  const still = capturedStill.value
  if (!still) return
  still.source.width = 0
  still.source.height = 0
  capturedStill.value = null
}

function showShutterFlash(): void {
  window.clearTimeout(flashTimer ?? undefined)
  flashActive.value = true
  flashTimer = window.setTimeout(() => {
    flashActive.value = false
    flashTimer = null
  }, 140)
}

// The magnifier samples `still.source` (the captured canvas) directly with
// drawImage, so its source rectangle is in image-pixel space — the same
// space as cornerEditor.points (see initialQuadForStill, which maps the
// detected quad into still-pixel coordinates once at capture time). The
// active corner therefore sits at the exact centre of the sampled square by
// construction (point.x/y is the centre of the source rect above).
// box.scale (from contentBox) is display-px-per-image-px for the adjust
// surface; multiplying by LOUPE_ZOOM gives image-px-to-loupe-px, which is
// what drawLoupeCropOverlay uses to place the neighbouring corners.
function drawLoupeCropOverlay(
  context: CanvasRenderingContext2D,
  imageToLoupeScale: number,
  point: Point,
  activeCorner: number,
): void {
  const points = cornerEditor.points.value
  const center = LOUPE_SIZE / 2
  const toLoupeSpace = (imagePoint: Point): Point => ({
    x: center + (imagePoint.x - point.x) * imageToLoupeScale,
    y: center + (imagePoint.y - point.y) * imageToLoupeScale,
  })
  const extendToEdge = (target: Point): Point => {
    const dx = target.x - center
    const dy = target.y - center
    const length = Math.hypot(dx, dy)
    if (length < 1e-6) return { x: center, y: center }
    const factor = LOUPE_SIZE / length
    return { x: center + dx * factor, y: center + dy * factor }
  }

  const previousCorner = extendToEdge(toLoupeSpace(points[(activeCorner + 3) % 4]))
  const nextCorner = extendToEdge(toLoupeSpace(points[(activeCorner + 1) % 4]))

  // Kept deliberately thin: this line exists to be aligned against the paper
  // edge, and a thick one hides the very pixels the user is aiming at.
  context.strokeStyle = '#b2df26'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(previousCorner.x, previousCorner.y)
  context.lineTo(center, center)
  context.lineTo(nextCorner.x, nextCorner.y)
  context.stroke()

  // Crosshair, not a filled dot: the gap at the centre leaves the exact point
  // the handle resolves to visible instead of covering it.
  const gap = 4
  const arm = 12
  const strokeCrosshair = (color: string, width: number): void => {
    context.strokeStyle = color
    context.lineWidth = width
    context.beginPath()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      context.moveTo(center + dx * gap, center + dy * gap)
      context.lineTo(center + dx * arm, center + dy * arm)
    }
    context.stroke()
  }
  // Dark pass first so the crosshair stays legible on pale paper too.
  strokeCrosshair('rgba(35, 79, 73, 0.85)', 3.5)
  strokeCrosshair('#9df5df', 1.5)
}

function drawLoupe(): void {
  const still = capturedStill.value
  const loupe = loupeCanvasRef.value
  const activeCorner = cornerEditor.activeCorner.value
  if (!still || !loupe || activeCorner === null) return

  const dpr = window.devicePixelRatio || 1
  loupe.width = LOUPE_SIZE * dpr
  loupe.height = LOUPE_SIZE * dpr
  const context = loupe.getContext('2d')
  if (!context) return

  const box = contentBox(still.width, still.height, adjustDisplayBox.value.width, adjustDisplayBox.value.height)
  if (!box.scale) return
  const sourceSize = LOUPE_SIZE / LOUPE_ZOOM / box.scale
  const point = cornerEditor.points.value[activeCorner]
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE)
  context.save()
  context.beginPath()
  context.arc(LOUPE_SIZE / 2, LOUPE_SIZE / 2, LOUPE_SIZE / 2 - 2, 0, Math.PI * 2)
  context.clip()
  context.drawImage(
    still.source,
    point.x - sourceSize / 2, point.y - sourceSize / 2, sourceSize, sourceSize,
    0, 0, LOUPE_SIZE, LOUPE_SIZE,
  )
  drawLoupeCropOverlay(context, LOUPE_ZOOM * box.scale, point, activeCorner)
  context.restore()
}

function drawAdjustPreview(): void {
  const still = capturedStill.value
  const canvas = adjustCanvasRef.value
  if (!still || !canvas) return

  const context = canvas.getContext('2d')
  if (!context) return
  const { width, height } = adjustDisplayBox.value
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.fillStyle = '#000'
  context.fillRect(0, 0, width, height)
  const box = contentBox(still.width, still.height, width, height)
  context.drawImage(still.source, box.offsetX, box.offsetY, still.width * box.scale, still.height * box.scale)
  drawLoupe()
}

function resizeAdjustSurface(): void {
  const surface = adjustSurfaceRef.value
  if (!surface) return
  const rectangle = surface.getBoundingClientRect()
  adjustDisplayBox.value = { width: rectangle.width, height: rectangle.height }
  drawAdjustPreview()
}

function startAdjustSurface(): void {
  if (adjustResizeObserver) return
  resizeAdjustSurface()
  adjustResizeObserver = new ResizeObserver(resizeAdjustSurface)
  if (adjustSurfaceRef.value) adjustResizeObserver.observe(adjustSurfaceRef.value)
}

function stopAdjustSurface(): void {
  adjustResizeObserver?.disconnect()
  adjustResizeObserver = null
}

// ---- capture: viewfinder -> capturing -> adjusting -------------------------
// Every step here is synchronous canvas drawing wrapped in try/catch — there
// is no await on this path, so nothing between the shutter and 'adjusting'
// can hang. See the report for the full trace.
function capturePhoto(): void {
  if (!canCapture.value) return
  const video = videoRef.value
  if (!video || !video.videoWidth || !video.videoHeight) {
    errorMessage.value = 'กล้องยังไม่พร้อม'
    return
  }

  const capturedVideoDimensions = { width: video.videoWidth, height: video.videoHeight }
  const detectedQuadAtCapture = quad.value ? (quad.value.map((point) => ({ ...point })) as Quad) : null

  // viewfinder -> capturing: disable the shutter (canCapture depends on the
  // stage), keep the stream running.
  scannerStage.value = 'capturing'
  showShutterFlash()

  try {
    const scale = fitScale(video.videoWidth, video.videoHeight, DOCUMENT_MAX_DIMENSION)
    const stillWidth = Math.max(1, Math.round(video.videoWidth * scale))
    const stillHeight = Math.max(1, Math.round(video.videoHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = stillWidth
    canvas.height = stillHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('CanvasContextUnavailable')
    context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, stillWidth, stillHeight)

    const stillDimensions = { width: stillWidth, height: stillHeight }
    const initial = initialQuadForStill(detectedQuadAtCapture, capturedVideoDimensions, stillDimensions)

    releaseCapturedStill()
    capturedStill.value = { source: canvas, width: stillWidth, height: stillHeight, initialQuad: initial.quad }
    errorMessage.value = ''

    // capturing -> adjusting: the still is retained, so the camera and the
    // detection loop (which stops automatically as detectionActive becomes
    // false) can both be stopped now.
    stopCameraStream()
    scannerStage.value = 'adjusting'
  } catch (error) {
    // capturing -> viewfinder (any failure): the stream was never stopped on
    // this path (stopCameraStream() above only runs after success), so it is
    // still live; re-enable the shutter, reset hold-still progress, and show
    // the reason.
    releaseCapturedStill()
    resetHoldStill()
    scannerStage.value = 'viewfinder'
    errorMessage.value = `ถ่ายภาพไม่สำเร็จ · ${errorDetails(error)}`
  }
}

function autoCapturePhoto(): void {
  if (!canCapture.value) return
  navigator.vibrate?.(30)
  capturePhoto()
}

// ---- warp: adjusting -> warping -> viewfinder / adjusting ------------------

async function createWarpedDocumentFile(still: CapturedStill, corners: Quad): Promise<File> {
  const { extractDocument } = await import('scanic')
  const result = await extractDocument(still.source, toScanicCorners(corners), { output: 'canvas' })
  if (!result.success || !(result.output instanceof HTMLCanvasElement)) throw new Error('PerspectiveWarpFailed')

  const dimensions = warpOutputSize(corners, DOCUMENT_MAX_DIMENSION)
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = dimensions.width
  outputCanvas.height = dimensions.height
  const outputContext = outputCanvas.getContext('2d')
  if (!outputContext) throw new Error('CanvasContextUnavailable')
  outputContext.drawImage(result.output, 0, 0, dimensions.width, dimensions.height)
  result.output.width = 0
  result.output.height = 0
  // The filter picker is gone; the document enhancement stays hard-coded as
  // the (former) default so output is unchanged for everyone.
  applyDocumentFilter(outputCanvas, 'enhance')

  const blob = await canvasToBlobPromise(outputCanvas, DOCUMENT_JPEG_QUALITY)
  outputCanvas.width = 0
  outputCanvas.height = 0
  return new File([blob], `document_${Date.now()}.jpg`, { type: 'image/jpeg' })
}

async function useAdjustedDocument(): Promise<void> {
  const still = capturedStill.value
  if (!still || scannerStage.value !== 'adjusting') return

  // adjusting -> warping: disable the buttons (isWarping gates them).
  scannerStage.value = 'warping'
  errorMessage.value = ''

  try {
    const file = await withTimeout(
      createWarpedDocumentFile(still, cornerEditor.points.value),
      WARP_TIMEOUT_MS,
      'WarpTimeout',
    )
    // warping -> viewfinder (success): emit, release the still, restart the
    // camera and detection (via the invariant effect above).
    emit('capture', file)
    releaseCapturedStill()
    scannerStage.value = 'viewfinder'
  } catch (error) {
    // warping -> adjusting (any failure): keep the still and the corners —
    // losing a document to a warp error is the worst outcome available.
    errorMessage.value = `ปรับเอกสารไม่สำเร็จ · ${errorDetails(error)}`
    scannerStage.value = 'adjusting'
  }
}

function retakeDocument(): void {
  if (scannerStage.value === 'warping') return
  // adjusting -> viewfinder: release the still; the camera/detection restart
  // via the invariant effect once the stage flips.
  releaseCapturedStill()
  errorMessage.value = ''
  scannerStage.value = 'viewfinder'
}

// ---- close / teardown -------------------------------------------------

// Single teardown: cancels timers and run tokens, stops the detection loop
// (a side effect of the stage/stream reset below flipping detectionActive to
// false), releases the still, stops and drops every media track, resets the
// stage, clears errors. Called from the close button, props.open going
// false, and unmount — nowhere else duplicates any piece of this.
function teardownScanner(): void {
  stopAdjustSurface()
  releaseCapturedStill()
  stopCameraStream()
  resetHoldStill()
  scannerStage.value = 'viewfinder'
  cameraError.value = ''
  errorMessage.value = ''
}

function closeScanner(): void {
  teardownScanner()
  emit('close')
}

// ---- watchers -----------------------------------------------------------

watch(showAdjustUi, async (visible) => {
  if (!visible) {
    stopAdjustSurface()
    return
  }
  await nextTick()
  startAdjustSurface()
})

watch(cornerEditor.points, () => {
  drawAdjustPreview()
})

watch(cornerEditor.activeCorner, async () => {
  await nextTick()
  drawLoupe()
})

// This component never navigates and never mirrors route state into a local
// ref — teardown runs whenever the page (which owns `open`) sets it false,
// covering deep links, tab switches, and the page's own KeepAlive re-entry.
watch(() => props.open, (open) => {
  if (!open) teardownScanner()
})

onBeforeUnmount(() => {
  disposed = true
  teardownScanner()
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[60] bg-black text-white">
    <video
      ref="videoRef"
      class="absolute inset-0 h-full w-full bg-black object-contain"
      autoplay
      muted
      playsinline
      @loadedmetadata="handleVideoMetadata"
      @playing="handleVideoPlaying"
      @pause="handleVideoPause"
      @click="refocusCamera"
    />

    <canvas
      v-if="!showAdjustUi"
      ref="outlineCanvasRef"
      class="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />

    <div
      class="pointer-events-none absolute inset-0 bg-white transition-opacity duration-150"
      :class="flashActive ? 'opacity-75' : 'opacity-0'"
    />

    <!-- adjust / warp stage -->
    <div v-if="showAdjustUi" class="absolute inset-0 z-10 flex flex-col bg-black px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="font-label text-[10px] font-bold uppercase tracking-[0.16em] text-mint">ปรับมุมเอกสาร</p>
        </div>
        <button
          class="h-11 w-11 shrink-0 rounded-full bg-white/15 flex items-center justify-center active:opacity-80"
          aria-label="ปิด"
          :disabled="isWarping"
          @click="closeScanner"
        >
          <span class="material-symbols-outlined text-2xl">close</span>
        </button>
      </div>

      <!-- flex-1 + min-h-0: the surface takes every pixel the header, error line
           and buttons do not. It used to be pinned to min(48vh,440px) to leave
           room for the filter preview strip that no longer exists. -->
      <div ref="adjustSurfaceRef" class="relative mx-auto my-3 min-h-0 w-full max-w-xl flex-1 touch-none">
        <canvas
          ref="adjustCanvasRef"
          class="absolute inset-0 h-full w-full touch-none"
          style="touch-action: none;"
          @pointerdown="cornerEditor.onPointerDown"
          @pointermove="cornerEditor.onPointerMove"
          @pointerup="cornerEditor.onPointerUp"
          @pointercancel="cornerEditor.onPointerCancel"
        />
        <svg
          class="pointer-events-none absolute inset-0 h-full w-full"
          :viewBox="`0 0 ${adjustDisplayBox.width} ${adjustDisplayBox.height}`"
          aria-hidden="true"
        >
          <polygon
            :points="cornerEditor.projectedPoints.value.map((point) => `${point.x},${point.y}`).join(' ')"
            fill="rgba(157, 245, 223, 0.14)"
            stroke="#b2df26"
            stroke-width="2.5"
          />
          <circle
            v-for="(point, index) in cornerEditor.projectedPoints.value"
            :key="index"
            :cx="point.x"
            :cy="point.y"
            r="8"
            fill="#9df5df"
            stroke="#234f49"
            stroke-width="2"
          />
        </svg>
        <canvas
          v-if="cornerEditor.activeCorner.value !== null"
          ref="loupeCanvasRef"
          class="pointer-events-none absolute rounded-full border-2 border-lime shadow-lg"
          :style="loupeStyle"
          :width="LOUPE_SIZE"
          :height="LOUPE_SIZE"
          aria-hidden="true"
        />
      </div>

      <p v-if="errorMessage" class="mb-2 text-center font-body text-sm text-mint">{{ errorMessage }}</p>
      <div class="flex shrink-0 gap-3">
        <button
          class="flex-1 rounded-full border border-white/35 px-4 py-3 font-body text-sm font-medium text-white active:opacity-80 disabled:opacity-50"
          :disabled="isWarping"
          @click="retakeDocument"
        >
          ถ่ายใหม่
        </button>
        <button
          class="flex-1 rounded-full bg-lime px-4 py-3 font-body text-sm font-semibold text-primary active:opacity-80 disabled:opacity-50"
          :disabled="isWarping"
          @click="useAdjustedDocument"
        >
          {{ isWarping ? 'กำลังปรับ…' : 'ใช้รูปนี้' }}
        </button>
      </div>
    </div>

    <!-- viewfinder stage top bar -->
    <div v-if="!showAdjustUi" class="absolute inset-x-0 top-0 z-20 flex items-start justify-end gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <div class="flex shrink-0 items-center gap-2">
        <div class="flex rounded-full bg-white/15 p-0.5 font-body text-[10px]">
          <button
            class="rounded-full px-2 py-1 transition-colors"
            :class="autoCaptureEnabled ? 'bg-lime text-primary' : 'text-white/70'"
            :aria-pressed="autoCaptureEnabled"
            @click="autoCaptureEnabled = true"
          >
            อัตโนมัติ
          </button>
          <button
            class="rounded-full px-2 py-1 transition-colors"
            :class="!autoCaptureEnabled ? 'bg-mint text-primary' : 'text-white/70'"
            :aria-pressed="!autoCaptureEnabled"
            @click="autoCaptureEnabled = false"
          >
            กดเอง
          </button>
        </div>
        <button
          class="h-11 w-11 rounded-full bg-white/15 flex items-center justify-center active:opacity-80"
          aria-label="ปิดกล้อง"
          @click="closeScanner"
        >
          <span class="material-symbols-outlined text-2xl">close</span>
        </button>
      </div>
    </div>

    <p
      v-if="!showAdjustUi && errorMessage"
      class="absolute left-4 right-4 top-28 z-30 rounded-lg border border-amber-300/50 bg-black/90 px-3 py-2 font-body text-xs leading-5 text-white shadow-xl"
    >
      {{ errorMessage }}
    </p>

    <div v-if="!showAdjustUi && (isStarting || cameraError)" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center">
      <span
        class="material-symbols-outlined text-5xl"
        :class="{ 'animate-spin': isStarting }"
      >
        {{ isStarting ? 'progress_activity' : 'photo_camera' }}
      </span>
      <p class="font-body text-sm text-white/80">
        {{ isStarting ? 'กำลังเปิดกล้อง…' : cameraError }}
      </p>
      <button
        v-if="cameraError"
        class="mt-2 rounded-full bg-white px-5 py-2.5 font-body text-sm font-medium text-black"
        @click="retryCamera"
      >
        ลองใหม่
      </button>
    </div>

    <div v-if="!showAdjustUi" class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
      <div class="flex justify-center">
        <div class="relative h-24 w-24">
          <svg class="pointer-events-none absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 96 96" aria-hidden="true">
            <circle
              cx="48"
              cy="48"
              :r="HOLD_RING_RADIUS"
              fill="none"
              stroke="#b2df26"
              stroke-width="3"
              stroke-linecap="round"
              :stroke-dasharray="HOLD_RING_CIRCUMFERENCE"
              :stroke-dashoffset="holdRingDashoffset"
              :style="{ transition: holdRingTransition }"
            />
          </svg>
          <button
            class="absolute inset-2 h-20 w-20 rounded-full border-4 border-white bg-white/20 p-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="ถ่ายภาพเอกสาร"
            :disabled="!canCapture"
            @click="capturePhoto"
          >
            <span class="block h-full w-full rounded-full bg-white" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
