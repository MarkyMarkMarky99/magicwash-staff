// Reference contract for the Google Sheets repository (no runtime implementation).
// The live implementation lives in ./gsheet.repository.ts and must satisfy
// the signatures declared here. Kept for design reference only.

import {
  BaseRepository,
  type FieldMap,
  type RepositoryReadQuery,
  type RepositoryRequest,
  type RepositoryTransformer,
} from './base.contract'
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
  fieldMap?: FieldMap
  transformer?: RepositoryTransformer
}

export declare class GSheetRepository<
  TApiRow extends object,
  TDbRow extends object,
  TReadWhere,
  TCreate,
  TUpdateFilter,
  TUpdate,
  TDeleteFilter = TUpdateFilter,
> extends BaseRepository<TApiRow, TReadWhere, TCreate, TUpdateFilter, TUpdate, TDeleteFilter> {
  constructor(input: GSheetRepositoryOptions<TDbRow>)

  protected execute<TResponse, TQuery = unknown, TData = unknown>(
    request: RepositoryRequest<TQuery, TData>,
  ): Promise<TResponse>

  read(query?: RepositoryReadQuery<TReadWhere>): Promise<Array<Partial<TApiRow>>>
  create(data: TCreate): Promise<TApiRow>
  update(filter: TUpdateFilter, data: TUpdate): Promise<TApiRow>
  /** Future implementation. */
  delete(filter: TDeleteFilter): Promise<never>

  /** Private implementation helper used by execute() for GViz reads. */
  private fetchGVizRows(input: GVizFetchInput): Promise<unknown[]>

  /** Private implementation helper used by execute() for Apps Script writes. */
  private sendAppScriptRequest<TResponse = unknown, TData = unknown>(
    input: AppScriptRequestInput<TData>,
  ): Promise<AppScriptResponse<TResponse>>
}
