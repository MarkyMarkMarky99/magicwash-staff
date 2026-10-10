import type { MachineDto } from '@/data/machines/machines.service'
import { formatKgFigure } from './format-weights'

export type MachineMode = 'washer' | 'dryer'

export const machineTypeWord = { WSH: 'Washer', DRY: 'Dryer' } as const

export function modeOfMachineId(machineId: string | null): MachineMode {
  return machineId?.startsWith('DRY') ? 'dryer' : 'washer'
}

export function machineLabel(machineId: string | null, machines: readonly MachineDto[]): string {
  if (!machineId) return ''
  const machine = machines.find(item => item.id === machineId)
  if (!machine || machine.capacityKg === null) return machineId
  return `${machineTypeWord[machine.type]} ${formatKgFigure(machine.capacityKg)} kg`
}
