```ts
// Repository refactor contract index

// 1. Shared repository contract and transformer
server/shared/repositories/base.repository.ts

BaseRepository<TApiRow, TReadWhere, TCreate, TUpdate>
RepositoryReadQuery<TReadWhere>   // { id?, where?, select?, search?, sort?, pagination? }
RepositoryRequest<TQuery, TData>
RepositoryTransformer
Mapper
FieldMap
primaryKey  // API/domain field name of the primary key, e.g. customerId (constructor input)

// Mapper scope
// Service calls repository with API/domain field names.
// Repository maps API/domain -> DB before database request.
// Repository maps DB -> API/domain before returning to service.
mapper.toDb(input: API/domain fields) -> DB fields
mapper.toApi(input: DB fields) -> API/domain fields
fieldMap?: FieldMap // DB column -> API field; optional, omitted = identity (no rename)
// Mapper.dbToApi = fieldMap; Mapper.apiToDb = invertFieldMap(fieldMap)
mapper: rename fields only, not projection/list-detail/business logic
Mapper maps one object only
BaseRepository maps object[] by mapping each object

// Transformer scope
// Transformer is a DB-side escape hatch.
// It runs after mapper.toDb() on request and before mapper.toApi() on response.
transformer.request(input: DB fields) -> DB fields
transformer.response(input: real DB response) -> expected *-db.schema.ts DB shape

// Read query contract
read(query?: RepositoryReadQuery<TReadWhere>) -> Promise<Array<Partial<TApiRow>>>
read() -> Promise<Array<Partial<TApiRow>>>
read({ id }) -> Promise<Array<Partial<TApiRow>>>                     // id folded into where[primaryKey]
read({ where: { customerType } }) -> Promise<Array<Partial<TApiRow>>>
read({ where, select: ['customerId'] }) -> Promise<Array<Partial<TApiRow>>>  // select projects -> Partial

id: semantic primary-key accessor; a non-empty id folds into where[primaryKey], then maps; never reaches execute()
    read: missing/blank id is ignored (no filter); update/delete require a non-empty id (else throw)
where: DB-backed API/domain fields only
select: API/domain fields
search.fields: API/domain fields
sort.field: API/domain field
pagination: query option, not DB field

// Write contract
create(data: TCreate) -> Promise<TApiRow>
create(data) -> request({ operation: 'create', data })

update(id: string, data: TUpdate) -> Promise<TApiRow>  // throws on blank id
update(id, data) -> request({ operation: 'update', query: { id }, data })  // id folded into where[primaryKey]

// 2. Google Sheets repository implementation contract
server/shared/repositories/gsheet.repository.ts

GSheetRepository<TApiRow, TDbRow, TReadWhere, TCreate, TUpdate>
GSheetRepositoryOptions<TDbRow>  // includes primaryKey (API/domain field name)
GVizFetchInput
AppScriptRequestInput<TData>
AppScriptRequest<TData>
AppScriptResponse<TData>

GSheetRepository owns transport:
fetchGVizRows(input: GVizFetchInput) -> Promise<unknown[]>
sendAppScriptRequest(input: AppScriptRequestInput<TData>) -> Promise<AppScriptResponse<TResponse>>
AppScriptRequest<TData>: { action, sheet: sheetName, data }

// GViz read query builder
server/shared/repositories/utils/gviz-query.builder.ts

deriveGVizColumns(rowSchema) -> GSheetColumnMap
GVizQueryBuilder.fromColumns(columns).fromQuery(query).build() -> string

// Apps Script write transport
create execute -> sendAppScriptRequest({ action: 'APPEND', data })
update execute -> sendAppScriptRequest({ action: 'UPDATE', data: { ...data, ...query.where } })
update merge rule: where wins (where[primaryKey] comes from the normalized id)
AppScriptResponse<TDbRow>.data -> TDbRow  // stored DB row; mapper.toApi turns it into TApiRow

Current scope:
BaseRepository.delete(id: string) -> Promise<unknown>
GSheetRepository.delete(id: string) -> future implementation

// Module type binding
// All repo generics are API/domain shapes (camelCase). The *-db.schema.ts row/payload
// schemas describe the DB shape AFTER mapper.toDb (+ transformer) — only GSheetRepository's
// TDbRow binds to the row schema, for column-letter derivation.
TApiRow: z.infer<typeof moduleApiRowSchema>           // returned shape; contracts/<m>/<m>-api.schema.ts
TDbRow: z.infer<typeof moduleRowSchema>               // DB row; *-db.schema.ts (GSheetRepository only)
TCreate: z.infer<typeof moduleCreateRequestSchema>    // API/domain input; contracts/<m>/<m>-api.schema.ts
TUpdate: z.infer<typeof moduleUpdateRequestSchema>    // API/domain input; contracts/<m>/<m>-api.schema.ts
TReadWhere: module-defined DB-backed read fields (API/domain field names)
// update/delete address a row by `id: string`; primaryKey (constructor input) names the
// API/domain field that `id` maps to before mapper.toDb resolves the DB column.

// Feature modules instantiate repository implementations directly.
// New repository classes are for storage/runtime implementations only.
const appointmentRepository =
  new GSheetRepository<
    AppointmentApiRow,       // TApiRow     — returned shape (camelCase)
    AppointmentRow,          // TDbRow      — sheet row schema (column order)
    AppointmentReadWhere,    // TReadWhere  — API/domain read filter
    AppointmentCreateInput,  // TCreate     — API/domain create input
    AppointmentUpdateInput   // TUpdate     — API/domain update input
  >({
    sheetName: 'Appointments',
    spreadsheetId: string,
    scriptUrl: string,
    rowSchema: appointmentRowSchema,
    primaryKey: 'appointmentId', // API/domain field name; id maps here, then -> DB column
    fieldMap: appointmentFieldMap, // DB column -> API field; omit when names match
    transformer?: RepositoryTransformer
  })
```
