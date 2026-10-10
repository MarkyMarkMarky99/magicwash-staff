import { sheetTimestampMs } from '@/shared/utils/sheet-date'

export const RUNNING_LONG_SECONDS = 90 * 60

export function elapsedSeconds(loadedAt: string | null, nowMs: number): number | null {
  const loaded = loadedAt === null ? null : sheetTimestampMs(loadedAt)
  return loaded === null ? null : Math.max(0, Math.floor((nowMs - loaded) / 1000))
}

export function formatElapsed(seconds: number): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${Math.floor(seconds / 3600)}:${pad(Math.floor(seconds % 3600 / 60))}:${pad(seconds % 60)}`
}
