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
  request: {}, // no create/update/delete — explicit empty object, not omitted
  response: { read: invoiceViewRowSchema.partial() },
} satisfies ModuleDbContract

export const invoiceViewContract = {
  api: invoiceViewApiContract,
  db: invoiceViewDbContract,
} satisfies ModuleContract
