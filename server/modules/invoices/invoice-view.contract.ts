import { z } from 'zod'
import {
  invoicePortalRowSchema,
  invoiceViewApiContract,
} from '../../../contracts/invoices/invoice-view-api.schema.js'
import type { ModuleContract, ModuleDbContract } from '../../shared/contracts/module-db-contract.js'

/**
 * `InvoicesView` is a materialized portal read model. Its headers deliberately
 * match the shared frontend/backend row contract, including nested JSON fields
 * such as customer, items, adjustments, and payments.
 *
 * Key order remains the physical sheet column order for GViz query generation.
 */
export const invoiceViewRowSchema = invoicePortalRowSchema

export const invoiceViewDbContract = {
  row: invoiceViewRowSchema,
  // Portal sheet headers already are API field names; no rename map is needed.
  fieldMap: {},
  primaryKey: 'invoiceNumber',
  // `z.never()`, not an absent key: declares "this view must never be
  // written" as intent — GSheetRepository's isUnsupportedDbOperation gates
  // create()/update() off EITHER an absent slot or a z.never() one, so this
  // still rejects at runtime exactly as before.
  request: { create: z.never(), update: z.never() },
  response: { read: invoiceViewRowSchema.partial() },
} satisfies ModuleDbContract

export const invoiceViewContract = {
  api: invoiceViewApiContract,
  db: invoiceViewDbContract,
} satisfies ModuleContract
