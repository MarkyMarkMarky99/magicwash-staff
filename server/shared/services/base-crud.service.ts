import {
  Mapper,
  type ApiRowFromFieldMap,
  type BaseRepository,
} from '../repositories/base.repository.js'
import type { SheetRepositoryContract } from '../repositories/sheet-repository.contract.js'
import {
  ReadQueryDTO,
  type GenericListQuery,
  type OmitReservedQueryFields,
} from '../dtos/read-query.dto.js'
import { ApiError } from '../http/api-error.js'
import { parseOrThrow } from '../http/validate.js'
import type {
  ModuleApiContractOf,
  ResponseSchema,
} from '../../../contracts/shared/module-api-contract.js'

export interface ServiceListResult<TListResponse extends object> {
  items: TListResponse[]
  pagination: {
    page: number
    perPage: number
  }
}

export type RepositoryProvider<TRepository> = TRepository | (() => TRepository)

export type JsonColumnKind = 'array' | 'object'

export interface JsonColumnDefinition {
  /** API/domain field that receives the decoded cell. */
  field: string
  /** Expected top-level JSON container and its deliberate malformed-cell fallback. */
  kind: JsonColumnKind
}

/** DB column -> decoded API field, declared by the owning module. */
export type JsonColumnMap = Readonly<Record<string, JsonColumnDefinition>>

// The read filter is DERIVED from the list query: ReadQueryDTO.fromQuery() maps
// every non-reserved list-query field into `where`, so the repository's read
// where type is exactly `OmitReservedQueryFields<TListQuery>`. There is no
// independent read-where generic and no module-written toReadQuery() bridge.
//
// Optional write/detail generics default to `never` so list-only modules get an
// uncallable create/update/getById surface (parameter type resolves to `never`).
export interface BaseCrudServiceOptions<
  TApiRow extends object,
  TListQuery extends GenericListQuery,
  TCreate = never,
  TUpdate = never,
  TListResponse extends object = object,
  TDetailResponse extends object = never,
  TCreateResponse extends object = never,
  TUpdateResponse extends object = never,
  TDbRow extends object = TApiRow,
  TFieldMap extends Partial<Record<keyof TDbRow & string, string>> = Partial<
    Record<keyof TDbRow & string, string>
  >,
> {
  /**
   * Existing modules pass an API-shaped BaseRepository. A migrated module can
   * pass a DB-shaped SheetRepositoryContract and opt into the mapping pipeline
   * with `fieldMap` (an empty map is valid) and/or `jsonColumns`.
   */
  repository: RepositoryProvider<
    | BaseRepository<TApiRow, OmitReservedQueryFields<TListQuery>, TCreate, TUpdate>
    | SheetRepositoryContract<TDbRow>
  >

  /**
   * The module's nested API contract bundle. The service reads the request/query
   * schemas it validates against from `api.query` / `api.request`, and projects
   * each response by the matching `api.response.*` schema shape.
   */
  api: ModuleApiContractOf<
    TListQuery,
    TCreate,
    TUpdate,
    TListResponse,
    TDetailResponse,
    TCreateResponse,
    TUpdateResponse
  >

  /** API/domain fields the list keyword searches against (ReadQueryDTO.fromQuery). */
  searchFields: readonly string[]

  /** DB column name -> API/domain field name for a DB-shaped repository. */
  fieldMap?: TFieldMap

  /** Explicit JSON text columns for a DB-shaped repository. */
  jsonColumns?: JsonColumnMap
}

export class BaseCrudService<
  TApiRow extends object,
  TListQuery extends GenericListQuery,
  TCreate = never,
  TUpdate = never,
  TListResponse extends object = object,
  TDetailResponse extends object = never,
  TCreateResponse extends object = never,
  TUpdateResponse extends object = never,
  TDbRow extends object = TApiRow,
  TFieldMap extends Partial<Record<keyof TDbRow & string, string>> = Partial<
    Record<keyof TDbRow & string, string>
  >,
