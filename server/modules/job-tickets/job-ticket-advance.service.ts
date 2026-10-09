import { jobTicketAdvanceRequestSchema } from '../../../contracts/job-tickets/job-ticket-api.schema.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { JobTicketTransitionService, type JobTicketTransitionServiceOptions, type JobTicketAdvanceResponse } from './job-ticket-transition.service.js'

export type { JobTicketAdvanceRepository, WorkTransactionAppender, JobTicketAdvanceResponse } from './job-ticket-transition.service.js'
export type JobTicketAdvanceServiceOptions = JobTicketTransitionServiceOptions

export class JobTicketAdvanceService {
  private readonly transition

  constructor(input: JobTicketAdvanceServiceOptions = {}) {
    this.transition = new JobTicketTransitionService(input)
  }

  async advance(payload: unknown): Promise<JobTicketAdvanceResponse> {
    const request = parseOrThrow(jobTicketAdvanceRequestSchema, payload)
    return this.transition.transition({ ...request,
      targetStatus: request.fromStatus === 'Pending' ? 'In Progress' : 'Completed',
      allowedSourceStatuses: [request.fromStatus],
    })
  }
}
