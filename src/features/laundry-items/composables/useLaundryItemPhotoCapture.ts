import { computed, onScopeDispose, reactive, ref, watch } from 'vue'
import { useGarmentPhotoUploads, type GarmentUploadStatus } from '@/shared/composables/useGarmentPhotoUploads'
import type { GarmentPhotoType } from '../utils/laundry-item-detail'

interface Capture { id: string, previewUrl: string, photoType: GarmentPhotoType, session: boolean }

export interface GarmentPhotoSave { photoType: GarmentPhotoType, orderId: string | null, imageUrls: string[] }

export interface GarmentPhotoProblem {
  key: number
  kind: 'upload' | 'save'
  ids: string[]
  photoType: GarmentPhotoType
  orderId: string | null
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

  function add(file: File, photoType: GarmentPhotoType): void {
    const id = `garment-photo-${++sequence}`
    captures.value.push({ id, previewUrl: URL.createObjectURL(file), photoType, session: true })
    uploads.start(id, file)
  }

  function release(ids: readonly string[], deleteFiles: boolean): void {
    for (const id of ids) {
      const index = captures.value.findIndex(capture => capture.id === id)
      if (index >= 0) {
        URL.revokeObjectURL(captures.value[index].previewUrl)
        captures.value.splice(index, 1)
      }
      if (deleteFiles) uploads.remove(id)
      else uploads.forget(id)
    }
  }

  function settled(ids: readonly string[]): Promise<void> {
    const done = () => ids.every(id => uploads.uploads[id]?.status !== 'uploading')
    return new Promise(resolve => {
      if (done()) { resolve(); return }
      const stop = watch(done, finished => {
        if (!finished) return
        stop()
        resolve()
      })
    })
  }

  function drop(problem: GarmentPhotoProblem): void {
    const index = problems.value.indexOf(problem)
    if (index >= 0) problems.value.splice(index, 1)
  }

  function report(kind: GarmentPhotoProblem['kind'], ids: string[], photoType: GarmentPhotoType, orderId: string | null, message: string): void {
    problems.value.push(reactive({ key: ++problemKey, kind, ids, photoType, orderId, message, busy: false }))
  }

  async function saveIds(ids: string[], photoType: GarmentPhotoType, orderId: string | null): Promise<void> {
    ids.forEach(id => inFlight.add(id))
    try {
      await options.save({ photoType, orderId, imageUrls: ids.map(id => uploads.uploads[id]!.url!) })
      release(ids, false)
    } catch (reason) {
      if (disposed) release(ids, true)
      else report('save', ids, photoType, orderId, reason instanceof Error ? reason.message : 'Unable to save photos')
    } finally {
      ids.forEach(id => inFlight.delete(id))
    }
  }

  async function resolveIds(ids: string[], photoType: GarmentPhotoType, orderId: string | null): Promise<void> {
    const uploaded = ids.filter(id => uploads.uploads[id]?.status === 'done')
    const failed = ids.filter(id => uploads.uploads[id]?.status === 'failed')
    if (failed.length > 0) {
      report('upload', failed, photoType, orderId, `${failed.length} ${failed.length === 1 ? 'photo' : 'photos'} did not upload.`)
    }
    if (uploaded.length > 0) await saveIds(uploaded, photoType, orderId)
  }

  async function finish(): Promise<void> {
    const session = captures.value.filter(capture => capture.session)
    if (session.length === 0) return
    const orderId = options.orderId()
    const byType = new Map<GarmentPhotoType, string[]>()
    for (const capture of session) {
      capture.session = false
      byType.set(capture.photoType, [...(byType.get(capture.photoType) ?? []), capture.id])
    }
    active.value += 1
    try {
      await settled(session.map(capture => capture.id))
      for (const [photoType, ids] of byType) await resolveIds(ids, photoType, orderId)
    } finally {
      active.value -= 1
    }
  }

  async function retry(problem: GarmentPhotoProblem): Promise<void> {
    if (problem.busy) return
    problem.busy = true
    active.value += 1
    try {
      if (problem.kind === 'upload') {
        problem.ids.forEach(id => uploads.retry(id))
        await settled(problem.ids)
        drop(problem)
        await resolveIds(problem.ids, problem.photoType, problem.orderId)
      } else {
        await saveIds(problem.ids, problem.photoType, problem.orderId)
        drop(problem)
      }
    } finally {
      active.value -= 1
    }
  }

  function dismiss(problem: GarmentPhotoProblem): void {
    if (problem.busy) return
    release(problem.ids, true)
    drop(problem)
  }

  onScopeDispose(() => {
    disposed = true
    release(captures.value.map(capture => capture.id).filter(id => !inFlight.has(id)), true)
  })

  return { items, problems, saving, add, finish, retry, dismiss }
}
