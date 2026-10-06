import { z } from 'zod'
import { workRatesRowSchema } from '../../sheets/WorkRates/WorkRates.db-contract.js'

type WorkRatesDbRow = z.infer<typeof workRatesRowSchema>

export interface WorkRateReader {
  read(): Promise<Array<Partial<WorkRatesDbRow>>>
}

export interface WorkRate {
  taskCode: string
  department: WorkRatesDbRow['department']
  nameTh: string | null
  minutes: number
}

export type WorkRatesByTask = ReadonlyMap<string, WorkRate>

const activeWorkRateSchema = workRatesRowSchema.pick({
  task_code: true,
  department: true,
  name_th: true,
  minutes: true,
}).extend({
  name_th: z.string().nullish(),
  minutes: z.number().finite().nonnegative(),
}).strip()

let cachedRates: WorkRatesByTask | undefined
let ratesInFlight: Promise<WorkRatesByTask> | undefined

export function resetWorkRatesCache(): void {
  cachedRates = undefined
  ratesInFlight = undefined
}

export async function readWorkRates(repository: () => WorkRateReader): Promise<WorkRatesByTask> {
  if (cachedRates) return cachedRates
  if (ratesInFlight) return ratesInFlight
  const pending = Promise.resolve().then(async () => {
    try {
      const rows = await repository().read()
      const rates = new Map<string, WorkRate>()
      const seen = new Set<string>()
      const duplicated = new Set<string>()
      for (const row of rows) {
        const code = typeof row.task_code === 'string' ? row.task_code.trim() : ''
        if (code !== '') {
          if (seen.has(code)) {
            duplicated.add(code)
            rates.delete(code)
          }
          seen.add(code)
        }
        if (row.active !== true) continue
        const parsed = activeWorkRateSchema.safeParse(row)
        if (!parsed.success) {
          console.error('Ignored invalid WorkRates row', { task_code: code || null })
          continue
        }
        const taskCode = parsed.data.task_code
        if (duplicated.has(taskCode)) continue
        rates.set(taskCode, {
          taskCode,
          department: parsed.data.department,
          nameTh: parsed.data.name_th ?? null,
          minutes: parsed.data.minutes,
        })
      }
      if (duplicated.size > 0) console.error('Ignored duplicate WorkRates task codes', [...duplicated])
      if (ratesInFlight === pending) cachedRates = rates
      return rates
    } catch (error) {
      console.error('Failed to read WorkRates', error)
      return new Map<string, WorkRate>()
    }
  }).finally(() => {
    if (ratesInFlight === pending) ratesInFlight = undefined
  })
  ratesInFlight = pending
  return pending
}
