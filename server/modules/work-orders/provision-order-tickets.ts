import type { z } from 'zod'
import type { orderItemFormsRowSchema } from '../../sheets/OrderItemForms/OrderItemForms.db-contract.js'
import type { jobTicketsRowSchema } from '../../sheets/JobTickets/JobTickets.db-contract.js'
import type { StaffMember } from '../../shared/auth/staff-list.js'
import { classifySheetWriteFailure } from '../../shared/repositories/write-failure.js'
import { buildEarnRows } from '../work-transactions/work-transaction-earn.js'
import { buildJobTickets, type JobTicketProvisioningOrder, type JobTicketProvisioningGarment } from './job-ticket-provisioning.js'
import type { WorkRatesByTask } from './work-rate-lookup.js'
import type { JobTicketProvisioningRepository, WorkTransactionWriter } from './work-order.service.js'
import type { workOrderTicketProvisioningSchema } from '../../../contracts/work-orders/work-order-api.schema.js'

export async function provisionOrderTickets(input: {
  order: JobTicketProvisioningOrder
  lines: Array<Partial<z.infer<typeof orderItemFormsRowSchema>>>
  garments: JobTicketProvisioningGarment[]
  existingTickets: Array<Partial<z.infer<typeof jobTicketsRowSchema>>>
  rates: WorkRatesByTask
  staff: Map<string, StaffMember>
  actor: string
  jobTickets: Pick<JobTicketProvisioningRepository, 'batchAppend'>
  workTransactions: WorkTransactionWriter
}): Promise<z.infer<typeof workOrderTicketProvisioningSchema>> {
  const activeStaffIds = new Set([...input.staff.values()].map(member => member.staffId))
  const provisioning = buildJobTickets(
    { ...input.order, createdBy: input.actor },
    input.garments.map(garment => ({
      ...garment,
      taggedBy: garment.taggedBy !== null && activeStaffIds.has(garment.taggedBy) ? garment.taggedBy : null,
    })),
    input.existingTickets.flatMap(ticket =>
      typeof ticket.id === 'string' && typeof ticket.laundry_item_id === 'string' && typeof ticket.department === 'string'
        ? [{ id: ticket.id, laundryItemId: ticket.laundry_item_id, department: ticket.department,
            taskCode: typeof ticket.task_code === 'string' ? ticket.task_code : null }]
        : []),
    input.rates,
  )
  const result = { ticketsCreated: 0, scoreFailed: 0, skippedGarments: provisioning.unroutableGarments, failure: null }
  if (provisioning.rows.length === 0) return result
  try {
    await input.jobTickets.batchAppend(provisioning.rows)
  } catch (error) {
    return { ...result, failure: { certainty: classifySheetWriteFailure(error).certainty } }
  }
  const earnRows = buildEarnRows(provisioning.rows)
  let scoreFailed = 0
  if (earnRows.length > 0) {
    try {
      await input.workTransactions.batchAppend(earnRows)
    } catch (error) {
      console.error('Failed to save Tagging scores', error)
      scoreFailed = earnRows.length
    }
  }
  return { ...result, ticketsCreated: provisioning.rows.length, scoreFailed }
}
