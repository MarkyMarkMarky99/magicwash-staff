import type { z } from 'zod'
import { washQueueCreateSchema, washQueueUpdateSchema, type washQueueRowSchema } from '@contracts/wash-queue/wash-queue-api.schema'
import { apiGet, apiPost, apiPatch } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'
import { uploadToStorage } from '@/shared/api/firebase-storage'

type WashQueueDto = z.infer<typeof washQueueRowSchema>
type WashQueueCreate = z.infer<typeof washQueueCreateSchema>
type WashQueueUpdate = z.infer<typeof washQueueUpdateSchema>

const endpoint = '/api/wash-queue'
let requestSequence = 0
export function uploadWashQueuePhoto(file: File): Promise<string> {
  return uploadToStorage(file, 'wash-queue')
}
export function listWashQueue(): Promise<WashQueueDto[]> {
  return apiGet<WashQueueDto[]>(`${endpoint}?request=${++requestSequence}`)
}
export async function createWashQueue(payload: WashQueueCreate): Promise<WashQueueDto> {
  try {
    return await apiPost<WashQueueDto>(endpoint, { data: payload, requestSchema: washQueueCreateSchema })
  } finally {
    invalidate(endpoint)
  }
}
export async function actOnWashQueue(id: string, body: WashQueueUpdate): Promise<WashQueueDto> {
  try {
    return await apiPatch<WashQueueDto>(`${endpoint}/${encodeURIComponent(id)}`, {
      data: body, requestSchema: washQueueUpdateSchema,
    })
  } finally {
    invalidate(endpoint)
  }
}
