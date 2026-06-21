// Reference contract for the Google Sheets repository (no runtime implementation).
// The live implementation lives in ./gsheet.repository.ts and must satisfy
// the signatures declared here. Kept for design reference only.

import {
  BaseRepository,
  type FieldMap,
  type RepositoryRequest,
  type RepositoryTransformer,
} from './base.contract'
import type { ReadQueryDTO } from '../dtos/read-query.dto'
import type { GSheetRowSchema } from './utils/gviz-query.builder'

export type AppScriptAction = 'APPEND' | 'UPDATE'

export interface GVizFetchInput {
  query: string
}

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

// rowSchema is the DB row (TDbRow) — key order is physical column order, which
// drives the GViz column letters. Field renames go through fieldMap (DB -> API).
export interface GSheetRepositoryOptions<TDbRow extends object = Record<string, unknown>> {
  sheetName: string
  spreadsheetId: string
  scriptUrl: string
  rowSchema: GSheetRowSchema & { shape: Record<keyof TDbRow & string, unknown> }
  /** API/domain field name of the primary key, e.g. `customerId`. */
  primaryKey: string
  fieldMap?: FieldMap
  transformer?: RepositoryTransformer
}

export declare class GSheetRepository<
  TApiRow extends object,
  TDbRow extends object,
  TReadWhere,
  TCreate,
  TUpdate,
> extends BaseRepository<TApiRow, TReadWhere, TCreate, TUpdate> {
  constructor(input: GSheetRepositoryOptions<TDbRow>)

  protected execute<TResponse, TQuery = unknown, TData = unknown>(
    request: RepositoryRequest<TQuery, TData>,
  ): Promise<TResponse>

  read(query?: ReadQueryDTO<TReadWhere>): Promise<Array<Partial<TApiRow>>>
  create(data: TCreate): Promise<TApiRow>
  update(id: string, data: TUpdate): Promise<TApiRow>
  /** Future implementation. */
  delete(id: string): Promise<never>

  /** Private implementation helper used by execute() for GViz reads. */
  private fetchGVizRows(input: GVizFetchInput): Promise<unknown[]>

  /** Private implementation helper used by execute() for Apps Script writes. */
  private sendAppScriptRequest<TResponse = unknown, TData = unknown>(
    input: AppScriptRequestInput<TData>,
  ): Promise<AppScriptResponse<TResponse>>
}
