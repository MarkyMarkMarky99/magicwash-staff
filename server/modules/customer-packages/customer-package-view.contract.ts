import { z } from 'zod'
import {
  customerPackagePortalRowSchema,
  customerPackageViewApiContract,
} from '../../../contracts/customer-packages/customer-package-view-api.schema.js'
import type { ModuleContract, ModuleDbContract } from '../../shared/contracts/module-db-contract.js'

/** Portal sheet headers already are API field names, so the row schema is shared. */
export const customerPackageViewRowSchema = customerPackagePortalRowSchema

export const customerPackageViewDbContract = {
  row: customerPackageViewRowSchema,
  fieldMap: {},
  primaryKey: 'customerPackageId',
  // `z.never()`, not an absent key: this view must never be written.
  request: { create: z.never(), update: z.never() },
  response: { read: customerPackageViewRowSchema.partial() },
} satisfies ModuleDbContract

export const customerPackageViewContract = {
  api: customerPackageViewApiContract,
  db: customerPackageViewDbContract,
} satisfies ModuleContract
