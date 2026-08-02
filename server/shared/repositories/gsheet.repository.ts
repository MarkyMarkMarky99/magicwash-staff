// Google Sheets implementation of BaseRepository.
// Owns all transport detail: GViz query strings + reads, Apps Script writes.

import type { z } from 'zod'
import {
  BaseRepository,
  type ApiRowFromFieldMap,
  type MappedReadQuery,
  type RepositoryRequest,
  type RepositoryTransformer,
} from './base.repository.js'
import { type ReadQueryDTO, type OmitReservedQueryFields } from '../dtos/read-query.dto.js'
import type { ModuleContract } from '../contracts/module-db-contract.js'
import {
  deriveGVizColumns,
  GVizQueryBuilder,
  type GSheetColumnMap,
} from './utils/gviz-query.builder.js'
import { fetchGVizRows } from './utils/gviz-reader.js'
import { requireEnv } from '../utils/env.js'

// ── Repository types derived from the exact module contract. The DB row drives the
//    mapped API row (via the field map); the API bundle drives the read filter and
//    the create/update inputs. These are private — modules wire by passing the
//    whole `contract`, never by restating these. ──
type ModuleDbRow<TContract extends ModuleContract> = z.infer<TContract['db']['row']>

type ModuleApiRow<TContract extends ModuleContract> = ApiRowFromFieldMap<
  ModuleDbRow<TContract>,
  TContract['db']['fieldMap']
>

type ModuleListQuery<TContract extends ModuleContract> = z.infer<TContract['api']['query']['list']>

type ModuleReadWhere<TContract extends ModuleContract> = OmitReservedQueryFields<
  ModuleListQuery<TContract>
>

/** Resolves to `never` when the API contract has no `request.create` slot. */
type ModuleCreate<TContract extends ModuleContract> = TContract['api'] extends {
  request: { create: infer S }
}
  ? S extends z.ZodTypeAny
    ? z.infer<S>
    : never
  : never

/** Resolves to `never` when the API contract has no `request.update` slot. */
type ModuleUpdate<TContract extends ModuleContract> = TContract['api'] extends {
  request: { update: infer S }
}
  ? S extends z.ZodTypeAny
    ? z.infer<S>
    : never
  : never

export type AppScriptAction = 'APPEND' | 'UPDATE'

export interface SheetLibRequestInput<TData = unknown> {
  action: AppScriptAction
  data: TData
  keyValue?: string
}

export interface SheetLibRequest<TData = unknown> {
  resource: 'sheet'
  action: AppScriptAction
  target: string
  data: TData
  key_value?: string
}

export interface SheetLibSuccessResponse<TData = unknown> {
  status: 'ok'
  target: string
  data: TData
  write?: Record<string, unknown>
}

export interface SheetLibErrorResponse {
  status: 'error'
  message: string
}

export type SheetLibResponse<TData = unknown> =
  | SheetLibSuccessResponse<TData>
  | SheetLibErrorResponse

export interface GSheetRepositoryOptions<TContract extends ModuleContract> {
  /**
   * The complete module contract. Runtime DB config (`db.row` / `db.fieldMap` /
   * `db.primaryKey`) and the inferred API-facing method types both come from here,
   * so callers never repeat generic arguments or schema options.
   */
  contract: TContract
  sheetName: string
  /** SheetLib write target. Required for APPEND and UPDATE; never inferred from sheetName. */
  target?: string
  /** Env var KEY NAME holding the spreadsheet id — resolved via `requireEnv` at construction time. */
  spreadsheetId: string
  /** Env var KEY NAME holding the Apps Script URL. Defaults to `APPSCRIPT_URL`; tests may override it. */
  scriptUrl?: string
  /** Decode JSON object/array text cells for a preprocessed portal sheet. */
  decodeJsonCells?: boolean
  transformer?: RepositoryTransformer
}

