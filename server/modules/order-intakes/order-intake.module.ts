import { getItemsRepository } from '../../sheets/Items/Items.repository.js'
import { getLaundryItemsRepository } from '../../sheets/LaundryItems/LaundryItems.repository.js'
import { getOrderFormRepository } from '../../sheets/OrderForm/OrderForm.repository.js'
import { getOrderItemFormsRepository } from '../../sheets/OrderItemForms/OrderItemForms.repository.js'
import { getOrderGarmentsRepository } from '../../sheets/OrderGarments/OrderGarments.repository.js'
import { getOrderImagesRepository } from '../../sheets/OrderImages/OrderImages.repository.js'
import { getJobTicketsRepository } from '../../sheets/JobTickets/JobTickets.repository.js'
import { getWorkTransactionsRepository } from '../../sheets/WorkTransactions/WorkTransactions.repository.js'
import { getWorkRatesRepository } from '../../sheets/WorkRates/WorkRates.repository.js'
import { getStaffList } from '../../shared/auth/staff-list.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import type { GatewayModuleRoutes } from '../../shared/http/gateway.types.js'
import { created } from '../../shared/http/response.js'
import { requireStaffId } from '../../shared/http/session-actor.js'
import { OrderIntakeService } from './order-intake.service.js'

export const orderIntakeService = new OrderIntakeService({
  items: { read: query => getItemsRepository().read(query) },
  laundryItems: {
    read: query => getLaundryItemsRepository().read(query),
    updateMany: updates => getLaundryItemsRepository().updateMany(updates),
  },
  findTags: tags => {
    const repository = getLaundryItemsRepository()
    const query = repository.queryBuilder()
    return repository.readRaw(`select * where ${tags.map(tag => `${query.col('id')} = ${query.lit('id', tag)}`).join(' or ')}`)
  },
  orders: {
    batchAppend: rows => getOrderFormRepository().batchAppend(rows),
    update: (id, patch) => getOrderFormRepository().update(id, patch),
  },
  lines: { batchAppend: rows => getOrderItemFormsRepository().batchAppend(rows) },
  garments: { batchAppend: rows => getOrderGarmentsRepository().batchAppend(rows) },
  images: { batchAppend: rows => getOrderImagesRepository().batchAppend(rows) },
  jobTickets: { batchAppend: rows => getJobTicketsRepository().batchAppend(rows) },
  workTransactions: { batchAppend: rows => getWorkTransactionsRepository().batchAppend(rows) },
  workRates: getWorkRatesRepository,
  staff: getStaffList,
  now: () => new Date(),
})

export function createOrderIntakeRoutes(service: Pick<OrderIntakeService, 'create'> = orderIntakeService): GatewayModuleRoutes {
  return {
    collection: new ApiHandler({
      POST: async req => created(await service.create(req.body, requireStaffId(req))),
    }),
  }
}

export const orderIntakeRoutes = createOrderIntakeRoutes()
