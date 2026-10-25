import { reactive } from 'vue'
import { uploadLaundryPhoto } from '@/data/laundry-photos/laundry-photo.service'
import { deleteFromStorage } from '@/shared/api/firebase-storage'

export type GarmentUploadStatus = 'uploading' | 'done' | 'failed'
export interface GarmentUpload { status: GarmentUploadStatus, url: string | null }

interface Entry { file: File, removed: boolean }

export function useGarmentPhotoUploads() {
  const uploads = reactive<Record<string, GarmentUpload>>({})
  const entries = new Map<string, Entry>()

  async function deleteQuietly(url: string): Promise<void> {
    try {
      await deleteFromStorage(url)
    } catch (reason) {
      console.warn('[garment-upload] could not delete file', reason)
    }
  }

  async function run(id: string, entry: Entry): Promise<void> {
    uploads[id] = { status: 'uploading', url: null }
    try {
      const url = await uploadLaundryPhoto(entry.file)
      if (entry.removed) {
        await deleteQuietly(url)
        return
      }
      uploads[id] = { status: 'done', url }
    } catch {
      if (!entry.removed) uploads[id] = { status: 'failed', url: null }
    }
  }

  function start(id: string, file: File): void {
    const entry: Entry = { file, removed: false }
    entries.set(id, entry)
    void run(id, entry)
  }

  function retry(id: string): void {
    const entry = entries.get(id)
    if (!entry || uploads[id]?.status !== 'failed') return
    void run(id, entry)
  }

  function remove(id: string): void {
    const entry = entries.get(id)
    const url = uploads[id]?.url ?? null
    if (entry) entry.removed = true
    entries.delete(id)
    delete uploads[id]
    if (url) void deleteQuietly(url)
  }

  function forget(id: string): void {
    entries.delete(id)
    delete uploads[id]
  }

  function discardAll(): void {
    for (const id of [...entries.keys()]) remove(id)
  }

  return { uploads, start, retry, remove, forget, discardAll }
}
