export type Point = { x: number, y: number }
export type Quad = [Point, Point, Point, Point]

export type ContentBox = {
  scale: number,
  offsetX: number,
  offsetY: number,
}

function hasPositiveFiniteDimensions(...dimensions: number[]): boolean {
  return dimensions.every((dimension) => Number.isFinite(dimension) && dimension > 0)
}

export function fitScale(sourceW: number, sourceH: number, maxDimension: number): number {
  if (!hasPositiveFiniteDimensions(sourceW, sourceH, maxDimension)) return 1
  return Math.min(1, maxDimension / Math.max(sourceW, sourceH))
}

export function scaleQuad(quad: Quad, factor: number): Quad {
  if (!Number.isFinite(factor)) return quad.map((point) => ({ ...point })) as Quad
  return quad.map((point) => ({ x: point.x * factor, y: point.y * factor })) as Quad
}

export function contentBox(videoW: number, videoH: number, elementW: number, elementH: number): ContentBox {
  if (!hasPositiveFiniteDimensions(videoW, videoH, elementW, elementH)) {
    return { scale: 1, offsetX: 0, offsetY: 0 }
  }

  const scale = Math.min(elementW / videoW, elementH / videoH)
  return {
    scale,
    offsetX: (elementW - videoW * scale) / 2,
    offsetY: (elementH - videoH * scale) / 2,
  }
}

export function projectQuad(quad: Quad, box: ContentBox): Quad {
  return quad.map((point) => ({
    x: point.x * box.scale + box.offsetX,
    y: point.y * box.scale + box.offsetY,
  })) as Quad
}

export function orderQuad(points: Quad): Quad {
  const by = (score: (point: Point) => number, direction: 1 | -1): Point => points.reduce((best, point) => (
    direction * score(point) < direction * score(best) ? point : best
  ))

  return [
    by((point) => point.x + point.y, 1),
    by((point) => point.y - point.x, 1),
    by((point) => point.x + point.y, -1),
    by((point) => point.y - point.x, -1),
  ]
}
