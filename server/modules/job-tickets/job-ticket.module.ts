import { bodyWithSessionActor } from '../../shared/http/session-actor.js'
import type { z } from 'zod'
import {
  jobTicketApiContract,
  jobTicketAdvanceResponseSchema,
  jobTicketStartOrderResponseSchema,
} from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { withStockTakeFreezeGuard } from '../../shared/services/stock-take-freeze.js'
import { ApiError } from '../../shared/http/api-error.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { ok, type ApiResult } from '../../shared/http/response.js'
import { JobTicketAdvanceService } from './job-ticket-advance.service.js'
import { JobTicketCompleteService, type JobTicketCompleteOrderResponse } from './job-ticket-complete.service.js'
import { JobTicketReopenService, type JobTicketReopenResponse } from './job-ticket-reopen.service.js'
import { JobTicketStartService } from './job-ticket-start.service.js'
import { JobTicketDepartmentWorkService } from './job-ticket-department-work.service.js'
import { jobTicketFieldMap } from './job-ticket.field-map.js'

export { jobTicketFieldMap } from './job-ticket.field-map.js'

type JobTicketDbRow = z.infer<typeof jobTicketsRowSchema>

type JobTicketApiRow = ApiRowFromFieldMap<JobTicketDbRow, typeof jobTicketFieldMap>
type JobTicketListQuery = z.infer<typeof jobTicketApiContract.query.list>
type JobTicketUpdate = z.infer<typeof jobTicketApiContract.request.update>
type JobTicketResponse = z.infer<typeof jobTicketApiContract.response.list>
type JobTicketStartOrderResponse = z.infer<typeof jobTicketStartOrderResponseSchema>
type JobTicketAdvanceResponse = z.infer<typeof jobTicketAdvanceResponseSchema>

export const jobTicketService = new BaseCrudService<
  JobTicketApiRow,
  JobTicketListQuery,
  never,
  JobTicketUpdate,
  JobTicketResponse,
  JobTicketResponse,
  never,
  JobTicketResponse,
  JobTicketDbRow,
  typeof jobTicketFieldMap
>({
  repository: getJobTicketsRepository,
  api: jobTicketApiContract,
  searchFields: ['id', 'orderId', 'laundryItemId', 'orderName'],
  fieldMap: jobTicketFieldMap,
  transformer: {
    request: (request) => {
      if (request.operation !== 'update') return request
      const patch = request.data as Partial<JobTicketDbRow>
      return { ...request, data: { ...patch,
        ...(patch.status === 'Completed' ? { scanned_by: patch.updated_by } : {}),
      } }
    },
  },
})

export const jobTicketReopenService = new JobTicketReopenService()
export const jobTicketCompleteService = new JobTicketCompleteService()
export const jobTicketStartService = new JobTicketStartService()
export const jobTicketAdvanceService = new JobTicketAdvanceService()

export const jobTicketDepartmentWorkService = new JobTicketDepartmentWorkService()

const crudRoutes = createCrudRoutes(jobTicketService, jobTicketApiContract, { update: ['updatedBy'] }, { update: withStockTakeFreezeGuard })

export const jobTicketRoutes: GatewayModuleRoutes = {
  collection: crudRoutes.collection,
  item: new ApiHandler({
    GET: async (req) => {
      if (req.params.id === 'department-work') return ok(await jobTicketDepartmentWorkService.list(req.query))
      return crudRoutes.item!.handleRequest(req)
    },
    PATCH: async (req) => crudRoutes.item!.handleRequest(req),
    POST: async (req): Promise<ApiResult<JobTicketStartOrderResponse | JobTicketAdvanceResponse | JobTicketCompleteOrderResponse | JobTicketReopenResponse>> => {
      if (req.params.id === 'reopen') {
        if (!req.staff || (req.staff.role !== 'admin' && req.staff.staffId !== 'AI')) throw ApiError.forbidden()
        const actor = req.staff.staffId
        const response = await withStockTakeFreezeGuard(() => jobTicketReopenService.reopen(req.body, actor))
        return { status: response.kind === 'completed' ? 200 : response.certainty === 'rejected' ? 502 : 500, body: response }
      }
      if (req.params.id === 'complete-order') {
        if (!req.staff || (req.staff.role !== 'admin' && req.staff.staffId !== 'AI')) throw ApiError.forbidden()
        const actor = req.staff.staffId
        const response = await withStockTakeFreezeGuard(() => jobTicketCompleteService.completeOrder(req.body, actor))
        return { status: response.kind === 'completed' ? 200 : response.certainty === 'rejected' ? 502 : 500, body: response }
      }
      if (req.params.id === 'start-order') {
        const payload = bodyWithSessionActor(req, 'scannedBy')
        const response = await withStockTakeFreezeGuard(() => jobTicketStartService.startOrder(payload))
        return { status: response.kind === 'completed' ? 200 : response.certainty === 'rejected' ? 502 : 500, body: response }
      }
      if (req.params.id === 'advance') {
        const payload = bodyWithSessionActor(req, 'scannedBy')
        const response = await withStockTakeFreezeGuard(() => jobTicketAdvanceService.advance(payload))
        return { status: response.kind === 'completed' ? 200 : response.certainty === 'rejected' ? 502 : 500, body: response }
      }
      throw ApiError.notFound('Route not found')
    },
  }),
}