export class GSheetRepository<TContract extends ModuleContract> extends BaseRepository<
  ModuleApiRow<TContract>,
  ModuleReadWhere<TContract>,
  ModuleCreate<TContract>,
  ModuleUpdate<TContract>
> {
  private readonly sheetName: string
  private readonly target?: string
  private readonly spreadsheetId: string
  private readonly scriptUrl: string
  private readonly primaryKeyColumn: string
  private readonly columns: GSheetColumnMap
  private readonly decodeJsonCells: boolean
  private readonly batchTransformer?: RepositoryTransformer
  /** Kept for runtime capability checks on optional write slots. */
  private readonly contract: TContract

  constructor(input: GSheetRepositoryOptions<TContract>) {
    super({
      fieldMap: input.contract.db.fieldMap,
      primaryKey: input.contract.db.primaryKey,
      transformer: input.transformer,
    })
    this.contract = input.contract
    this.sheetName = input.sheetName
    this.target = input.target
    this.spreadsheetId = requireEnv(input.spreadsheetId)
    this.scriptUrl = requireEnv(input.scriptUrl ?? 'APPSCRIPT_URL')
    this.primaryKeyColumn = Object.entries(input.contract.db.fieldMap).find(
      ([, apiField]) => apiField === input.contract.db.primaryKey,
    )?.[0] ?? input.contract.db.primaryKey
    this.columns = deriveGVizColumns(input.contract.db.row)
    this.decodeJsonCells = input.decodeJsonCells ?? false
    this.batchTransformer = input.transformer
  }

  protected async execute<TResponse, TQuery = unknown, TData = unknown>(
    request: RepositoryRequest<TQuery, TData>,
  ): Promise<TResponse> {
    switch (request.operation) {
      case 'read': {
        const rows = await this.readRows(
          request.query as MappedReadQuery<Record<string, unknown>> | undefined,
        )
        return rows as TResponse
      }
      case 'create': {
        const stored = await this.write('APPEND', request.data)
        return stored as TResponse
      }
      case 'update': {
        const { keyValue, patch } = this.buildUpdateRequest(request)
        const stored = await this.write('UPDATE', patch, keyValue)
        return stored as TResponse
      }
      case 'delete':
        throw new Error('GSheetRepository.delete is not implemented yet')
      default:
        throw new Error(`Unsupported repository operation: ${request.operation}`)
    }
  }

  read(
    query?: ReadQueryDTO<ModuleReadWhere<TContract>>,
  ): Promise<Array<Partial<ModuleApiRow<TContract>>>> {
    return this.request<
      Array<Partial<ModuleApiRow<TContract>>>,
      ReadQueryDTO<ModuleReadWhere<TContract>>,
      never
    >({
      operation: 'read',
      query,
    })
  }

  create(data: ModuleCreate<TContract>): Promise<ModuleApiRow<TContract>> {
    if (this.contract.db.request.create === undefined) {
      return Promise.reject(new Error('create is not supported by this module'))
    }
    return this.request<ModuleApiRow<TContract>, never, ModuleCreate<TContract>>({
      operation: 'create',
      data,
    })
  }

  update(id: string, data: ModuleUpdate<TContract>): Promise<ModuleApiRow<TContract>> {
    if (this.contract.db.request.update === undefined) {
      return Promise.reject(new Error('update is not supported by this module'))
    }
    return this.request<ModuleApiRow<TContract>, { id: string }, ModuleUpdate<TContract>>({
      operation: 'update',
      query: { id },
      data,
    })
  }

  async batchAppend(rows: Array<ModuleCreate<TContract>>): Promise<Array<ModuleApiRow<TContract>>> {
    if (this.contract.db.request.create === undefined) {
      throw new Error('batchAppend is not supported by this module')
    }

    const transformedRequests: Array<RepositoryRequest<unknown, unknown>> = []
    for (const row of rows) {
      const dbRequest: RepositoryRequest<unknown, unknown> = {
        operation: 'create',
        data: this.mapper.toDb(row as Record<string, unknown>),
      }
      const transformedRequest = this.batchTransformer?.request
        ? await this.batchTransformer.request(dbRequest)
        : dbRequest
      if (
        transformedRequest.data === null ||
        typeof transformedRequest.data !== 'object' ||
        Array.isArray(transformedRequest.data)
      ) {
        throw new Error('GSheetRepository.batchAppend transformer must return an object payload per row')
      }
      transformedRequests.push(transformedRequest)
    }

    const stored = await this.write(
      'APPEND',
      transformedRequests.map((request) => request.data),
    )
    if (!Array.isArray(stored)) {
      throw new Error('SheetLib APPEND response data must be an array for batchAppend')
    }
    if (stored.length !== transformedRequests.length) {
      throw new Error('SheetLib APPEND response row count must match batchAppend input')
    }

    const dbResponse: unknown[] = []
    for (const [index, row] of stored.entries()) {
      const transformedRow = this.batchTransformer?.response
        ? await this.batchTransformer.response(row, { request: transformedRequests[index] })
        : row
      dbResponse.push(transformedRow)
    }
    return dbResponse.map((row) => this.mapper.toApi(row as Record<string, unknown>)) as Array<
      ModuleApiRow<TContract>
    >
  }

  /** Future implementation. */
  async delete(_id: string): Promise<never> {
    throw new Error('GSheetRepository.delete is not implemented yet')
  }

  private async readRows(
    query: MappedReadQuery<Record<string, unknown>> | undefined,
  ): Promise<unknown[]> {
    const gvizQuery = GVizQueryBuilder.fromColumns(this.columns).fromQuery(query).build()
    return fetchGVizRows({
      spreadsheetId: this.spreadsheetId,
      sheetName: this.sheetName,
      query: gvizQuery,
      columns: this.columns,
      decodeJsonCells: this.decodeJsonCells,
    })
  }

  private buildUpdateRequest(request: RepositoryRequest<unknown, unknown>): {
    keyValue: string
    patch: Record<string, unknown>
  } {
    const data = (request.data as Record<string, unknown> | undefined) ?? {}
    const where =
      (request.query as MappedReadQuery<Record<string, unknown>> | undefined)?.where ?? {}
    const keyValue = where[this.primaryKeyColumn]
    if (typeof keyValue !== 'string' || keyValue.trim() === '') {
      throw new Error('GSheetRepository.update requires a mapped primary-key id')
    }

    const { [this.primaryKeyColumn]: _primaryKey, ...patch } = data
    return { keyValue, patch }
  }

  private async write(action: AppScriptAction, data: unknown, keyValue?: string): Promise<unknown> {
    const response = await this.sendSheetLibRequest<unknown>({ action, data, keyValue })
    if (response.status === 'error') {
      throw new Error(`SheetLib ${action} failed: ${response.message}`)
    }
    if (response.status !== 'ok') {
      throw new Error(`SheetLib ${action} returned an invalid response status`)
    }
    return response.data
  }

  private async sendSheetLibRequest<TResponse = unknown, TData = unknown>(
    input: SheetLibRequestInput<TData>,
  ): Promise<SheetLibResponse<TResponse>> {
    const target = this.requireWriteTarget()
    const body: SheetLibRequest<TData> = {
      resource: 'sheet',
      action: input.action,
      target,
      data: input.data,
    }
    if (input.action === 'UPDATE') {
      body.key_value = input.keyValue
    }

    const response = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow',
    })
    if (!response.ok) {
      throw new Error(`SheetLib request failed: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as SheetLibResponse<TResponse>
  }

  private requireWriteTarget(): string {
    if (typeof this.target !== 'string' || this.target.trim() === '') {
      throw new Error('GSheetRepository writes require an explicit SheetLib target')
    }
    return this.target
  }
}
