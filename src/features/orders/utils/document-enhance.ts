export type DocumentFilterMode = 'original' | 'enhance' | 'bw'

export type PixelBuffer = {
  data: Uint8ClampedArray,
  width: number,
  height: number,
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function luminance(data: Uint8ClampedArray): Float32Array {
  const values = new Float32Array(data.length / 4)
  for (let pixel = 0, offset = 0; pixel < values.length; pixel += 1, offset += 4) {
    values[pixel] = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722
  }
  return values
}

function boxBlurPass(source: Float32Array, width: number, height: number, radius: number): Float32Array {
  const horizontal = new Float32Array(source.length)
  const output = new Float32Array(source.length)
  const span = radius * 2 + 1

  for (let y = 0; y < height; y += 1) {
    const row = y * width
    let sum = 0
    for (let x = -radius; x <= radius; x += 1) sum += source[row + Math.min(width - 1, Math.max(0, x))]
    for (let x = 0; x < width; x += 1) {
      horizontal[row + x] = sum / span
      sum += source[row + Math.min(width - 1, x + radius + 1)] - source[row + Math.max(0, x - radius)]
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sum = 0
    for (let y = -radius; y <= radius; y += 1) sum += horizontal[Math.min(height - 1, Math.max(0, y)) * width + x]
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = sum / span
      sum += horizontal[Math.min(height - 1, y + radius + 1) * width + x] - horizontal[Math.max(0, y - radius) * width + x]
    }
  }

  return output
}

export function blurredLuminance(values: Float32Array, width: number, height: number, radius: number): Float32Array {
  let blurred = values
  for (let pass = 0; pass < 3; pass += 1) blurred = boxBlurPass(blurred, width, height, radius)
  return blurred
}

export function buildIntegralImage(values: Uint8ClampedArray, width: number, height: number): Uint32Array {
  const integral = new Uint32Array((width + 1) * (height + 1))
  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0
    for (let x = 1; x <= width; x += 1) {
      rowSum += values[(y - 1) * width + x - 1]
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum
    }
  }
  return integral
}

export function integralWindowSum(
  integral: Uint32Array,
  width: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): number {
  const stride = width + 1
  return integral[bottom * stride + right]
    - integral[top * stride + right]
    - integral[bottom * stride + left]
    + integral[top * stride + left]
}

function contrastStretch(values: Float32Array): Float32Array {
  const histogram = new Uint32Array(256)
  values.forEach((value) => { histogram[clampByte(value)] += 1 })
  const clippedCount = values.length * 0.01
  let lower = 0
  let cumulative = 0
  while (lower < 255 && cumulative + histogram[lower] <= clippedCount) cumulative += histogram[lower++]
  let upper = 255
  cumulative = 0
  while (upper > 0 && cumulative + histogram[upper] <= clippedCount) cumulative += histogram[upper--]
  if (upper - lower < 64) return values

  const stretched = new Float32Array(values.length)
  const scale = 255 / (upper - lower)
  values.forEach((value, index) => { stretched[index] = Math.min(255, Math.max(0, (value - lower) * scale)) })
  return stretched
}

function enhancedLuminance(source: Float32Array, width: number, height: number): Float32Array {
  const radius = Math.max(1, Math.round(Math.max(width, height) / 20))
  const lighting = blurredLuminance(source, width, height, radius)
  const normalized = new Float32Array(source.length)
  source.forEach((value, index) => {
    normalized[index] = Math.min(255, value * 220 / Math.max(1, lighting[index]))
  })
  return contrastStretch(normalized)
}

function applyEnhancedLuminance(source: PixelBuffer): PixelBuffer {
  const originalLuminance = luminance(source.data)
  const correctedLuminance = enhancedLuminance(originalLuminance, source.width, source.height)
  const output = new Uint8ClampedArray(source.data.length)
  for (let pixel = 0, offset = 0; pixel < originalLuminance.length; pixel += 1, offset += 4) {
    const scale = correctedLuminance[pixel] / Math.max(1, originalLuminance[pixel])
    output[offset] = clampByte(source.data[offset] * scale)
    output[offset + 1] = clampByte(source.data[offset + 1] * scale)
    output[offset + 2] = clampByte(source.data[offset + 2] * scale)
    output[offset + 3] = source.data[offset + 3]
  }
  return { data: output, width: source.width, height: source.height }
}

function adaptiveBlackAndWhite(source: PixelBuffer): PixelBuffer {
  const values = luminance(source.data)
  const bytes = new Uint8ClampedArray(values.length)
  values.forEach((value, index) => { bytes[index] = clampByte(value) })
  const integral = buildIntegralImage(bytes, source.width, source.height)
  const output = new Uint8ClampedArray(source.data.length)
  const radius = Math.min(25, Math.max(7, Math.floor(Math.min(source.width, source.height) / 12)))
  const offset = 10

  for (let y = 0; y < source.height; y += 1) {
    const top = Math.max(0, y - radius)
    const bottom = Math.min(source.height, y + radius + 1)
    for (let x = 0; x < source.width; x += 1) {
      const left = Math.max(0, x - radius)
      const right = Math.min(source.width, x + radius + 1)
      const count = (right - left) * (bottom - top)
      const threshold = integralWindowSum(integral, source.width, left, top, right, bottom) / count - offset
      const value = bytes[y * source.width + x] < threshold ? 0 : 255
      const pixelOffset = (y * source.width + x) * 4
      output[pixelOffset] = value
      output[pixelOffset + 1] = value
      output[pixelOffset + 2] = value
      output[pixelOffset + 3] = source.data[pixelOffset + 3]
    }
  }
  return { data: output, width: source.width, height: source.height }
}

export function enhanceDocument(source: PixelBuffer, mode: DocumentFilterMode): PixelBuffer {
  if (mode === 'original') return { data: new Uint8ClampedArray(source.data), width: source.width, height: source.height }
  const enhanced = applyEnhancedLuminance(source)
  return mode === 'bw' ? adaptiveBlackAndWhite(enhanced) : enhanced
}
