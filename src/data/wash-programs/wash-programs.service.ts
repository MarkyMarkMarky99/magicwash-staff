import type { z } from 'zod'
import type { washProgramRowSchema } from '@contracts/wash-programs/wash-programs-api.schema'
import { apiGet } from '@/shared/api/api-client'

export type WashProgramDto = z.infer<typeof washProgramRowSchema>

let requestSequence = 0
export function listWashPrograms(): Promise<WashProgramDto[]> {
  return apiGet<WashProgramDto[]>(`/api/wash-programs?request=${++requestSequence}`)
}