> {
  private readonly apiRepository?: RepositoryProvider<BaseRepository<
    TApiRow,
    OmitReservedQueryFields<TListQuery>,
    TCreate,
    TUpdate
  >>
  private readonly dbRepository?: RepositoryProvider<SheetRepositoryContract<TDbRow>>
  private readonly mapper: Mapper
  private readonly jsonColumns: JsonColumnMap
  private readonly api: ModuleApiContractOf<
    TListQuery,
    TCreate,
    TUpdate,
    TListResponse,
    TDetailResponse,
    TCreateResponse,
    TUpdateResponse
  >
  private readonly searchFields: readonly string[]

  constructor(
    input: BaseCrudServiceOptions<
      TApiRow,
      TListQuery,
      TCreate,
      TUpdate,
      TListResponse,
      TDetailResponse,
      TCreateResponse,
      TUpdateResponse,
      TDbRow,
      TFieldMap
    >,
  ) {
    this.mapper = new Mapper((input.fieldMap ?? {}) as Record<string, string>)
    this.jsonColumns = input.jsonColumns ?? {}

    // The presence of an explicitly supplied mapping option selects the new
    // DB-shaped repository path. Existing consumers omit both options and
    // retain their API-shaped BaseRepository behavior exactly.
    if (input.fieldMap !== undefined || input.jsonColumns !== undefined) {
      this.dbRepository = input.repository as SheetRepositoryContract<TDbRow>
    } else {
      this.apiRepository = input.repository as BaseRepository<
        TApiRow,
        OmitReservedQueryFields<TListQuery>,
        TCreate,
        TUpdate
      >
    }
    this.api = input.api
    this.searchFields = input.searchFields
  }

  async list(query: unknown): Promise<ServiceListResult<TListResponse>> {
    const validQuery = parseOrThrow(this.api.query.list, query)
    const readQuery = ReadQueryDTO.fromQuery(validQuery, this.searchFields)
    const rows = await this.readRows(readQuery)

    return {
      items: rows.map((row) => this.project(row, this.api.response.list)),
      pagination: {
        page: validQuery.page,
        perPage: validQuery.perPage,
      },
    }
  }

  /**
   * Uncallable when the contract has no `response.detail` (TDetailResponse = never):
   * `id` resolves to `never`. Detail has no paired request slot, so this generic
   * alone is the correct capability signal.
   */
  async getById(
    id: [TDetailResponse] extends [never] ? never : string,
  ): Promise<TDetailResponse> {
    if (this.api.response.detail === undefined) {
      throw new Error('getById is not supported by this module')
    }
    const safeId = this.requireId(id as string)
    const rows = await this.readRows(
      ReadQueryDTO.fromId<OmitReservedQueryFields<TListQuery>>(safeId),
    )
    const row = this.requireSingleRow(rows, safeId)
    return this.project(row, this.api.response.detail)
  }

  /**
   * Uncallable unless BOTH `request.create` (TCreate) and `response.create`
   * (TCreateResponse) are present. Either slot missing → payload is `never`.
   */
  async create(
    payload: [TCreate] extends [never]
      ? never
      : [TCreateResponse] extends [never]
        ? never
        : unknown,
  ): Promise<TCreateResponse> {
    if (this.api.request?.create === undefined || this.api.response.create === undefined) {
      throw new Error('create is not supported by this module')
    }
    const data = parseOrThrow(this.api.request.create, payload)
    const row = await this.createRow(this.prepareCreate(data))
    return this.project(row, this.api.response.create)
  }

  /**
   * Uncallable unless BOTH `request.update` (TUpdate) and `response.update`
   * (TUpdateResponse) are present. Either slot missing → params are `never`.
   */
  async update(
    id: [TUpdate] extends [never]
      ? never
      : [TUpdateResponse] extends [never]
        ? never
        : string,
    payload: [TUpdate] extends [never]
      ? never
      : [TUpdateResponse] extends [never]
        ? never
        : unknown,
  ): Promise<TUpdateResponse> {
    if (this.api.request?.update === undefined || this.api.response.update === undefined) {
      throw new Error('update is not supported by this module')
    }
    const safeId = this.requireId(id as string)
    const data = parseOrThrow(this.api.request.update, payload)

    const rows = await this.readRows(
      ReadQueryDTO.fromId<OmitReservedQueryFields<TListQuery>>(safeId),
    )
    this.requireSingleRow(rows, safeId)

    const row = await this.updateRow(safeId, this.prepareUpdate(safeId, data))
    return this.project(row, this.api.response.update)
  }

  /**
   * Service-specific write policy hook. The public create() method has already
   * validated the untrusted API payload before this receives it.
   */
  protected prepareCreate(data: TCreate): TCreate {
    return data
  }

  /**
   * Service-specific write policy hook. The public update() method has already
   * validated both the id and untrusted API payload before this receives it.
   */
  protected prepareUpdate(_id: string, data: TUpdate): TUpdate {
    return data
  }

  private async readRows(
    query: ReadQueryDTO<OmitReservedQueryFields<TListQuery>>,
  ): Promise<Array<Partial<TApiRow>>> {
    if (this.dbRepository === undefined) {
      return resolveRepository(this.apiRepository!).read(query)
    }

    const dbRows = await resolveRepository(this.dbRepository).read(this.mapReadQueryToDb(query))
    return dbRows.map((row) => this.mapDbRowToApi(row)) as Array<Partial<TApiRow>>
  }

  private async createRow(data: TCreate): Promise<TApiRow> {
    if (this.dbRepository === undefined) {
      return resolveRepository(this.apiRepository!).create(data)
    }

    const dbRow = await resolveRepository(this.dbRepository).append(
      this.mapper.toDb(data as Record<string, unknown>) as Partial<TDbRow>,
    )
    return this.mapDbRowToApi(dbRow) as TApiRow
  }

  private async updateRow(id: string, data: TUpdate): Promise<TApiRow> {
    if (this.dbRepository === undefined) {
      return resolveRepository(this.apiRepository!).update(id, data)
    }

    const dbRow = await resolveRepository(this.dbRepository).update(
      id,
      this.mapper.toDb(data as Record<string, unknown>) as Partial<TDbRow>,
    )
    return this.mapDbRowToApi(dbRow) as TApiRow
  }

  private mapReadQueryToDb(
    query: ReadQueryDTO<OmitReservedQueryFields<TListQuery>>,
  ): ReadQueryDTO<Partial<TDbRow>> {
    return new ReadQueryDTO<Partial<TDbRow>>({
      id: query.id,
      where:
        query.where === undefined
          ? undefined
          : this.mapper.toDb(query.where as Record<string, unknown>) as Partial<TDbRow>,
      select: query.select?.map((field) => this.mapper.toDbField(field)),
      search: query.search
        ? {
            keyword: query.search.keyword,
            fields: query.search.fields.map((field) => this.mapper.toDbField(field)),
          }
        : undefined,
      sort: query.sort
        ? { field: this.mapper.toDbField(query.sort.field), order: query.sort.order }
        : undefined,
      pagination: query.pagination,
    })
  }

  private mapDbRowToApi(
    row: Partial<TDbRow>,
  ): Partial<ApiRowFromFieldMap<TDbRow, TFieldMap>> {
    return mapDbRowToApi(row, this.mapper, this.jsonColumns) as Partial<
      ApiRowFromFieldMap<TDbRow, TFieldMap>
    >
  }

  private requireId(id: string): string {
    const safeId = id.trim()
    if (safeId === '') {
      throw ApiError.badRequest('id is required')
    }
    return safeId
  }

  private requireSingleRow(rows: Array<Partial<TApiRow>>, id: string): Partial<TApiRow> {
    if (rows.length === 0) {
      throw ApiError.notFound(`Resource '${id}' not found`)
    }
    if (rows.length > 1) {
      throw ApiError.conflict(`Resource '${id}' resolved to multiple rows`)
    }
    return rows[0]
  }

  private project<TResponse extends object>(
    row: Partial<TApiRow>,
    schema: ResponseSchema<TResponse>,
  ): TResponse {
    const source = row as Record<string, unknown>
    const output: Record<string, unknown> = {}

    for (const field of Object.keys(schema.shape)) {
      output[field] = source[field]
    }

    return output as TResponse
  }
}

