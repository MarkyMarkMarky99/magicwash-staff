// Google Sheets implementation of BaseRepository.
// Owns all transport detail: GViz query strings + reads, Apps Script writes.
// Reference design: ./gsheet.contract.ts

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

type ModuleCreate<TContract extends ModuleContract> = z.infer<TContract['api']['request']['create']>

type ModuleUpdate<TContract extends ModuleContract> = z.infer<TContract['api']['request']['update']>

export type AppScriptAction = 'APPEND' | 'UPDATE'

export interface AppScriptRequestInput<TData = unknown> {
  action: AppScriptAction
  data: TData
}

export interface AppScriptRequest<TData = unknown> {
  action: AppScriptAction
  sheet: string
  data: TData
}

export interface AppScriptSuccessResponse<TData = unknown> {
  success: true
  data: TData
}

export interface AppScriptErrorResponse {
  success: false
  error: string
}

export type AppScriptResponse<TData = unknown> =
  | AppScriptSuccessResponse<TData>
  | AppScriptErrorResponse

export interface GSheetRepositoryOptions<TContract extends ModuleContract> {
  /**
   * The complete module contract. Runtime DB config (`db.row` / `db.fieldMap` /
   * `db.primaryKey`) and the inferred API-facing method types both come from here,
   * so callers never repeat generic arguments or schema options.
   */
  contract: TContract
  sheetName: string
  spreadsheetId: string
  scriptUrl: string
  transformer?: RepositoryTransformer
}

export class GSheetRepository<TContract extends ModuleContract> extends BaseRepository<
  ModuleApiRow<TContract>,
  ModuleReadWhere<TContract>,
  ModuleCreate<TContract>,
  ModuleUpdate<TContract>
> {
  private readonly sheetName: string
  private readonly spreadsheetId: string
  private readonly scriptUrl: string
  private readonly columns: GSheetColumnMap

  constructor(input: GSheetRepositoryOptions<TContract>) {
    super({
      fieldMap: input.contract.db.fieldMap,
      primaryKey: input.contract.db.primaryKey,
      transformer: input.transformer,
    })
    this.sheetName = input.sheetName
    this.spreadsheetId = input.spreadsheetId
    this.scriptUrl = input.scriptUrl
    this.columns = deriveGVizColumns(input.contract.db.row)
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
        const stored = await this.write('UPDATE', this.buildUpdatePayload(request))
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
    return this.request<ModuleApiRow<TContract>, never, ModuleCreate<TContract>>({
      operation: 'create',
      data,
    })
  }

  update(id: string, data: ModuleUpdate<TContract>): Promise<ModuleApiRow<TContract>> {
    return this.request<ModuleApiRow<TContract>, { id: string }, ModuleUpdate<TContract>>({
      operation: 'update',
      query: { id },
      data,
    })
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
    })
  }

  // doPost UPDATE contract: send only the patched fields, then pin the filter
  // (id) last so route id wins the merge.
  private buildUpdatePayload(request: RepositoryRequest<unknown, unknown>): Record<string, unknown> {
    const data = (request.data as Record<string, unknown> | undefined) ?? {}
    const where =
      (request.query as MappedReadQuery<Record<string, unknown>> | undefined)?.where ?? {}
    return { ...data, ...where }
  }

  private async write(action: AppScriptAction, data: unknown): Promise<unknown> {
    const response = await this.sendAppScriptRequest<Record<string, unknown>>({ action, data })
    if (!response.success) {
      throw new Error(`Apps Script ${action} failed: ${response.error}`)
    }
    return response.data
  }

  private async sendAppScriptRequest<TResponse = unknown, TData = unknown>(
    input: AppScriptRequestInput<TData>,
  ): Promise<AppScriptResponse<TResponse>> {
    const body: AppScriptRequest<TData> = {
      action: input.action,
      sheet: this.sheetName,
      data: input.data,
    }

    const response = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'follow',
    })
    if (!response.ok) {
      throw new Error(`Apps Script request failed: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as AppScriptResponse<TResponse>
  }
}
