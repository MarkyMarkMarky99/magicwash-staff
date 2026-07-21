// Reference contract for the Google Sheets repository (no runtime implementation).
// The live implementation lives in ./gsheet.repository.ts and must satisfy
// the signatures declared here. Kept for design reference only.

import type { z } from 'zod'
import {
  BaseRepository,
  type ApiRowFromFieldMap,
  type RepositoryRequest,
  type RepositoryTransformer,
} from './base.contract.js'
import type { ReadQueryDTO, OmitReservedQueryFields } from '../dtos/read-query.dto.js'
import type { ModuleContract } from '../contracts/module-db-contract.js'

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

// ── Repository types derived from the exact module contract (mirror of the live
//    implementation). The DB row drives the mapped API row via the field map; the
//    API bundle drives the read filter and the create/update inputs. ──
type ModuleDbRow<TContract extends ModuleContract> = z.infer<TContract['db']['row']>

type ModuleApiRow<TContract extends ModuleContract> = ApiRowFromFieldMap<
  ModuleDbRow<TContract>,
  TContract['db']['fieldMap']
>

type ModuleReadWhere<TContract extends ModuleContract> = OmitReservedQueryFields<
  z.infer<TContract['api']['query']['list']>
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

// The whole module contract is the only constructor input besides sheet/transport
// config: DB config (row/fieldMap/primaryKey, where row.shape -> GViz column
// letters by physical order) and the inferred API method types both come from it.
// Field renames (e.g. `Line -> lineId`) ride on `contract.db.fieldMap`.
export interface GSheetRepositoryOptions<TContract extends ModuleContract> {
  contract: TContract
  sheetName: string
  spreadsheetId: string
  scriptUrl: string
  transformer?: RepositoryTransformer
}

export declare class GSheetRepository<TContract extends ModuleContract> extends BaseRepository<
  ModuleApiRow<TContract>,
  ModuleReadWhere<TContract>,
  ModuleCreate<TContract>,
  ModuleUpdate<TContract>
> {
  constructor(input: GSheetRepositoryOptions<TContract>)

  protected execute<TResponse, TQuery = unknown, TData = unknown>(
    request: RepositoryRequest<TQuery, TData>,
  ): Promise<TResponse>

  read(
    query?: ReadQueryDTO<ModuleReadWhere<TContract>>,
  ): Promise<Array<Partial<ModuleApiRow<TContract>>>>
  create(data: ModuleCreate<TContract>): Promise<ModuleApiRow<TContract>>
  update(id: string, data: ModuleUpdate<TContract>): Promise<ModuleApiRow<TContract>>
  /** Future implementation. */
  delete(id: string): Promise<never>

  /** Private implementation helper used by execute() for Apps Script writes. */
  private sendAppScriptRequest<TResponse = unknown, TData = unknown>(
    input: AppScriptRequestInput<TData>,
  ): Promise<AppScriptResponse<TResponse>>
}
