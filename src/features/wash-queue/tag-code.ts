import type { MachineDto } from '@/data/machines/machines.service'

// O is left out so it is never read as zero.
const TAG_LETTERS = { WSH: 'ABCDEFGHIJKLM', DRY: 'NPQRSTUVWXYZ' } as const
export const TAG_CODE_PATTERN = /^[A-Z]\d{3}$/

export function machineTagLetter(machineId: string | null, machines: readonly MachineDto[]): string | null {
  const machine = machines.find(item => item.id === machineId)
  if (!machine) return null
  const sameType = machines.filter(item => item.type === machine.type).sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      if (a.sortOrder === null) return 1
      if (b.sortOrder === null) return -1
      return a.sortOrder - b.sortOrder
    }
    return a.id.localeCompare(b.id)
  })
  return TAG_LETTERS[machine.type][sameType.indexOf(machine)] ?? null
}

export function nextTagCode(letter: string, rows: readonly { tagCode: string | null; createdAt: string }[], today: string): string | null {
  let max = 0
  for (const row of rows) {
    if (!row.createdAt.startsWith(today) || !row.tagCode || !TAG_CODE_PATTERN.test(row.tagCode) || row.tagCode[0] !== letter) continue
    max = Math.max(max, Number(row.tagCode.slice(1)))
  }
  return max < 999 ? `${letter}${String(max + 1).padStart(3, '0')}` : null
}
