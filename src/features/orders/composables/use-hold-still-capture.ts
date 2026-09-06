import { ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { Quad } from '@/features/orders/utils/quad-projection'

export const HOLD_DURATION_MS = 1200
export const STABLE_TOLERANCE_RATIO = 0.01
export const MIN_AREA_RATIO = 0.15
export const REARM_DELAY_MS = 1500

type VideoDimensions = { width: number, height: number }

export function movementRatio(previousQuad: Quad, nextQuad: Quad, frameLongSide: number): number {
  if (!Number.isFinite(frameLongSide) || frameLongSide <= 0) return Infinity

  const largestDisplacement = previousQuad.reduce((largest, point, index) => {
    const nextPoint = nextQuad[index]
    return Math.max(largest, Math.hypot(nextPoint.x - point.x, nextPoint.y - point.y))
  }, 0)
  return largestDisplacement / frameLongSide
}

export function quadAreaRatio(quad: Quad, frameWidth: number, frameHeight: number): number {
  if (!Number.isFinite(frameWidth) || !Number.isFinite(frameHeight) || frameWidth <= 0 || frameHeight <= 0) return 0

  const area = quad.reduce((sum, point, index) => {
    const nextPoint = quad[(index + 1) % quad.length]
    return sum + point.x * nextPoint.y - nextPoint.x * point.y
  }, 0)
  return Number.isFinite(area) ? Math.abs(area) / 2 / (frameWidth * frameHeight) : 0
}

export function useHoldStillCapture(
  quad: Ref<Quad | null>,
  active: MaybeRefOrGetter<boolean>,
  enabled: MaybeRefOrGetter<boolean>,
  videoDimensions: MaybeRefOrGetter<VideoDimensions>,
  onFire: () => void,
) {
  const progress = ref(0)
  const holding = ref(false)
  const lastMovementRatio = ref(0)
  let previousQuad: Quad | null = null
  let holdStartedAt: number | null = null
  let firedAt: number | null = null
  let rearmNeedsBreak = false

  function resetHolding(clearMovement = true): void {
    progress.value = 0
    holding.value = false
    if (clearMovement) lastMovementRatio.value = 0
    holdStartedAt = null
    previousQuad = null
  }

  function reset(): void {
    resetHolding()
    firedAt = null
    rearmNeedsBreak = false
  }

  function markRearmBreak(): void {
    if (firedAt !== null) rearmNeedsBreak = true
  }

  function update(nextQuad: Quad | null): void {
    if (!toValue(active) || !toValue(enabled)) {
      reset()
      return
    }

    const dimensions = toValue(videoDimensions)
    const frameLongSide = Math.max(dimensions.width, dimensions.height)
    if (!nextQuad || !frameLongSide) {
      markRearmBreak()
      resetHolding()
      return
    }

    const movement = previousQuad ? movementRatio(previousQuad, nextQuad, frameLongSide) : 0
    lastMovementRatio.value = movement
    if (previousQuad && movement > STABLE_TOLERANCE_RATIO) {
      markRearmBreak()
      resetHolding(false)
      previousQuad = nextQuad
      return
    }

    if (quadAreaRatio(nextQuad, dimensions.width, dimensions.height) < MIN_AREA_RATIO) {
      resetHolding()
      previousQuad = nextQuad
      return
    }

    const now = performance.now()
    previousQuad = nextQuad
    if (firedAt !== null) {
      if (!rearmNeedsBreak || now - firedAt < REARM_DELAY_MS) return
      firedAt = null
      rearmNeedsBreak = false
      holdStartedAt = now
      progress.value = 0
      holding.value = true
      return
    }

    if (holdStartedAt === null) holdStartedAt = now
    holding.value = true
    progress.value = Math.min(1, (now - holdStartedAt) / HOLD_DURATION_MS)
    if (progress.value < 1) return

    firedAt = now
    rearmNeedsBreak = false
    holding.value = false
    onFire()
  }

  watch(quad, update, { immediate: true })
  watch([() => toValue(active), () => toValue(enabled)], ([isActive, isEnabled]) => {
    if (!isActive || !isEnabled) reset()
  }, { immediate: true })

  return { progress, holding, lastMovementRatio, reset }
}
