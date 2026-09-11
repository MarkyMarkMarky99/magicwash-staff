import { computed, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { contentBox, projectQuad } from '@/features/orders/utils/quad-projection'
import type { Point, Quad } from '@/features/orders/utils/quad-projection'

export const ASPECT_RATIO_TOLERANCE = 0.02
export const CORNER_HIT_RADIUS_CSS_PX = 44

export type Dimensions = { width: number, height: number }
export type InitialQuadResult = { quad: Quad, diagnostic: 'quad mapped' | 'no quad' }

function isValidDimensions(dimensions: Dimensions): boolean {
  return Number.isFinite(dimensions.width)
    && Number.isFinite(dimensions.height)
    && dimensions.width > 0
    && dimensions.height > 0
}

export function clampPoint(point: Point, dimensions: Dimensions): Point {
  return {
    x: Math.min(Math.max(point.x, 0), dimensions.width),
    y: Math.min(Math.max(point.y, 0), dimensions.height),
  }
}

export function nearestCornerIndex(points: Quad, target: Point, radius: number): number | null {
  let nearestIndex: number | null = null
  let nearestDistance = radius
  points.forEach((point, index) => {
    const distance = Math.hypot(point.x - target.x, point.y - target.y)
    if (distance <= nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })
  return nearestIndex
}

export function aspectRatiosMatch(still: Dimensions, video: Dimensions): boolean {
  if (!isValidDimensions(still) || !isValidDimensions(video)) return false
  const stillRatio = still.width / still.height
  const videoRatio = video.width / video.height
  return Math.abs(stillRatio - videoRatio) / videoRatio <= ASPECT_RATIO_TOLERANCE
}

export function defaultInsetQuad(dimensions: Dimensions, insetRatio = 0.1): Quad {
  const insetX = dimensions.width * insetRatio
  const insetY = dimensions.height * insetRatio
  return [
    { x: insetX, y: insetY },
    { x: dimensions.width - insetX, y: insetY },
    { x: dimensions.width - insetX, y: dimensions.height - insetY },
    { x: insetX, y: dimensions.height - insetY },
  ]
}

export function initialQuadForStill(
  detectedQuad: Quad | null,
  video: Dimensions,
  still: Dimensions,
): InitialQuadResult {
  if (!detectedQuad) return { quad: defaultInsetQuad(still), diagnostic: 'no quad' }

  const scale = still.width / video.width
  return {
    quad: detectedQuad.map((point) => clampPoint({ x: point.x * scale, y: point.y * scale }, still)) as Quad,
    diagnostic: 'quad mapped',
  }
}

export function warpOutputSize(quad: Quad, maxDimension: number): Dimensions {
  const width = Math.max(
    Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y),
    Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y),
  )
  const height = Math.max(
    Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y),
    Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y),
  )
  const scale = maxDimension > 0 ? Math.min(1, maxDimension / Math.max(width, height)) : 1
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function useCornerEditor(
  imageDimensions: MaybeRefOrGetter<Dimensions>,
  initialQuad: MaybeRefOrGetter<Quad>,
  displayedBox: MaybeRefOrGetter<Dimensions>,
) {
  const points = ref<Quad>(toValue(initialQuad).map((point) => ({ ...point })) as Quad)
  const activeCorner = ref<number | null>(null)
  const pointerPosition = ref<Point>({ x: 0, y: 0 })
  let pointerId: number | null = null

  const projectedPoints = computed(() => {
    const image = toValue(imageDimensions)
    const displayed = toValue(displayedBox)
    return projectQuad(points.value, contentBox(image.width, image.height, displayed.width, displayed.height))
  })

  function resetPoints(): void {
    points.value = toValue(initialQuad).map((point) => ({ ...point })) as Quad
    activeCorner.value = null
    pointerId = null
  }

  function eventImagePoint(event: PointerEvent): Point | null {
    const target = event.currentTarget as HTMLElement | null
    if (!target) return null
    const image = toValue(imageDimensions)
    const rectangle = target.getBoundingClientRect()
    const box = contentBox(image.width, image.height, rectangle.width, rectangle.height)
    if (!box.scale) return null

    pointerPosition.value = {
      x: event.clientX - rectangle.left,
      y: event.clientY - rectangle.top,
    }
    return clampPoint({
      x: (pointerPosition.value.x - box.offsetX) / box.scale,
      y: (pointerPosition.value.y - box.offsetY) / box.scale,
    }, image)
  }

  function onPointerDown(event: PointerEvent): void {
    const point = eventImagePoint(event)
    if (!point) return
    const image = toValue(imageDimensions)
    const displayed = toValue(displayedBox)
    const box = contentBox(image.width, image.height, displayed.width, displayed.height)
    const corner = nearestCornerIndex(points.value, point, CORNER_HIT_RADIUS_CSS_PX / box.scale)
    if (corner === null) return

    pointerId = event.pointerId
    activeCorner.value = corner
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== pointerId || activeCorner.value === null) return
    const point = eventImagePoint(event)
    if (!point) return
    const nextPoints = points.value.map((corner) => ({ ...corner })) as Quad
    nextPoints[activeCorner.value] = point
    points.value = nextPoints
    event.preventDefault()
  }

  function releasePointer(event: PointerEvent): void {
    if (event.pointerId !== pointerId) return
    const target = event.currentTarget as HTMLElement
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
    pointerId = null
    activeCorner.value = null
  }

  watch([() => toValue(imageDimensions), () => toValue(initialQuad)], resetPoints, { immediate: true })

  return {
    points,
    projectedPoints,
    activeCorner,
    pointerPosition,
    onPointerDown,
    onPointerMove,
    onPointerUp: releasePointer,
    onPointerCancel: releasePointer,
    resetPoints,
  }
}
