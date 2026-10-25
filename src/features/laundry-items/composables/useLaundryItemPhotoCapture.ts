import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useGarmentPhotoUploads, type GarmentUploadStatus } from '@/shared/composables/useGarmentPhotoUploads'
import type { GarmentPhotoType } from '../utils/laundry-item-detail'

interface Capture { id: string, previewUrl: string, photoType: GarmentPhotoType, orderId: string | null }

export interface GarmentPhotoSave { photoType: GarmentPhotoType, orderId: string | null, imageUrl: string }

export interface GarmentPhotoProblem {
  key: number
  kind: 'upload' | 'save'
  id: string
  message: string
  busy: boolean
}

export interface GarmentPhotoPreviewItem { id: string, src: string, status?: GarmentUploadStatus }

export function useLaundryItemPhotoCapture(options: { orderId: () => string | null, save: (request: GarmentPhotoSave) => Promise<void> }) {
  const uploads = useGarmentPhotoUploads()
  const captures = ref<Capture[]>([])
  const problems = ref<GarmentPhotoProblem[]>([])
  const active = ref(0)
  const inFlight = new Set<string>()
  let sequence = 0
  let problemKey = 0
  let disposed = false

  const items = computed<GarmentPhotoPreviewItem[]>(() => [...captures.value].reverse()
    .map(capture => ({ id: capture.id, src: capture.previewUrl, status: uploads.uploads[capture.id]?.status })))
  const saving = computed(() => active.value > 0)

  function find(id: string): Capture | undefined {
    return captures.value.find(capture => capture.id === id)
  }

  function release(id: string, deleteFile: boolean): void {
    const index = captures.value.findIndex(capture => capture.id === id)
    if (index >= 0) {
      URL.revokeObjectURL(captures.value[index].previewUrl)
      captures.value.splice(index, 1)
    }
    if (deleteFile) uploads.remove(id)
    else uploads.forget(id)
  }

  function settled(id: string): Promise<GarmentUploadStatus | undefined> {
    const current = () => uploads.uploads[id]?.status
    return new Promise(resolve => {
      if (current() !== 'uploading') { resolve(current()); return }
      const stop = watch(current, status => {
        if (status === 'uploading') return
        stop()
        resolve(status)
      })
    })
  }

  function drop(problem: GarmentPhotoProblem): void {
    const index = problems.value.indexOf(problem)
    if (index >= 0) problems.value.splice(index, 1)
  }

  function report(kind: GarmentPhotoProblem['kind'], id: string, message: string): void {
    problems.value.push(reactive({ key: ++problemKey, kind, id, message, busy: false }))
  }

  async function persist(capture: Capture): Promise<void> {
    const imageUrl = uploads.uploads[capture.id]?.url
    if (!imageUrl) return
    inFlight.add(capture.id)
    try {
      await options.save({ photoType: capture.photoType, orderId: capture.orderId, imageUrl })
      release(capture.id, false)
    } catch (reason) {
      if (disposed) release(capture.id, true)
      else report('save', capture.id, reason instanceof Error ? reason.message : 'Unable to save photo')
    } finally {
      inFlight.delete(capture.id)
    }
  }

  async function resolveUpload(id: string, resolved?: GarmentPhotoProblem): Promise<void> {
    const status = await settled(id)
    if (resolved) drop(resolved)
    const capture = find(id)
    if (!capture || disposed) return
    if (status === 'done') await persist(capture)
    else if (status === 'failed') report('upload', id, 'Photo did not upload.')
  }

  async function add(file: File, photoType: GarmentPhotoType): Promise<void> {
    const id = `garment-photo-${++sequence}`
    captures.value.push({ id, previewUrl: URL.createObjectURL(file), photoType, orderId: options.orderId() })
    uploads.start(id, file)
    active.value += 1
    try {
      await resolveUpload(id)
    } finally {
      active.value -= 1
    }
  }

  async function retry(problem: GarmentPhotoProblem): Promise<void> {
    if (problem.busy) return
    const capture = find(problem.id)
    if (!capture) { drop(problem); return }
    problem.busy = true
    active.value += 1
    try {
      if (problem.kind === 'upload') {
        uploads.retry(problem.id)
        await resolveUpload(problem.id, problem)
      } else {
        await persist(capture)
        drop(problem)
      }
    } finally {
      active.value -= 1
    }
  }

  function dismiss(problem: GarmentPhotoProblem): void {
    if (problem.busy) return
    release(problem.id, true)
    drop(problem)
  }

  onScopeDispose(() => {
    disposed = true
    captures.value.map(capture => capture.id).filter(id => !inFlight.has(id)).forEach(id => release(id, true))
  })

  return { items, problems, saving, add, retry, dismiss }
}
