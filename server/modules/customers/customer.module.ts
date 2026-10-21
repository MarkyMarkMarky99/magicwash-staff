import { bodyWithSessionActor } from '../../shared/http/session-actor.js'
import { z } from 'zod'
import { customerApiContract } from '../../../contracts/customers/customer-api.schema.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { ApiError } from '../../shared/http/api-error.js'
import { ApiHandler } from '../../shared/http/api-handler.js'
import { created, okPaged } from '../../shared/http/response.js'
import { getCustomersRepository } from '../../sheets/Customers/Customers.repository.js'
import { customersRowSchema } from '../../sheets/Customers/Customers.db-contract.js'
import { CustomerRegistrationService } from './customer-registration.service.js'
import { requireAvailableCustomerPhone } from './customer-phone.js'

type CustomerDbRow = z.infer<typeof customersRowSchema>

export const customerFieldMap = {
  Timestamp: 'timestamp',
  CustomerID: 'customerId',
  CustomerIndex: 'customerIndex',
  CustomerName: 'customerName',
  Phone: 'phone',
  Address: 'address',
  Location: 'location',
  RegisteredDate: 'registeredDate',
  Facebook: 'facebook',
  Line: 'lineId',
  Whatsapp: 'whatsapp',
  Email: 'email',
  CustomerType: 'customerType',
  Source: 'source',
  ScheduledDays: 'scheduledDays',
  LastVisitDate: 'lastVisitDate',
  PreferredContactMethod: 'preferredContactMethod',
  UpdatedAt: 'updatedAt',
  UpdatedBy: 'updatedBy',
  DeletedAt: 'deletedAt',
  PriceGroup: 'priceGroup',
} as const satisfies Record<keyof CustomerDbRow & string, string>

type CustomerApiRow = ApiRowFromFieldMap<CustomerDbRow, typeof customerFieldMap>
type CustomerListQuery = z.infer<typeof customerApiContract.query.list>
type CustomerCreate = z.infer<typeof customerApiContract.request.create>
type CustomerUpdate = z.infer<typeof customerApiContract.request.update>
type CustomerListResponse = z.infer<typeof customerApiContract.response.list>
type CustomerDetailResponse = z.infer<typeof customerApiContract.response.detail>
type CustomerCreateResponse = z.infer<typeof customerApiContract.response.create>
type CustomerUpdateResponse = z.infer<typeof customerApiContract.response.update>

type CustomerService = BaseCrudService<
  CustomerApiRow,
  CustomerListQuery,
  CustomerCreate,
  CustomerUpdate,
  CustomerListResponse,
  CustomerDetailResponse,
  CustomerCreateResponse,
  CustomerUpdateResponse,
  CustomerDbRow,
  typeof customerFieldMap
>

export const customerService: CustomerService = new BaseCrudService({
  repository: () => {
    const repository = getCustomersRepository()
    return {
      read: repository.read.bind(repository),
      append: repository.append.bind(repository),
      update: async (customerId: string, patch: Partial<CustomerDbRow>) => {
        if (typeof patch.Phone === 'string') {
          requireAvailableCustomerPhone(await repository.read(), patch.Phone, customerId)
        }
        return repository.update(customerId, patch)
      },
    }
  },
  api: customerApiContract,
  searchFields: ['customerIndex', 'customerName', 'address'],
  fieldMap: customerFieldMap,
})

export const customerRegistrationService = new CustomerRegistrationService()
const crudRoutes = createCrudRoutes(customerService, customerApiContract, { create: ['updatedBy'], update: ['updatedBy'] })
export const customerRoutes = {
  ...crudRoutes,
  item: new ApiHandler({
    GET: async (req) => crudRoutes.item!.handleRequest(req),
    PATCH: async (req) => {
      if (req.staff?.role !== 'admin') throw ApiError.forbidden()
      return crudRoutes.item!.handleRequest(req)
    },
  }),
  collection: new ApiHandler({
    GET: async (req) => {
      const { items, pagination } = await customerService.list(req.query)
      return okPaged(items, pagination)
    },
    POST: async (req) => created(await customerRegistrationService.create(bodyWithSessionActor(req, 'updatedBy'))),
  }),
}
