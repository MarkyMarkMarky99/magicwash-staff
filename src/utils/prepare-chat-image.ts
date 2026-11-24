import { encodeCanvasToJpeg } from './imageCompression'

export class ChatImagePreparationError extends Error {
  constructor(message = 'Could not prepare chat image') { super(message); this.name = 'ChatImagePreparationError' }
}

export async function prepareChatImage(file: File): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new ChatImagePreparationError())
      image.src = url
    })
    const ratio = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new ChatImagePreparationError()
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await encodeCanvasToJpeg(canvas, 0.82)
    if (!blob) throw new ChatImagePreparationError()
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' })
  } finally { URL.revokeObjectURL(url) }
}
