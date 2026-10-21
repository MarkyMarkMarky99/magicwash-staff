export async function downscaleScreenshot(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Unable to open the screenshot'))
      image.src = url
    })
    const scale = Math.min(1, 1080 / image.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to prepare the screenshot')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const encode = (quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Unable to prepare the screenshot')), 'image/jpeg', quality)
    })
    const blob = await encode(0.85)
    return blob.size > 4.5 * 1024 * 1024 ? await encode(0.7) : blob
  } finally { URL.revokeObjectURL(url) }
}
