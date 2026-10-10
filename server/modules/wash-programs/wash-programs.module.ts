import type { z } from 'zod'
import { washProgramsApiContract, washProgramRowSchema } from '../../../contracts/wash-programs/wash-programs-api.schema.js'
import { washStepSchema } from '../../../contracts/wash-queue/wash-queue-api.schema.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import { ok } from '../../shared/http/response.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { getWashProgramsRepository } from '../../sheets/WashPrograms/WashPrograms.repository.js'

type Program = z.infer<typeof washProgramRowSchema>
export async function listWashPrograms(): Promise<Program[]> {
  const groups = new Map<string, { program: Omit<Program, 'steps'>; steps: { order: number; step: Program['steps'][number] }[] }>()
  for (const row of await getWashProgramsRepository().read()) {
    const id = String(row.program_id ?? '').trim()
    if (!id || id === 'CUSTOM') continue
    let group = groups.get(id)
    if (!group) {
      group = { program: { id, name: String(row.program_name ?? ''), status: row.status!,
        sortOrder: typeof row.sort_order === 'number' && Number.isFinite(row.sort_order) ? row.sort_order : null }, steps: [] }
      groups.set(id, group)
    }
    const order = Number(row.step_no)
    if (!Number.isInteger(order) || order < 1) continue
    const candidate: Record<string, unknown> = { type: row.step_type,
      products: String(row.products ?? '').split(',').map((id) => id.trim()).filter(Boolean) }
    if (row.step_type === 'quick_wash' || row.step_type === 'normal_wash') candidate.temperature = String(row.temperature ?? '').trim() || 'cold'
    if (row.step_type === 'soak') {
      const duration = String(row.duration ?? '').trim()
      candidate.duration = duration.toLowerCase() === 'overnight' ? 'overnight' : duration === '' ? null : Number(duration)
    }
    const step = washStepSchema.safeParse(candidate)
    if (step.success) group.steps.push({ order, step: step.data })
  }
  const programs: Program[] = []
  for (const group of groups.values()) {
    const result = washProgramRowSchema.safeParse({ ...group.program,
      steps: group.steps.sort((a, b) => a.order - b.order).map(({ step }) => step) })
    if (result.success) programs.push(result.data)
  }
  return programs.sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity) || a.id.localeCompare(b.id))
}
export const washProgramsRoutes = {
  collection: new ApiHandler({ GET: async (req) => {
    parseOrThrow(washProgramsApiContract.query.list, req.query)
    return ok(await listWashPrograms())
  } }),
}
