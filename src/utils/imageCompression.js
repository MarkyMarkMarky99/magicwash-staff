export const MAX_SIZE_BYTES = 200 * 1024
const MAX_DIMENSION = 1920 // pre-scale cap before quality search — keeps toBlob fast

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')) }
    img.src = url
  })
}

function capDimensions(w, h, maxDim) {
  if (w <= maxDim && h <= maxDim) return { w, h }
  const ratio = Math.min(maxDim / w, maxDim / h)
  return { w: Math.round(w * ratio), h: Math.round(h * ratio) }
}

function drawToCanvas(source, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, width, height)
  return canvas
}

// Binary-search quality without re-drawing.
async function findBestQuality(canvas, maxBytes) {
  const toBlob = (quality) =>
    new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

  let lo = 0.1
  let hi = 1.0
  let best = null

  // 8 iterations → quality precision ≈ 0.004
  for (let i = 0; i < 8; i++) {
    const quality = (lo + hi) / 2
    const blob = await toBlob(quality)
    if (blob.size <= maxBytes) {
      best = blob
      lo = quality // acceptable — try higher quality
    } else {
      hi = quality // too large  — try lower quality
    }
  }

  return best // null when even ~lo quality exceeds maxBytes at these dimensions
}

export async function compressCanvasToJpeg(sourceCanvas, maxBytes = MAX_SIZE_BYTES) {
  let w = sourceCanvas.width
  let h = sourceCanvas.height
  let canvas = sourceCanvas
  let blob = null

  while (w >= 100) {
    blob = await findBestQuality(canvas, maxBytes)
    if (blob) break
    w = Math.round(w * 0.75)
    h = Math.round(h * 0.75)
    canvas = drawToCanvas(sourceCanvas, w, h)
  }

  if (!blob) {
    canvas = drawToCanvas(sourceCanvas, Math.max(1, w), Math.max(1, h))
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.1))
  }

  return blob
}

export function encodeCanvasToJpeg(canvas, quality = 0.82) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality)
  })
}

/**
 * Compress a File/Blob to stay under maxBytes while preserving maximum quality.
 * Converts to JPEG. Returns the original file unchanged if already within limit.
 *
 * @param {File} file
 * @param {number} maxBytes — default 200 KB
 * @returns {Promise<File>}
 */
export async function compressImage(file, maxBytes = MAX_SIZE_BYTES) {
  if (file.size <= maxBytes) return file

  const img = await fileToImage(file)
  let { w, h } = capDimensions(img.naturalWidth, img.naturalHeight, MAX_DIMENSION)
  const canvas = drawToCanvas(img, w, h)
  const blob = await compressCanvasToJpeg(canvas, maxBytes)

  const basename = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${basename}.jpg`, { type: 'image/jpeg' })
}

/**
 * Compress multiple images concurrently.
 *
 * @param {File[]} files
 * @param {number} maxBytes
 * @returns {Promise<File[]>}
 */
export async function compressImages(files, maxBytes = MAX_SIZE_BYTES) {
  return Promise.all(files.map((f) => compressImage(f, maxBytes)))
}
