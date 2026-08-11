import { z } from 'zod'
import { customerApiContract } from '../../../contracts/customers/customer-api.schema.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import { getCustomersRepository } from '../../sheets/Customers/Customers.repository.js'
import { customersRowSchema } from '../../sheets/Customers/Customers.db-contract.js'

type CustomerDbRow = z.infer<typeof customersRowSchema>

/** `Line` maps to the API's `lineId` field. */
export const customerFieldMap = {
  Timestamp: 'timestamp',
  CustomerID: 'customerId',
  CustomerIndex: 'customerIndex',
  CustomerName: 'customerName',
  // Phone passes through as stored text; reads do not normalize it.
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
  repository: getCustomersRepository,
  api: customerApiContract,
  searchFields: ['customerIndex', 'customerName', 'address'],
  fieldMap: customerFieldMap,
})

export const customerRoutes = createCrudRoutes(customerService, customerApiContract)
