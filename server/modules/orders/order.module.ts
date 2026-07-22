import { orderContract } from './order.contract.js'
import { GSheetRepository } from '../../shared/repositories/gsheet.repository.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { requireEnv } from '../../shared/utils/env.js'
import { createOrdersTransformer } from './orders.transformer.js'

// ── Data access: standard GSheetRepository against the OrdersView sheet.
//    Read-only: the contract has no write slots; create/update are uncallable
//    at compile time and throw at runtime before any Apps Script write. ──
const ordersRepository = new GSheetRepository({
  contract: orderContract,
  sheetName: 'OrdersView',
  spreadsheetId: requireEnv('ORDERS_SPREADSHEET_ID'),
  // Required by GSheetRepository constructor; unused for this list-only module
  // (writes are guarded before fetch). Same shared Apps Script URL as other modules.
  scriptUrl: requireEnv('APPSCRIPT_URL'),
  transformer: createOrdersTransformer(),
})

// ── API behavior: BaseCrudService.list only. searchFields is [] — today's
//    OrdersService had no keyword search; adding ['orderNumber'] would be new
//    functionality, out of scope for this shape-conformance refactor. ──
export const ordersService = new BaseCrudService({
  repository: ordersRepository,
  api: orderContract.api,
  searchFields: [],
})

export const orderRoutes = createCrudRoutes(ordersService, orderContract.api)
