// Storage-agnostic repository contract + shared pipeline.
// Reference design: ./base.contract.ts

export type RepositoryOperation = 'read' | 'create' | 'update' | 'delete'

/**
 * DB column name -> API/domain field name (e.g. `{ CustomerID: 'customerId' }`),
 * matching each module's `<m>-db.schema.ts` field map. Omit a column for an
 * identity rename.
 */
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
  // select / search.fields / sort.field -> API/domain field names to DB field names
  //
  // BaseRepository does not map: search.keyword, sort.order, pagination
  where?: TWhere
  select?: readonly string[]
  search?: RepositorySearch
  sort?: RepositorySort
  pagination?: RepositoryPagination
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

/**
 * Renames object keys between DB column names and API/domain field names.
 * `fieldMap` is DB column -> API field (the module's `<m>-db.schema.ts` map).
 * Rename only — no projection, list/detail split, or business logic.
 * Maps one object; BaseRepository maps arrays by mapping each element.
 */
export class Mapper {
  /** DB column name -> API/domain field name. */
  private readonly dbToApi: FieldMap
  /** API/domain field name -> DB column name. */
  private readonly apiToDb: FieldMap

  constructor(fieldMap: FieldMap = {}) {
    this.dbToApi = { ...fieldMap }
    this.apiToDb = invertFieldMap(fieldMap)
  }

  /** DB column names -> API/domain field names. */
  toApi<TOutput extends object = Record<string, unknown>>(
    input: Record<string, unknown>,
  ): TOutput {
    return renameKeys(input, this.dbToApi) as TOutput
  }

  /** API/domain field names -> DB column names. */
  toDb<TOutput extends object = Record<string, unknown>>(
    input: Record<string, unknown>,
  ): TOutput {
    return renameKeys(input, this.apiToDb) as TOutput
  }
}

// All generics are API/domain shapes (camelCase) — what the service passes in and
// gets back. mapper.toDb (+ transformer.request) turn inputs into the
// *-db.schema.ts DB shape the storage layer sees; the DB shape is never a generic
// here (it lives on the storage impl, e.g. GSheetRepository's TDbRow).
//   TApiRow       -> row the repo RETURNS (contracts/<m>/<m>-api.schema.ts)
//   TReadWhere    -> read filter (DB-backed API/domain fields)
//   TCreate       -> create input the service passes in
//   TUpdateFilter -> update filter (e.g. { id: string })
//   TUpdate       -> update input the service passes in
//   TDeleteFilter -> delete filter
export abstract class BaseRepository<
  TApiRow extends object,
  TReadWhere,
  TCreate,
  TUpdateFilter,
  TUpdate,
  TDeleteFilter = TUpdateFilter,
> {
  protected readonly mapper: Mapper
  /** API/domain field name -> DB column name, for single-field query renames. */
  private readonly apiToDb: FieldMap
  private readonly transformer?: RepositoryTransformer

  protected constructor(input: {
    fieldMap?: FieldMap
    transformer?: RepositoryTransformer
  }) {
    const fieldMap = input.fieldMap ?? {}
    this.mapper = new Mapper(fieldMap)
    this.apiToDb = invertFieldMap(fieldMap)
    this.transformer = input.transformer
  }

  /**
   * request() pipeline:
   *   API fields
   *   -> mapper.toDb(query/data)
   *   -> transformer.request
   *   -> execute(db fields)
   *   -> transformer.response
   *   -> mapper.toApi(response)
   *   -> API fields
   */
  protected async request<TResponse, TQuery = unknown, TData = unknown>(
    request: RepositoryRequest<TQuery, TData>,
  ): Promise<TResponse> {
    const dbRequest: RepositoryRequest<unknown, unknown> = {
      operation: request.operation,
      query: this.mapQueryToDb(request.query),
      data:
        request.data === undefined
          ? undefined
          : this.mapper.toDb(request.data as Record<string, unknown>),
    }

    const finalRequest = this.transformer?.request
      ? await this.transformer.request(dbRequest)
      : dbRequest

    const rawResponse = await this.execute<unknown>(finalRequest)

    const dbResponse = this.transformer?.response
      ? await this.transformer.response(rawResponse, { request: finalRequest })
      : rawResponse

    return this.mapResponseToApi(dbResponse) as TResponse
  }

  // Subclass storage operation; called only by request().
  protected abstract execute<TResponse, TQuery = unknown, TData = unknown>(
    request: RepositoryRequest<TQuery, TData>,
  ): Promise<TResponse>

  // Public surface is API/domain-shaped. read() may return a projection
  // (select), so each row is a Partial of the API row; every present field is
  // an API field the mapper resolved.
  abstract read(query?: RepositoryReadQuery<TReadWhere>): Promise<Array<Partial<TApiRow>>>
  abstract create(data: TCreate): Promise<TApiRow>
  abstract update(filter: TUpdateFilter, data: TUpdate): Promise<TApiRow>
  abstract delete(filter: TDeleteFilter): Promise<unknown>

  /** Renames the DB-backed parts of a read/update query; leaves the rest untouched. */
  private mapQueryToDb(query: unknown): unknown {
    if (!query || typeof query !== 'object') {
      return query
    }

    const source = query as RepositoryReadQuery<Record<string, unknown>>
    const mapped: RepositoryReadQuery<Record<string, unknown>> = {}

    if (source.where) {
      mapped.where = this.mapper.toDb(source.where)
    }
    if (source.select) {
      mapped.select = source.select.map((field) => this.toDbField(field))
    }
    if (source.search) {
      mapped.search = {
        keyword: source.search.keyword,
        fields: source.search.fields.map((field) => this.toDbField(field)),
      }
    }
    if (source.sort) {
      mapped.sort = { field: this.toDbField(source.sort.field), order: source.sort.order }
    }
    if (source.pagination) {
      mapped.pagination = source.pagination
    }

    return mapped
  }

  private mapResponseToApi(response: unknown): unknown {
    if (Array.isArray(response)) {
      return response.map((item) => this.mapper.toApi(item as Record<string, unknown>))
    }
    if (response && typeof response === 'object') {
      return this.mapper.toApi(response as Record<string, unknown>)
    }
    return response
  }

  private toDbField(field: string): string {
    return this.apiToDb[field] ?? field
  }
}

function invertFieldMap(fieldMap: FieldMap): FieldMap {
  const inverted: FieldMap = {}
  for (const [dbColumn, apiField] of Object.entries(fieldMap)) {
    inverted[apiField] = dbColumn
  }
  return inverted
}

function renameKeys(input: Record<string, unknown>, map: FieldMap): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    output[map[key] ?? key] = value
  }
  return output
}
