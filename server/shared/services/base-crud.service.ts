import type { BaseRepository } from '../repositories/base.repository.js'
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
> {
  repository: BaseRepository<TApiRow, OmitReservedQueryFields<TListQuery>, TCreate, TUpdate>

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
> {
  private readonly repository: BaseRepository<
    TApiRow,
    OmitReservedQueryFields<TListQuery>,
    TCreate,
    TUpdate
  >
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
      TUpdateResponse
    >,
  ) {
    this.repository = input.repository
    this.api = input.api
    this.searchFields = input.searchFields
  }

  async list(query: unknown): Promise<ServiceListResult<TListResponse>> {
    const validQuery = parseOrThrow(this.api.query.list, query)
    const readQuery = ReadQueryDTO.fromQuery(validQuery, this.searchFields)
    const rows = await this.repository.read(readQuery)

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
    const rows = await this.repository.read(
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
    const row = await this.repository.create(this.prepareCreate(data))
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

    const rows = await this.repository.read(
      ReadQueryDTO.fromId<OmitReservedQueryFields<TListQuery>>(safeId),
    )
    this.requireSingleRow(rows, safeId)

    const row = await this.repository.update(safeId, this.prepareUpdate(safeId, data))
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