/**
 * Maps a DB-shaped row and decodes only the JSON columns declared by its owner.
 * This is shared with service-specific read paths that intentionally bypass
 * BaseCrudService for a different query semantic.
 */
export function mapDbRowToApi(
  row: Partial<Record<string, unknown>>,
  mapper: Mapper,
  jsonColumns: JsonColumnMap,
): Record<string, unknown> {
  const output = mapper.toApi(row as Record<string, unknown>)

  for (const [dbColumn, definition] of Object.entries(jsonColumns)) {
    if (Object.prototype.hasOwnProperty.call(row, dbColumn)) {
      output[definition.field] = decodeJsonCell(row[dbColumn], definition.kind)
    }
  }

  return output
}

function resolveRepository<TRepository>(provider: RepositoryProvider<TRepository>): TRepository {
  if (typeof provider === 'function') {
    return (provider as () => TRepository)()
  }
  return provider
}

/**
 * JSON decoding is opt-in per physical column. Blank, malformed, or wrong-kind
 * cells deliberately become [] for an array column and null for an object
 * column, keeping dirty display data from turning a list into a 500. Nested
 * keys are converted from the materialized snake_case names to API camelCase;
 * scalar values are otherwise left untouched. No unlisted cell is parsed.
 */
function decodeJsonCell(value: unknown, kind: JsonColumnKind): unknown {
  const fallback = kind === 'array' ? [] : null
  if (typeof value !== 'string' || value.trim() === '') {
    return fallback
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return fallback
  }

  if (kind === 'array' && !Array.isArray(parsed)) {
    return fallback
  }
  if (kind === 'object' && !isJsonRecord(parsed)) {
    return fallback
  }

  return camelCaseJsonKeys(parsed)
}

function camelCaseJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(camelCaseJsonKeys)
  }
  if (!isJsonRecord(value)) {
    return value
  }

  const output: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    output[key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase())] =
      camelCaseJsonKeys(nestedValue)
  }
  return output
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
