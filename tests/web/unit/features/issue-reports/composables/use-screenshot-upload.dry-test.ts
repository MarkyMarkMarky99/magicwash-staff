import assert from 'node:assert/strict'
import { useScreenshotUpload } from '../../../../../../src/features/issue-reports/composables/use-screenshot-upload'

interface UploadCall {
  file: File
  folder: string
}

const uploadCalls: UploadCall[] = []
let previewCounter = 0
const revokedPreviews: string[] = []

const objectUrls = globalThis.URL as unknown as {
  createObjectURL: (file: unknown) => string
  revokeObjectURL: (url: string) => void
}
const originalCreateObjectURL = objectUrls.createObjectURL
const originalRevokeObjectURL = objectUrls.revokeObjectURL
objectUrls.createObjectURL = () => `blob:preview-${++previewCounter}`
objectUrls.revokeObjectURL = (url) => {
  revokedPreviews.push(url)
}

function fakeFile(name: string, size: number): File {
  return { name, size } as unknown as File
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

try {
  // Happy path: compress runs before upload, and only the compressed file is uploaded.
  const upload = useScreenshotUpload({
    compressImage: async (file) => fakeFile(file.name, Math.round(file.size / 4)),
    uploadToStorage: async (file, folder) => {
      uploadCalls.push({ file, folder })
      return 'https://storage.example/issue-reports/shot.jpg'
    },
  })

  assert.equal(upload.imageUrl.value, null, 'no screenshot means no url')
  assert.equal(upload.isBusy.value, false, 'an empty upload is not busy')

  await upload.select(fakeFile('shot.png', 800))

  assert.equal(uploadCalls.length, 1)
  assert.equal(uploadCalls[0]?.folder, 'issue-reports', 'screenshots must land in the issue-reports folder')
  assert.equal(uploadCalls[0]?.file.size, 200, 'the compressed file must be the one uploaded')
  assert.equal(upload.screenshot.value?.status, 'done')
  assert.equal(upload.screenshot.value?.originalSize, 800)
  assert.equal(upload.screenshot.value?.compressedSize, 200)
  assert.equal(upload.imageUrl.value, 'https://storage.example/issue-reports/shot.jpg')
  assert.equal(upload.isBusy.value, false)

  // clear() releases the preview and drops the url so a cleared form submits nothing.
  const clearedPreview = upload.screenshot.value?.previewUrl
  upload.clear()
  assert.equal(upload.screenshot.value, null)
  assert.equal(upload.imageUrl.value, null)
  assert.ok(clearedPreview && revokedPreviews.includes(clearedPreview), 'clear() must revoke the preview url')

  // A failed upload surfaces the error and never produces a url.
  const failing = useScreenshotUpload({
    compressImage: async (file) => file,
    uploadToStorage: async () => {
      throw new Error('storage unreachable')
    },
  })
  await failing.select(fakeFile('broken.png', 100))
  assert.equal(failing.screenshot.value?.status, 'error')
  assert.equal(failing.screenshot.value?.errorMessage, 'storage unreachable')
  assert.equal(failing.imageUrl.value, null)
  assert.equal(failing.isBusy.value, false, 'a failed upload is not busy')

  // A superseded pick must not overwrite the newer one when its upload resolves late.
  const slowUpload = deferred<string>()
  const racing = useScreenshotUpload({
    compressImage: async (file) => file,
    uploadToStorage: async (file) => (file.name === 'first.png' ? slowUpload.promise : 'https://storage.example/second.jpg'),
  })
  const firstSelect = racing.select(fakeFile('first.png', 100))
  assert.equal(racing.isBusy.value, true, 'an in-flight upload reports busy')
  const secondSelect = racing.select(fakeFile('second.png', 100))
  await secondSelect
  slowUpload.resolve('https://storage.example/first.jpg')
  await firstSelect

  assert.equal(racing.imageUrl.value, 'https://storage.example/second.jpg', 'the superseded upload must not win')
  assert.equal(racing.screenshot.value?.status, 'done')
} finally {
  objectUrls.createObjectURL = originalCreateObjectURL
  objectUrls.revokeObjectURL = originalRevokeObjectURL
}

console.log('use-screenshot-upload dry tests passed')
