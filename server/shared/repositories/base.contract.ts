// Reference contract for the repository layer (no runtime implementation).
// The live implementation lives in ./base.repository.ts and must satisfy
// the signatures declared here. Kept for design reference only.

import type {
  ReadQueryDTO,
  ReadQueryPagination,
  ReadQuerySearch,
  ReadQuerySort,
} from '../dtos/read-query.dto'

export type RepositoryOperation = 'read' | 'create' | 'update' | 'delete'

/** DB column name -> API/domain field name (matches each module's `<m>-db.schema.ts`). */
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

// Internal, mutable, DB-field-named read query — the post-mapping shape produced
// by BaseRepository.mapQueryToDb() and consumed by execute() / the GViz builder.
// It is NOT the public read contract: read() takes the immutable, API/domain-
// field-named ReadQueryDTO<TWhere> (see ../dtos/read-query.dto).
//
// BaseRepository maps only DB-backed fields (where -> mapper.toDb; select /
// search.fields / sort.field -> DB field names) and does not map search.keyword,
// sort.order, or pagination. The semantic `id` is folded into where[primaryKey]
// during mapping, so it never reaches execute(): on read a missing/blank id is
// ignored (no filter); update/delete require a non-empty id (else they throw
// `Repository <operation> requires a non-empty id`).
export interface MappedReadQuery<TWhere> {
  where?: TWhere
  select?: readonly string[]
  search?: ReadQuerySearch
  sort?: ReadQuerySort
  pagination?: ReadQueryPagination
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
//   TApiRow    -> row the repo RETURNS (contracts/<m>/<m>-api.schema.ts)
//   TReadWhere -> read filter (DB-backed API/domain fields)
//   TCreate    -> create input the service passes in (API/domain)
//   TUpdate    -> update input the service passes in (API/domain)
// update(id)/delete(id) take the API/domain primaryKey value (a string); the
// repository folds it into where[primaryKey] before the DB request.
// mapper.toDb (+ transformer.request) turn inputs into the *-db.schema.ts DB shape
// the storage layer / Apps Script sees.
export declare abstract class BaseRepository<
  TApiRow extends object,
  TReadWhere,
  TCreate,
  TUpdate,
> {
  protected constructor(input: {
    fieldMap?: FieldMap
    /** API/domain field name of the primary key, e.g. `customerId`. */
    primaryKey: string
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

  // read() takes the immutable ReadQueryDTO and may project (select), so rows
  // are Partial of the API row.
  abstract read(query?: ReadQueryDTO<TReadWhere>): Promise<Array<Partial<TApiRow>>>
  // create(data) -> request({ operation: 'create', data })
  abstract create(data: TCreate): Promise<TApiRow>
  // update(id, data) -> request({ operation: 'update', query: { id }, data })
  abstract update(id: string, data: TUpdate): Promise<TApiRow>
  // delete(id) -> request({ operation: 'delete', query: { id } })
  abstract delete(id: string): Promise<unknown>
}
