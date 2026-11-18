export const BUBBLE_MARGIN = 12
export const BUBBLE_DRAG_THRESHOLD = 6

export type BubbleSide = 'left' | 'right'

export interface BubblePosition {
  side: BubbleSide
  y: number
}

export interface BubbleBounds {
  width: number
  height: number
  top: number
  bottom: number
}

/** The AI text as plain prose for the bubble: markdown symbols removed, whitespace collapsed. */
export function plainBubbleText(text: string): string {
  return text
    .replace(/```[a-z]*\n?/gi, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, '$1$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[*`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function clampBubbleY(y: number, groupHeight: number, bounds: BubbleBounds): number {
  const min = BUBBLE_MARGIN + bounds.top
  const max = Math.max(min, bounds.height - groupHeight - BUBBLE_MARGIN - bounds.bottom)
  return Math.min(Math.max(y, min), max)
}

/** Left edge of the avatar+bubble group for a side, inside the margin. */
export function bubbleLeft(side: BubbleSide, groupWidth: number, containerWidth: number): number {
  return side === 'left' ? BUBBLE_MARGIN : Math.max(BUBBLE_MARGIN, containerWidth - groupWidth - BUBBLE_MARGIN)
}

/** Which edge a released group snaps to: the nearer one by its centre. */
export function snapSide(left: number, groupWidth: number, containerWidth: number): BubbleSide {
  return left + groupWidth / 2 < containerWidth / 2 ? 'left' : 'right'
}

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage blocked: the bubble just forgets this on reload.
  }
}

export function parseBubblePosition(raw: string | null): BubblePosition | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { side, y } = value as Record<string, unknown>
    if ((side !== 'left' && side !== 'right') || typeof y !== 'number' || !Number.isFinite(y)) return null
    return { side, y }
  } catch {
    return null
  }
}

export interface DismissedBubble {
  id: string
  at: string
}

export function parseDismissed(raw: string | null): DismissedBubble | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { id, at } = value as Record<string, unknown>
    return typeof id === 'string' && typeof at === 'string' ? { id, at } : null
  } catch {
    return null
  }
}

/** A dismissed bubble stays hidden until a message newer than the dismissed one arrives. */
export function isDismissed(message: { eventId: string, at: string }, dismissed: DismissedBubble | null): boolean {
  return dismissed !== null && (message.eventId === dismissed.id || message.at <= dismissed.at)
}
