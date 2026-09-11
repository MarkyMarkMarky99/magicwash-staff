import { onBeforeUnmount, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import {
  fitScale,
  orderQuad,
  scaleQuad,
} from '@/features/orders/utils/quad-projection'
import type { Point, Quad } from '@/features/orders/utils/quad-projection'

const DETECT_INTERVAL_MS = 100
const ML_INPUT_SIZE = 224
export const FRAME_EDGE_MARGIN_RATIO = 0.02
export const MAX_QUAD_COVERAGE_RATIO = 0.85
export const SMOOTHING_FACTOR = 0.35
export const JUMP_REJECT_RATIO = 0.25
export const MISS_TOLERANCE = 3

export type TemporalQuadState = {
  quad: Quad | null,
  consecutiveJumps: number,
  consecutiveMisses: number,
}

type DetectionRegion = { x: number, y: number, width: number, height: number }

const DETECTION_OPTIONS = {
  detector: 'ml' as const,
  mode: 'detect' as const,
  ml: { assetBaseUrl: '/scanic-ml/' },
}

export type LetterboxLayout = {
  scale: number,
  drawWidth: number,
  drawHeight: number,
  offsetX: number,
  offsetY: number,
}

/**
 * Where to draw a video frame inside the square canvas the model expects, keeping the
 * frame's aspect ratio and centring it between black bars. Deliberately unrounded:
 * drawImage accepts fractional destination boxes, and rounding here would not be undone
 * by unmapLetterboxedQuad's single scale factor, leaving the outline slightly offset.
 */
export function letterboxLayout(videoWidth: number, videoHeight: number, size: number): LetterboxLayout {
  const scale = fitScale(videoWidth, videoHeight, size)
  const drawWidth = videoWidth * scale
  const drawHeight = videoHeight * scale
  return {
    scale,
    drawWidth,
    drawHeight,
    offsetX: (size - drawWidth) / 2,
    offsetY: (size - drawHeight) / 2,
  }
}

export function unmapLetterboxedQuad(quad: Quad, layout: LetterboxLayout): Quad {
  return scaleQuad(
    quad.map((point) => ({ x: point.x - layout.offsetX, y: point.y - layout.offsetY })) as Quad,
    1 / layout.scale,
  )
}

export function quadCoverageRatio(quad: Quad, region: DetectionRegion): number {
  if (!(region.width > 0) || !(region.height > 0)) return 0
  const twiceArea = quad.reduce((area, point, index) => {
    const next = quad[(index + 1) % quad.length]
    return area + point.x * next.y - next.x * point.y
  }, 0)
  return Math.abs(twiceArea) / 2 / (region.width * region.height)
}

export function isUsableDocumentQuad(quad: Quad, region: DetectionRegion): boolean {
  const marginX = region.width * FRAME_EDGE_MARGIN_RATIO
  const marginY = region.height * FRAME_EDGE_MARGIN_RATIO
  const insideMargins = quad.every((point) => (
    point.x >= region.x + marginX
    && point.x <= region.x + region.width - marginX
    && point.y >= region.y + marginY
    && point.y <= region.y + region.height - marginY
  ))
  return insideMargins && quadCoverageRatio(quad, region) <= MAX_QUAD_COVERAGE_RATIO
}

export function smoothQuad(previous: Quad, next: Quad, factor = SMOOTHING_FACTOR): Quad {
  return previous.map((point, index) => ({
    x: point.x + (next[index].x - point.x) * factor,
    y: point.y + (next[index].y - point.y) * factor,
  })) as Quad
}

export function largestCornerMovementRatio(previous: Quad, next: Quad, frameLongSide: number): number {
  if (!Number.isFinite(frameLongSide) || frameLongSide <= 0) return Infinity
  return previous.reduce((largest, point, index) => Math.max(
    largest,
    Math.hypot(next[index].x - point.x, next[index].y - point.y),
  ), 0) / frameLongSide
}

export function updateTemporalQuad(
  state: TemporalQuadState,
  detected: Quad | null,
  frameLongSide: number,
): TemporalQuadState {
  if (!detected) {
    const consecutiveMisses = state.consecutiveMisses + 1
    return {
      quad: consecutiveMisses >= MISS_TOLERANCE ? null : state.quad,
      consecutiveJumps: 0,
      consecutiveMisses,
    }
  }

  if (!state.quad) return { quad: detected, consecutiveJumps: 0, consecutiveMisses: 0 }

  if (largestCornerMovementRatio(state.quad, detected, frameLongSide) > JUMP_REJECT_RATIO) {
    const consecutiveJumps = state.consecutiveJumps + 1
    if (consecutiveJumps < 2) return { quad: state.quad, consecutiveJumps, consecutiveMisses: 0 }
    return { quad: detected, consecutiveJumps: 0, consecutiveMisses: 0 }
  }

  return {
    quad: smoothQuad(state.quad, detected),
    consecutiveJumps: 0,
    consecutiveMisses: 0,
  }
}

function errorName(error: unknown): string {
  return error instanceof Error && error.name ? error.name : 'UnknownError'
}

type ScannerInstance = InstanceType<typeof import('scanic').Scanner>

function cornersToQuad(corners: {
  topLeft: Point,
  topRight: Point,
  bottomRight: Point,
  bottomLeft: Point,
}): Quad {
  return [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft]
}

export function useDocumentDetect(getVideo: () => HTMLVideoElement | null, active: MaybeRefOrGetter<boolean>) {
  const quad = ref<Quad | null>(null)
  const lastDetectMs = ref<number | null>(null)
  const detectError = ref('')
  const scanicLoadState = ref('loading')
  const detectionStatus = ref('waiting')
  let scanner: ScannerInstance | null = null
  let scannerPromise: Promise<ScannerInstance> | null = null
  let workCanvas: HTMLCanvasElement | null = null
  let workContext: CanvasRenderingContext2D | null = null
  let timer: ReturnType<typeof window.setTimeout> | null = null
  let runToken = 0
  let temporalState: TemporalQuadState = { quad: null, consecutiveJumps: 0, consecutiveMisses: 0 }

  function publishDetection(detected: Quad | null, frameLongSide: number): void {
    temporalState = updateTemporalQuad(temporalState, detected, frameLongSide)
    quad.value = temporalState.quad
  }

  async function loadScanner(): Promise<ScannerInstance> {
    if (scanner) return scanner
    if (!scannerPromise) {
      scanicLoadState.value = 'loading'
      scannerPromise = import('scanic').then(async ({ Scanner }) => {
        const initializedScanner = new Scanner(DETECTION_OPTIONS)
        await initializedScanner.initialize()
        scanner = initializedScanner
        scanicLoadState.value = 'ready'
        return initializedScanner
      }).catch((error) => {
        scanicLoadState.value = errorName(error)
        throw error
      })
    }
    return scannerPromise
  }

  function isCurrent(token: number): boolean {
    return token === runToken && toValue(active)
  }

  function scheduleNext(token: number, elapsedMs: number): void {
    if (!isCurrent(token)) return
    timer = window.setTimeout(() => {
      timer = null
      void detect(token)
    }, Math.max(0, DETECT_INTERVAL_MS - elapsedMs))
  }

  async function detect(token: number): Promise<void> {
    const loopStartedAt = performance.now()
    let detectStartedAt: number | null = null
    try {
      const video = getVideo()
      if (!video?.videoWidth || !video.videoHeight || document.hidden || !isCurrent(token)) {
        return
      }

      const layout = letterboxLayout(video.videoWidth, video.videoHeight, ML_INPUT_SIZE)
      if (!workCanvas) workCanvas = document.createElement('canvas')
      if (!workContext) workContext = workCanvas.getContext('2d', { willReadFrequently: true })
      if (!workContext || !layout.drawWidth || !layout.drawHeight) throw new Error('CanvasContextUnavailable')

      if (workCanvas.width !== ML_INPUT_SIZE || workCanvas.height !== ML_INPUT_SIZE) {
        workCanvas.width = ML_INPUT_SIZE
        workCanvas.height = ML_INPUT_SIZE
      }
      workContext.fillStyle = 'black'
      workContext.fillRect(0, 0, ML_INPUT_SIZE, ML_INPUT_SIZE)
      workContext.drawImage(
        video,
        0, 0, video.videoWidth, video.videoHeight,
        layout.offsetX, layout.offsetY, layout.drawWidth, layout.drawHeight,
      )

      const activeScanner = await loadScanner()
      if (!isCurrent(token)) return

      detectStartedAt = performance.now()
      const result = await activeScanner.scan(workCanvas, DETECTION_OPTIONS)
      if (!isCurrent(token)) return

      lastDetectMs.value = Math.round(performance.now() - detectStartedAt)
      detectError.value = ''
      const letterboxed = result.success && result.corners ? cornersToQuad(result.corners) : null
      let detectedQuad = letterboxed
        ? orderQuad(unmapLetterboxedQuad(letterboxed, layout))
        : null
      const fullFrame = { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight }

      if (detectedQuad && !isUsableDocumentQuad(detectedQuad, fullFrame)) {
        detectionStatus.value = `rejected · coverage ${quadCoverageRatio(detectedQuad, fullFrame).toFixed(2)}`
        detectedQuad = null
      } else {
        detectionStatus.value = detectedQuad
          ? `quad · coverage ${quadCoverageRatio(detectedQuad, fullFrame).toFixed(2)}`
          : 'miss'
      }
      publishDetection(detectedQuad, Math.max(video.videoWidth, video.videoHeight))
    } catch (error) {
      if (!isCurrent(token)) return
      if (detectStartedAt !== null) lastDetectMs.value = Math.round(performance.now() - detectStartedAt)
      detectError.value = errorName(error)
      const video = getVideo()
      publishDetection(null, Math.max(video?.videoWidth ?? 0, video?.videoHeight ?? 0))
    } finally {
      scheduleNext(token, performance.now() - loopStartedAt)
    }
  }

  function stop(): void {
    runToken += 1
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    temporalState = { quad: null, consecutiveJumps: 0, consecutiveMisses: 0 }
    quad.value = null
  }

  function start(): void {
    stop()
    const token = ++runToken
    void detect(token)
  }

  watch(() => toValue(active), (isActive) => {
    if (isActive) start()
    else stop()
  }, { immediate: true })

  onBeforeUnmount(stop)

  return { quad, lastDetectMs, detectError, scanicLoadState, detectionStatus }
}
