export const PULL_RESISTANCE = 0.5
export const PULL_MAX_OFFSET = 96
export const PULL_THRESHOLD = 64
export const PULL_HOLD_OFFSET = 56
export const PULL_SLOP = 8
export const PULL_MAX_RADIUS = 24

export type PullIntent = 'undecided' | 'pull' | 'ignore'

export function pullOffset(distance: number): number {
  return Math.min(PULL_MAX_OFFSET, Math.max(0, distance * PULL_RESISTANCE))
}

export function pullProgress(offset: number): number {
  return Math.min(1, Math.max(0, offset / PULL_THRESHOLD))
}

export function pullRadius(offset: number): number {
  return Math.min(PULL_MAX_RADIUS, Math.max(0, offset))
}

export function shouldRefresh(offset: number): boolean {
  return offset >= PULL_THRESHOLD
}

export function pullIntent(deltaX: number, deltaY: number): PullIntent {
  if (Math.hypot(deltaX, deltaY) < PULL_SLOP) return 'undecided'
  return deltaY > 0 && deltaY > Math.abs(deltaX) ? 'pull' : 'ignore'
}
