import type { z } from 'zod'
import {
  jobTicketApiContract,
  jobTicketScanResponseSchema,
} from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { ApiError } from '../../shared/http/api-error.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import type { ApiResult } from '../../shared/http/response.js'
import { JobTicketScanService } from './job-ticket-scan.service.js'

type JobTicketDbRow = z.infer<typeof jobTicketsRowSchema>

export const jobTicketFieldMap = {
  id: 'id',
  order_id: 'orderId',
  laundry_item_id: 'laundryItemId',
  scope: 'scope',
  service_type: 'serviceType',
  department: 'department',
  step_no: 'stepNo',
  customer_id: 'customerId',
  order_name: 'orderName',
  due_date: 'dueDate',
  special_instructions: 'specialInstructions',
  notes: 'notes',
  status: 'status',
  started_at: 'startedAt',
  completed_at: 'completedAt',
  scanned_by: 'scannedBy',
  photo_evidence_url: 'photoEvidenceUrl',
  created_at: 'createdAt',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
} as const satisfies Record<keyof JobTicketDbRow & string, string>

type JobTicketApiRow = ApiRowFromFieldMap<JobTicketDbRow, typeof jobTicketFieldMap>
type JobTicketListQuery = z.infer<typeof jobTicketApiContract.query.list>
type JobTicketUpdate = z.infer<typeof jobTicketApiContract.request.update>
type JobTicketResponse = z.infer<typeof jobTicketApiContract.response.list>
type JobTicketScanResponse = z.infer<typeof jobTicketScanResponseSchema>

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
})

export const jobTicketScanService = new JobTicketScanService()

const crudRoutes = createCrudRoutes(jobTicketService, jobTicketApiContract)

function statusForScan(response: JobTicketScanResponse): number {
  switch (response.kind) {
    case 'advanced':
    case 'already_completed':
      return 200
    case 'not_found':
      return 404
    case 'blocked':
      return 409
    case 'write_failed':
      return response.certainty === 'rejected' ? 502 : 500
  }
}

export const jobTicketRoutes: GatewayModuleRoutes = {
  collection: crudRoutes.collection,
  item: new ApiHandler({
    GET: async (req) => crudRoutes.item!.handleRequest(req),
    PATCH: async (req) => crudRoutes.item!.handleRequest(req),
    POST: async (req): Promise<ApiResult<JobTicketScanResponse>> => {
      if (req.params.id !== 'scan') throw ApiError.notFound('Route not found')
      const response = await jobTicketScanService.scan(req.body)
      return { status: statusForScan(response), body: response }
    },
  }),
}
