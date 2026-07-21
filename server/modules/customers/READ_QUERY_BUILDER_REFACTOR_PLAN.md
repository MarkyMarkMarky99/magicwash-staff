```ts
// Problem:
// ReadQueryDTO is the DTO contract between Service and Repository.
// Every module must currently write its own toXReadQuery().
// This repeats the same mapping pattern:
//   API query -> ReadQueryDTO

// Current customer example:
toCustomerReadQuery(query: CustomerListQuery)
  -> RepositoryReadQuery<CustomerReadWhere>

// Repeated concerns:
keyword -> search
filter fields -> where
sortBy / sortOrder -> sort
page / perPage -> pagination

// Requirement:
// create one shared DTO + alternate constructor for this mapping.
// Module should only declare search fields.

// Customer-specific input should only express:
search fields

// The shared DTO constructor must output:
ReadQueryDTO<TWhere>

// The shared builder/mapper must not:
map DB columns
build GViz/SQL query strings
know Google Sheets
know module-specific business beyond config

// Desired result:
// customer.module.ts should not manually implement toCustomerReadQuery().

// Contract:
// DTO instance is data-only.
// fromQuery() is an alternate constructor, same idea as Python classmethod.
// fromId() is also an alternate constructor, same idea as Python classmethod.

class ReadQueryDTO<TWhere> {
  readonly id?: string
  readonly where?: TWhere
  readonly search?: RepositorySearch
  readonly sort?: RepositorySort
  readonly pagination?: RepositoryPagination

  constructor(input: {
    id?: string
    where?: TWhere
    search?: RepositorySearch
    sort?: RepositorySort
    pagination?: RepositoryPagination
  })

  static fromQuery<TQuery extends GenericListQuery>(
    query: TQuery,
    searchFields: readonly string[],
  ) -> ReadQueryDTO<OmitReservedQueryFields<TQuery>>

  static fromId<TWhere>(id: string) -> ReadQueryDTO<TWhere>
}

type GenericListQuery = {
  keyword: string
  page: number
  perPage: number
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

type OmitReservedQueryFields<TQuery> =
  Omit<TQuery, 'keyword' | 'page' | 'perPage' | 'sortBy' | 'sortOrder'>

// Contract changes:
BaseRepository.read(query?: RepositoryReadQuery<TReadWhere>)
  -> BaseRepository.read(query?: ReadQueryDTO<TReadWhere>)

GSheetRepository.read(query?: RepositoryReadQuery<TReadWhere>)
  -> GSheetRepository.read(query?: ReadQueryDTO<TReadWhere>)

BaseCrudServiceOptions.toReadQuery(query)
  -> removed

// BaseCrudService list:
// fromQuery() is a static alternate constructor:
// validated URL query -> ReadQueryDTO instance
ReadQueryDTO.fromQuery(validQuery, searchFields)
  -> ReadQueryDTO<TWhere>
  -> repository.read(readQueryDTO)

BaseCrudService.list(rawQuery)
  -> listQuerySchema.parse(rawQuery)
  -> ReadQueryDTO.fromQuery(validQuery, searchFields)
  -> repository.read(readQueryDTO)
  -> project listResponseSchema.shape
  -> { items, pagination: { page, perPage } }

// BaseCrudService getById:
// fromId() is a static alternate constructor:
// semantic id -> ReadQueryDTO instance
ReadQueryDTO.fromId<TWhere>(id)
  -> ReadQueryDTO<TWhere>
  -> repository.read(readQueryDTO)

BaseCrudService.getById(id)
  -> validate / trim id
  -> ReadQueryDTO.fromId(id)
  -> repository.read(readQueryDTO)
  -> missing row -> throw 404
  -> multiple rows -> throw 409
  -> project detailResponseSchema.shape

BaseCrudService.create(rawPayload)
  -> createSchema.parse(rawPayload)
  -> repository.create(parsedPayload)
  -> project createResponseSchema.shape

BaseCrudService.update(id, rawPayload)
  -> validate / trim id
  -> updateSchema.parse(rawPayload)
  -> ReadQueryDTO.fromId(id)
  -> repository.read(readQueryDTO)
  -> missing row -> throw 404
  -> multiple rows -> throw 409
  -> repository.update(id, parsedPayload)
  -> project updateResponseSchema.shape

BaseCrudServiceOptions.toReadQuery
  -> removed

BaseCrudServiceOptions.searchFields
  -> readonly string[]

// Repository:
repository.read(query?: ReadQueryDTO<TReadWhere>)
  -> Promise<Array<Partial<TApiRow>>>

// Customer example:
ReadQueryDTO.fromQuery(
  query,
  ['customerIndex', 'customerName', 'address'],
)
  -> ReadQueryDTO<{
       customerType: CustomerListQuery['customerType']
     }>

// fromQuery convention:
query.keyword -> search.keyword
query.page / query.perPage -> pagination
query.sortBy / query.sortOrder -> sort
all other query fields -> where

// Current repository behavior:
where -> equality filters only

// Future repository behavior:
where may support operations/range/null/or after repository contract evolves.
```
