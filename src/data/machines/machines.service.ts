import type { z } from 'zod'
import type { machineRowSchema } from '@contracts/machines/machines-api.schema'
import { apiGet } from '@/shared/api/api-client'

export type MachineDto = z.infer<typeof machineRowSchema>

let requestSequence = 0
export function listMachines(): Promise<MachineDto[]> {
  return apiGet<MachineDto[]>(`/api/machines?request=${++requestSequence}`)
}
