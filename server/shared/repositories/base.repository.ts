// Storage-agnostic repository contract + shared pipeline.

import type {
  ReadQueryDTO,
  ReadQueryPagination,
  ReadQuerySearch,
  ReadQuerySort,
} from '../dtos/read-query.dto.js'

export type RepositoryOperation = 'read' | 'create' | 'update' | 'delete'

/**
 * DB column name -> API/domain field name (e.g. `{ CustomerID: 'customerId' }`),
 * matching the owning module's field map. Omit a column for an identity rename.
 */
export type FieldMap = Record<string, string>

export type ApiRowFromFieldMap<
  TDbRow extends object,
  TFieldMap extends Partial<Record<keyof TDbRow & string, string>>,
> = {
  [K in keyof TDbRow & string as K extends keyof TFieldMap
    ? TFieldMap[K] extends string
      ? TFieldMap[K]
      : K
    : K]: TDbRow[K]
}

/**
 * Internal, mutable, DB-field-named read query — the post-mapping shape produced
 * by mapQueryToDb() and consumed by execute() / the GViz builder. It is NOT the
 * public read contract: the service passes a ReadQueryDTO<TWhere> (immutable,
 * API/domain-field-named) into read(); BaseRepository maps it down to this shape.
 *
 * It carries no `id`: the semantic `id` is folded into where[primaryKey] during
 * mapping, so it never reaches execute().
 */
export interface MappedReadQuery<TWhere> {
  where?: TWhere
  select?: readonly string[]
  search?: ReadQuerySearch
  sort?: ReadQuerySort
  pagination?: ReadQueryPagination
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

  /** DB-side response escape hatch: output must match the owning sheet row shape. */
  response?(
    response: unknown,
    context: RepositoryTransformerContext,
  ): MaybePromise<unknown>
}

/**
 * Renames object keys between DB column names and API/domain field names.
 * `fieldMap` is DB column -> API field, declared by the owning module.
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
    assertBijectiveFieldMap(fieldMap)
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

  /** API/domain field name -> DB column name for query controls. */
  toDbField(field: string): string {
    return this.apiToDb[field] ?? field
  }
}

// All generics are API/domain shapes (camelCase) — what the service passes in and
// gets back. mapper.toDb (+ transformer.request) turn inputs into the physical
// sheet DB shape the storage layer sees; the DB shape is never a generic here
// (it lives on the storage implementation, e.g. SheetRepository's TDbRow).
//   TApiRow    -> row the repo RETURNS (contracts/<m>/<m>-api.schema.ts)
//   TReadWhere -> read filter (DB-backed API/domain fields)
//   TCreate    -> create input the service passes in
//   TUpdate    -> update input the service passes in
// update(id)/delete(id) take the API/domain primaryKey value (a string); the
// repository normalizes it into where[primaryKey] before the DB request.
export abstract class BaseRepository<
  TApiRow extends object,
  TReadWhere,
  TCreate,
  TUpdate,
> {
  protected readonly mapper: Mapper
  /** API/domain field name -> DB column name, for single-field query renames. */
  private readonly apiToDb: FieldMap
  /** API/domain field name of the primary key, e.g. `customerId`. */
  private readonly primaryKey: string
  private readonly transformer?: RepositoryTransformer

  protected constructor(input: {
    fieldMap?: FieldMap
    primaryKey: string
    transformer?: RepositoryTransformer
  }) {
    const fieldMap = input.fieldMap ?? {}
    this.mapper = new Mapper(fieldMap)
    this.apiToDb = invertFieldMap(fieldMap)
    this.primaryKey = input.primaryKey
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
      query: this.mapQueryToDb(request.query, request.operation),
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

  // Public surface is API/domain-shaped. read() takes the immutable
  // ReadQueryDTO (API/domain field names) and may return a projection (select),
  // so each row is a Partial of the API row; every present field is an API field
  // the mapper resolved.
  abstract read(query?: ReadQueryDTO<TReadWhere>): Promise<Array<Partial<TApiRow>>>
  abstract create(data: TCreate): Promise<TApiRow>
  // update/delete address a single row by its API/domain primary-key value.
  abstract update(id: string, data: TUpdate): Promise<TApiRow>
  abstract delete(id: string): Promise<unknown>

  /** Renames the DB-backed parts of a read/update query; leaves the rest untouched. */
  private mapQueryToDb(query: unknown, operation: RepositoryOperation): unknown {
    if (!query || typeof query !== 'object') {
      // create carries no query; read() with no query means "read all". A
      // row-addressing write with no query is a contract breach, so still demand
      // its id rather than silently writing nothing.
      if (operation === 'update' || operation === 'delete') {
        throw new Error(`Repository ${operation} requires a non-empty id`)
      }
      return query
    }

    const source = query as ReadQueryDTO<Record<string, unknown>>
    const mapped: MappedReadQuery<Record<string, unknown>> = {}

    // Fold the semantic `id` into where[primaryKey] so it maps like any other
    // DB-backed field; `id` itself is never forwarded to execute().
    const where = this.resolveWhere(source, operation)
    if (where) {
      mapped.where = this.mapper.toDb(where)
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

  /**
   * Resolves the where filter, honouring the semantic `id` accessor per
   * operation:
   *   - read: `id` is an optional filter. A missing or blank id is ignored and
   *     the existing where is used as-is (never folds `''`, which the GViz
   *     builder would silently drop, losing the primary-key filter).
   *   - update/delete: `id` addresses a single row, so a non-empty id is
   *     required; a missing/blank id throws.
   * When a non-empty id is present it is folded into where[primaryKey] (the
   * API/domain field name), winning over any explicit where[primaryKey].
   */
  private resolveWhere(
    source: ReadQueryDTO<Record<string, unknown>>,
    operation: RepositoryOperation,
  ): Record<string, unknown> | undefined {
    const id = source.id
    const hasId = typeof id === 'string' && id.trim() !== ''

    if ((operation === 'update' || operation === 'delete') && !hasId) {
      throw new Error(`Repository ${operation} requires a non-empty id`)
    }
    if (!hasId) {
      return source.where
    }
    return { ...source.where, [this.primaryKey]: id }
  }
}

function invertFieldMap(fieldMap: FieldMap): FieldMap {
  const inverted: FieldMap = {}
  for (const [dbColumn, apiField] of Object.entries(fieldMap)) {
    inverted[apiField] = dbColumn
  }
  return inverted
}

function assertBijectiveFieldMap(fieldMap: FieldMap): void {
  const dbColumnByApiField = new Map<string, string>()
  for (const [dbColumn, apiField] of Object.entries(fieldMap)) {
    const previousDbColumn = dbColumnByApiField.get(apiField)
    if (previousDbColumn !== undefined) {
      throw new Error(
        `Field map is not bijective: DB columns '${previousDbColumn}' and '${dbColumn}' both map to API field '${apiField}'`,
      )
    }
    dbColumnByApiField.set(apiField, dbColumn)
  }
}

function renameKeys(input: Record<string, unknown>, map: FieldMap): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    output[map[key] ?? key] = value
  }
  return output
}
