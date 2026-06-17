// Reference contract for the repository layer (no runtime implementation).
// The live implementation lives in ./base.repository.ts and must satisfy
// the signatures declared here. Kept for design reference only.

export type RepositoryOperation = 'read' | 'create' | 'update' | 'delete'

/** DB column name -> API/domain field name (matches each module's `<m>-db.schema.ts`). */
export type FieldMap = Record<string, string>

export interface RepositorySearch {
  keyword: string
  fields: readonly string[]
}

export interface RepositorySort {
  field: string
  order: 'asc' | 'desc'
}

export interface RepositoryPagination {
  page: number
  perPage: number
}

export interface RepositoryReadQuery<TWhere> {
  // BaseRepository maps only DB-backed query fields:
  // where -> mapper.toDb()
  // select -> field names to DB field names
  // search.fields -> field names to DB field names
  // sort.field -> field name to DB field name
  //
  // BaseRepository does not map:
  // search.keyword
  // sort.order
  // pagination
  where?: TWhere
  select?: readonly string[]
  search?: RepositorySearch
  sort?: RepositorySort
  pagination?: RepositoryPagination
}

export declare class Mapper {
  // fieldMap is DB column -> API field; toDb uses its inverse.
  constructor(fieldMap: FieldMap)

  /** DB column names -> API/domain field names. */
  toApi<TOutput extends object = Record<string, unknown>>(
    input: Record<string, unknown>,
  ): TOutput

  /** API/domain field names -> DB column names. */
  toDb<TOutput extends object = Record<string, unknown>>(
    input: Record<string, unknown>,
  ): TOutput
}

export interface RepositoryRequest<TQuery = unknown, TData = unknown> {
  operation: RepositoryOperation
  query?: TQuery
  data?: TData
}

export type MaybePromise<T> = T | Promise<T>

export interface RepositoryTransformerContext {
  request: RepositoryRequest<unknown, unknown>
}

export interface RepositoryTransformer {
  /** DB-side request escape hatch: input/output are DB field names. */
  request?(
    request: RepositoryRequest<unknown, unknown>,
  ): MaybePromise<RepositoryRequest<unknown, unknown>>

  /** DB-side response escape hatch: output must match the expected *-db.schema.ts shape. */
  response?(
    response: unknown,
    context: RepositoryTransformerContext,
  ): MaybePromise<unknown>
}

// Generics split the two row contracts; every generic here is an API/domain shape
// (camelCase). The DB shape (TDbRow) is NOT a base generic — it lives on the
// storage impl (GSheetRepository) because base never sees rowSchema / column order.
//   TApiRow       -> row the repo RETURNS (contracts/<m>/<m>-api.schema.ts)
//   TReadWhere    -> read filter (DB-backed API/domain fields)
//   TCreate       -> create input the service passes in (API/domain)
//   TUpdateFilter -> update filter (e.g. { id: string })
//   TUpdate       -> update input the service passes in (API/domain)
//   TDeleteFilter -> delete filter
// mapper.toDb (+ transformer.request) turn inputs into the *-db.schema.ts DB shape
// the storage layer / Apps Script sees.
export declare abstract class BaseRepository<
  TApiRow extends object,
  TReadWhere,
  TCreate,
  TUpdateFilter,
  TUpdate,
  TDeleteFilter = TUpdateFilter,
> {
  protected constructor(input: {
    fieldMap?: FieldMap
    transformer?: RepositoryTransformer
  })

  // BaseRepository.request() pipeline:
  // service/API fields
  // -> mapper.toDb(query/data)
  // -> transformer.request
  // -> execute(db fields)
  // -> transformer.response
  // -> mapper.toApi(response)
  // -> service/API fields
  //
  // Response mapping:
  // object -> mapper.toApi(object)
  // object[] -> object[].map(mapper.toApi)
  protected request<TResponse, TQuery = unknown, TData = unknown>(
    request: RepositoryRequest<TQuery, TData>,
  ): Promise<TResponse>

  // Subclass storage operation; called only by request().
  protected abstract execute<TResponse, TQuery = unknown, TData = unknown>(
    request: RepositoryRequest<TQuery, TData>,
  ): Promise<TResponse>

  // read() may project (select), so rows are Partial of the API row.
  abstract read(query?: RepositoryReadQuery<TReadWhere>): Promise<Array<Partial<TApiRow>>>
  // create(data) -> request({ operation: 'create', data })
  abstract create(data: TCreate): Promise<TApiRow>
  // update(filter, data) -> request({ operation: 'update', query: { where: filter }, data })
  abstract update(filter: TUpdateFilter, data: TUpdate): Promise<TApiRow>
  abstract delete(filter: TDeleteFilter): Promise<unknown>
}
