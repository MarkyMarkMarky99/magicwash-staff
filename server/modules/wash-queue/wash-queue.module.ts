import { z } from 'zod'
import { washQueueApiContract } from '../../../contracts/wash-queue/wash-queue-api.schema.js'
import { generateShortId } from '../../../shared/utils/id.js'
import { bangkokToday, normalizeSheetTimestamp, toNullableString } from '../../../shared/utils/bangkok-datetime.js'
import { ApiHandler, type ApiHandlerRequest } from '../../shared/http/api-handler.js'
import { ApiError } from '../../shared/http/api-error.js'
import { ok, created } from '../../shared/http/response.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import { getMachinesRepository } from '../../sheets/Machines/Machines.repository.js'
import { getWashQueueRepository } from '../../sheets/WashQueue/WashQueue.repository.js'
import type { washQueueRowSchema } from '../../sheets/WashQueue/WashQueue.db-contract.js'

type WashQueueDto = z.infer<typeof washQueueApiContract.response.list>
type WashQueueDbRow = z.infer<typeof washQueueRowSchema>

function toNullableNumber(value: number | string | null | undefined): number | null {
  return value === undefined || value === null || String(value) === '' ? null : Number(value)
}

function toDto(row: Partial<WashQueueDbRow>): WashQueueDto {
  return {
    id: String(row.id ?? ''),
    status: row.status!,
    photoUrl: String(row.photo_url ?? ''),
    instruction: toNullableString(row.instruction),
    workMinutes: toNullableNumber(row.work_minutes),
    loadedAt: normalizeSheetTimestamp(row.loaded_at) || null,
    loadedBy: toNullableString(row.loaded_by),
    unloadedAt: normalizeSheetTimestamp(row.unloaded_at) || null,
    unloadedBy: toNullableString(row.unloaded_by),
    collectedAt: normalizeSheetTimestamp(row.collected_at) || null,
    collectedBy: toNullableString(row.collected_by),
    cancelledAt: normalizeSheetTimestamp(row.cancelled_at) || null,
    cancelledBy: toNullableString(row.cancelled_by),
    createdAt: normalizeSheetTimestamp(row.created_at),
    createdBy: String(row.created_by ?? ''),
    updatedAt: normalizeSheetTimestamp(row.updated_at),
    updatedBy: String(row.updated_by ?? ''),
    weightBeforeKg: toNullableNumber(row.weight_before_kg),
    weightAfterKg: toNullableNumber(row.weight_after_kg),
    unloadPhotoUrl: toNullableString(row.unload_photo_url),
    machineId: toNullableString(row.machine_id),
    tagCode: toNullableString(row.tag_code),
  }
}

function actor(req: ApiHandlerRequest): string {
  if (!req.staff) throw ApiError.unauthorized()
  return req.staff.staffId
}

const transitions = {
  load: { from: ['Pending'], to: 'In Progress', at: 'loaded_at', by: 'loaded_by', message: 'This basket is no longer waiting. It may already be loaded or cancelled.' },
  unload: { from: ['In Progress'], to: 'Completed', at: 'unloaded_at', by: 'unloaded_by', message: 'This basket is no longer in a machine. It may already be unloaded.' },
  collect: { from: ['Completed'], to: 'Collected', at: 'collected_at', by: 'collected_by', message: 'This basket is no longer ready for pickup. It may already be collected.' },
  cancel: { from: ['Pending', 'In Progress', 'Completed'], to: 'Cancelled', at: 'cancelled_at', by: 'cancelled_by', message: 'Cannot cancel this basket. It may already be collected or cancelled.' },
} as const

export const washQueueRoutes = {
  collection: new ApiHandler({
    GET: async (req) => {
      parseOrThrow(washQueueApiContract.query.list, req.query)
      const today = bangkokToday()
      const rows = (await getWashQueueRepository().read()).map(toDto)
        .filter((row) => ['Pending', 'In Progress', 'Completed'].includes(row.status) ||
          (['Collected', 'Cancelled'].includes(row.status) && row.updatedAt.slice(0, 10) === today))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      return ok(rows)
    },
    POST: async (req) => {
      const body = parseOrThrow(washQueueApiContract.request.create, req.body)
      const staffId = actor(req)
      const machines = await getMachinesRepository().read()
      if (!machines.some((machine) => machine.id === body.machineId && machine.status === 'ACTIVE')) {
        throw ApiError.validation('Choose an available machine.')
      }
      const row = await getWashQueueRepository().append({
        id: 'WQ-' + generateShortId(), status: 'Pending', photo_url: body.photoUrl,
        instruction: body.instruction ?? null, work_minutes: null,
        loaded_at: null, loaded_by: null, unloaded_at: null, unloaded_by: null,
        collected_at: null, collected_by: null, cancelled_at: null, cancelled_by: null,
        created_by: staffId, updated_by: staffId,
        weight_before_kg: body.weightBeforeKg, weight_after_kg: null,
        unload_photo_url: null, machine_id: body.machineId, tag_code: body.tagCode,
      })
      return created(toDto(row))
    },
  }),
  item: new ApiHandler({
    PATCH: async (req) => {
      const id = parseOrThrow(z.string().trim().min(1), req.params.id)
      const body = parseOrThrow(washQueueApiContract.request.update, req.body)
      const staffId = actor(req)
      const [row] = await getWashQueueRepository().read({ id })
      if (!row) throw ApiError.notFound('Basket not found.')
      const transition = transitions[body.action]
      if (!row.status || !(transition.from as readonly string[]).includes(row.status)) throw ApiError.conflict(transition.message)
      const updated = await getWashQueueRepository().update(id, {
        status: transition.to, [transition.at]: formatBangkokTimestamp(new Date()),
        [transition.by]: staffId, updated_by: staffId,
        ...(body.action === 'unload' ? {
          weight_after_kg: body.weightAfterKg, unload_photo_url: body.unloadPhotoUrl,
        } : {}),
      })
      return ok(toDto(updated))
    },
  }),
}
