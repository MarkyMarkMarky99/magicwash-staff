import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ref, toValue } from 'vue'

interface CreateCall {
  payload: Record<string, unknown>
  type: string
}

interface PhotoUploadDependencies {
  compressImage: (file: { size: number }) => Promise<{ size: number }>
  createPhoto: (type: string, payload: Record<string, unknown>) => Promise<unknown>
  uploadToStorage: (file: { size: number }) => Promise<string>
  vue: { ref: typeof ref; toValue: typeof toValue }
}

const testGlobal = globalThis as typeof globalThis & {
  __photoUploadTestDependencies?: PhotoUploadDependencies
}
const createCalls: CreateCall[] = []
let saveError: Error | null = null

testGlobal.__photoUploadTestDependencies = {
  vue: { ref, toValue },
  compressImage: async (file) => file,
  uploadToStorage: async () => 'https://storage.example/photo.jpg',
  createPhoto: async (type, payload) => {
    createCalls.push({ type, payload })
    if (saveError) throw saveError
    return {}
  },
}

const sourceUrl = new URL('../../../../src/composables/usePhotoUpload.js', import.meta.url)
let source = await readFile(sourceUrl, 'utf8')
const replacements = [
  ["import { ref, toValue } from 'vue'", 'const { ref, toValue } = globalThis.__photoUploadTestDependencies.vue'],
  ["import { compressImage } from '../utils/imageCompression'", 'const { compressImage } = globalThis.__photoUploadTestDependencies'],
  ["import { uploadToStorage } from '@/shared/api/firebase-storage'", 'const { uploadToStorage } = globalThis.__photoUploadTestDependencies'],
  ["import { createPhoto } from '../features/gallery/services/laundry-photo.service'", 'const { createPhoto } = globalThis.__photoUploadTestDependencies'],
] as const

for (const [from, to] of replacements) {
  assert.ok(source.includes(from), `expected usePhotoUpload import: ${from}`)
  source = source.replace(from, to)
}

const { usePhotoUpload } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

const originalCreateObjectURL = URL.createObjectURL
URL.createObjectURL = () => 'blob:preview'

async function waitForTerminalStatus(images: { value: Array<{ status: string }> }): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (images.value[0]?.status === 'done' || images.value[0]?.status === 'error') return
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  assert.fail(`photo did not reach a terminal status: ${images.value[0]?.status}`)
}

try {
  const beforeUpload = usePhotoUpload(
    ref('BEF'),
    ref('order-1'),
    ref('order-item-1'),
    ref('staff-1'),
    ref('item-1'),
  )
  beforeUpload.addFiles([{ name: 'before.jpg', size: 42 }], { skipCompression: true })
  await waitForTerminalStatus(beforeUpload.images)

  assert.deepEqual(createCalls[0], {
    type: 'BEF',
    payload: {
      orderId: 'order-1',
      imageUrl: 'https://storage.example/photo.jpg',
      createdBy: 'staff-1',
      orderItemId: 'order-item-1',
      itemId: 'item-1',
    },
  })
  assert.equal(beforeUpload.images.value[0]?.status, 'done')

  const afterUpload = usePhotoUpload(
    ref('AFT'),
    ref('order-2'),
    ref(null),
    ref('staff-2'),
    ref('null'),
  )
  afterUpload.addFiles([{ name: 'after.jpg', size: 43 }], { skipCompression: true })
  await waitForTerminalStatus(afterUpload.images)

  assert.deepEqual(createCalls[1], {
    type: 'AFT',
    payload: {
      orderId: 'order-2',
      imageUrl: 'https://storage.example/photo.jpg',
      createdBy: 'staff-2',
    },
  })
  assert.equal(afterUpload.images.value[0]?.status, 'done')

  saveError = new Error('row write failed')
  const failingUpload = usePhotoUpload(
    ref('AFT'),
    ref('order-3'),
    ref(null),
    ref('staff-3'),
    ref(null),
  )
  failingUpload.addFiles([{ name: 'failed.jpg', size: 44 }], { skipCompression: true })
  await waitForTerminalStatus(failingUpload.images)

  assert.equal(failingUpload.images.value[0]?.status, 'error')
  assert.equal(failingUpload.images.value[0]?.errorMsg, 'row write failed')
} finally {
  URL.createObjectURL = originalCreateObjectURL
  delete testGlobal.__photoUploadTestDependencies
}

console.log('use-photo-upload.dry-test: OK')
