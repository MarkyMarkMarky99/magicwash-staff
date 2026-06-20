```ts
// Goal:
// customers -> BaseCrudService + GSheetRepository

// legacy-only; do not import in new implementation
server/shared/google-sheets
server/shared/sheet-crud

// remove from customerListQuerySchema
includeDeleted

// no delete flow
customerService.delete -> not implemented
repository.delete -> must not be called

// customer route
GET /api/customers
  customerService.list(req.query)
  -> { items, pagination: { page, perPage } }
  -> okPaged(items, pagination)

POST /api/customers
  customerService.create(req.body)
  -> created(response)

GET /api/customers/:id
  customerService.getById(req.params.id)
  -> ok(response)

PATCH /api/customers/:id
  customerService.update(req.params.id, req.body)
  -> ok(response)

// types
type CustomerDbRow = z.infer<typeof customerRowSchema>
type CustomerListQuery = z.infer<typeof customerListQuerySchema>
type CustomerCreate = z.infer<typeof customerCreateSchema>
type CustomerUpdate = z.infer<typeof customerUpdateSchema>

// full API/domain row after repository mapper.toApi()
// not listResponse/detailResponse
type CustomerApiRow = {
  timestamp: CustomerDbRow['Timestamp']
  customerId: CustomerDbRow['CustomerID']
  customerIndex: CustomerDbRow['CustomerIndex']
  customerName: CustomerDbRow['CustomerName']
  phone: CustomerDbRow['Phone']
  address: CustomerDbRow['Address']
  location: CustomerDbRow['Location']
  registeredDate: CustomerDbRow['RegisteredDate']
  facebook: CustomerDbRow['Facebook']
  lineId: CustomerDbRow['Line']
  whatsapp: CustomerDbRow['Whatsapp']
  email: CustomerDbRow['Email']
  customerType: CustomerDbRow['CustomerType']
  source: CustomerDbRow['Source']
  scheduledDays: CustomerDbRow['ScheduledDays']
  lastVisitDate: CustomerDbRow['LastVisitDate']
  preferredContactMethod: CustomerDbRow['PreferredContactMethod']
  updatedAt: CustomerDbRow['UpdatedAt']
  updatedBy: CustomerDbRow['UpdatedBy']
  deletedAt: CustomerDbRow['DeletedAt']
}

// repository
new GSheetRepository<
  CustomerApiRow,
  CustomerDbRow,
  CustomerReadWhere,
  CustomerCreate,
  CustomerUpdate
>({
  sheetName: 'Customers',
  spreadsheetId: process.env.CUSTOMERS_SPREADSHEET_ID,
  scriptUrl: process.env.APPSCRIPT_URL,
  rowSchema: customerRowSchema,
  primaryKey: 'customerId',
  fieldMap: customerFieldMap,
})

// read query
type CustomerReadWhere = {
  customerType?: CustomerListQuery['customerType']
}

toCustomerReadQuery(query: CustomerListQuery)
  -> RepositoryReadQuery<CustomerReadWhere>
  -> {
       where: { customerType: query.customerType ?? undefined },
       search: { keyword, fields: ['customerIndex', 'customerName', 'address'] },
       sort: { field: sortBy, order: sortOrder },
       pagination: { page, perPage },
     }

// service
new BaseCrudService({
  repository: customerRepository,
  listQuerySchema: customerListQuerySchema,
  createSchema: customerCreateSchema,
  updateSchema: customerUpdateSchema,
  listResponseSchema: customerListResponseSchema,
  detailResponseSchema: customerDetailResponseSchema,
  createResponseSchema: customerCreateResponseSchema,
  updateResponseSchema: customerUpdateResponseSchema,
  toReadQuery: toCustomerReadQuery,
})

// write payload behavior
create(payload)
  -> customerCreateSchema.parse(payload)
  -> repo.create(parsed)
  -> no fill null
  -> omitted optional field is not sent
  -> explicit null is sent as null

update(id, payload)
  -> customerUpdateSchema.parse(payload)
  -> repo.update(id, parsed)
  -> no fill null
  -> omitted optional field is not sent
  -> explicit null is sent as null

// out of scope
phone normalization
soft-delete filtering
includeDeleted query
new query operators
customer-specific repository subclass
```
