import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { compressImage } from '@/utils/imageCompression'
import { uploadToStorage } from '@/shared/api/firebase-storage'

/**
 * Firebase Storage folder for issue-report screenshots.
 *
 * The two existing photo systems use 'images' (gallery) and `order-images/<orderId>`
 * (order documentation); screenshots are a third, unrelated set and get their own folder.
 */
const SCREENSHOT_FOLDER = 'issue-reports'

export type ScreenshotStatus = 'compressing' | 'uploading' | 'done' | 'error'

export interface Screenshot {
  previewUrl: string
  originalSize: number
  compressedSize: number | null
  imageUrl: string | null
  status: ScreenshotStatus
  errorMessage: string | null
}

export interface ScreenshotUploadDependencies {
  compressImage: (file: File) => Promise<File>
  uploadToStorage: (file: File, folder: string) => Promise<string>
}

export interface ScreenshotUpload {
  screenshot: Ref<Screenshot | null>
  imageUrl: ComputedRef<string | null>
  isBusy: ComputedRef<boolean>
  select(file: File): Promise<void>
  clear(): void
}

const IN_PROGRESS: ReadonlySet<ScreenshotStatus> = new Set<ScreenshotStatus>(['compressing', 'uploading'])

const defaultDependencies: ScreenshotUploadDependencies = { compressImage, uploadToStorage }

/**
 * Compress one screenshot and upload it to Firebase Storage, exposing only the resulting
 * download URL — the issue report row stores that URL, so nothing is written until submit.
 *
 * Mirrors the gallery's album path (`usePhotoUpload`): compress first, upload second. The
 * gallery's camera path skips compression because `CameraOverlay` already encodes JPEG, but
 * a screenshot always arrives as a picked file, so it always goes through `compressImage`.
 */
export function useScreenshotUpload(
  dependencies: ScreenshotUploadDependencies = defaultDependencies,
): ScreenshotUpload {
  const screenshot = ref<Screenshot | null>(null)
  // Bumped by every select() and clear(); a superseded upload resolves into a stale sequence
  // and must not write its URL over the newer pick.
  let selectionSequence = 0

  const imageUrl = computed(() => screenshot.value?.imageUrl ?? null)
  const isBusy = computed(() => screenshot.value !== null && IN_PROGRESS.has(screenshot.value.status))

  function patch(changes: Partial<Screenshot>): void {
    if (screenshot.value) Object.assign(screenshot.value, changes)
  }

  function releasePreview(): void {
    if (screenshot.value) URL.revokeObjectURL(screenshot.value.previewUrl)
  }

  function clear(): void {
    selectionSequence += 1
    releasePreview()
    screenshot.value = null
  }

  async function select(file: File): Promise<void> {
    const sequence = ++selectionSequence
    releasePreview()
    screenshot.value = {
      previewUrl: URL.createObjectURL(file),
      originalSize: file.size,
      compressedSize: null,
      imageUrl: null,
      status: 'compressing',
      errorMessage: null,
    }

    try {
      const compressed = await dependencies.compressImage(file)
      if (sequence !== selectionSequence) return
      patch({ compressedSize: compressed.size, status: 'uploading' })

      const uploadedUrl = await dependencies.uploadToStorage(compressed, SCREENSHOT_FOLDER)
      if (sequence !== selectionSequence) return
      patch({ imageUrl: uploadedUrl, status: 'done' })
    } catch (reason) {
      if (sequence !== selectionSequence) return
      patch({
        status: 'error',
        errorMessage: reason instanceof Error && reason.message ? reason.message : 'อัปโหลดรูปไม่สำเร็จ',
      })
    }
  }

  return { screenshot, imageUrl, isBusy, select, clear }
}
