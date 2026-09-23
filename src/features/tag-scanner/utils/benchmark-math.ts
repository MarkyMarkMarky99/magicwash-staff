export type Rectangle = { x: number; y: number; width: number; height: number }

export function mapCoverRoi(videoWidth: number, videoHeight: number, display: Rectangle, frame: Rectangle): Rectangle {
  const scale = Math.max(display.width / videoWidth, display.height / videoHeight)
  const renderedWidth = videoWidth * scale
  const renderedHeight = videoHeight * scale
  const offsetX = (renderedWidth - display.width) / 2
  const offsetY = (renderedHeight - display.height) / 2
  const x = Math.max(0, (frame.x - display.x + offsetX) / scale)
  const y = Math.max(0, (frame.y - display.y + offsetY) / scale)
  return {
    x,
    y,
    width: Math.min(videoWidth - x, frame.width / scale),
    height: Math.min(videoHeight - y, frame.height / scale),
  }
}

export function percentile95(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null
}
