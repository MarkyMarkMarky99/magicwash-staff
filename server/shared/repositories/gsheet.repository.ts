// Google Sheets implementation of BaseRepository.
// Owns all transport detail: GViz query strings + reads, Apps Script writes.

import { ZodNever, type z } from 'zod'
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
import { SheetLibRejectedError, SheetLibTransportError } from './sheetlib-errors.js'

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
  /**
   * The write (APPEND/UPDATE) itself already succeeded, but SheetLib's own
   * persisted-row read-back afterward failed (transient Sheets API error,
   * quota, timeout) — see `appscript/SheetLib/SheetService.js`. `data` is
   * `null` in this case: SheetLib genuinely cannot confirm what got
   * persisted, only that something did. This is why `status` stays `'ok'`
   * instead of `'error'` — never treat this as a rejection.
   */
  read_back_failed?: boolean
  /** Present when `read_back_failed` is true — the read-back error's message. */
  reason?: string
}

export interface SheetLibErrorResponse {
  status: 'error'
  message: string
}

export type SheetLibResponse<TData = unknown> =
  | SheetLibSuccessResponse<TData>
  | SheetLibErrorResponse

/**
 * A DB `request.create`/`request.update` slot is "unsupported" either by
 * being genuinely absent (the key omitted, e.g. every non-read-only module's
 * OTHER unsupported slot) or by being explicitly declared `z.never()` — the
 * stronger, intentional form read-only modules (InvoicesView, OrdersView,
 * Payment) use so "this sheet must never be written" is a declared contract
 * fact, not indistinguishable from "not filled in yet". Both representations
 * must gate `create()`/`update()`/`batchAppend()` identically — this
 * function is the one place that equivalence lives, so no call site
 * duplicates the `instanceof ZodNever` check.
 */
function isUnsupportedDbOperation(schema: z.ZodTypeAny | undefined): boolean {
  return schema === undefined || schema instanceof ZodNever
}

/**
 * Every SheetLib write aborts after this long. Without it, a hung Apps
 * Script call rides until the surrounding Vercel function is killed, which
 * starves the unknown-transport branch of ever actually firing — matches
 * the timeout the legacy raw-fetch write clients had independently
 * (`REQUEST_TIMEOUT_MS = 15_000`).
 */
const SHEETLIB_WRITE_TIMEOUT_MS = 15_000

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
  /**
   * Env var KEY NAME holding the spreadsheet id. Required only when `read()`
   * uses GViz; writer-only repositories may omit it.
   */
  spreadsheetId?: string
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
  private readonly spreadsheetIdEnvVar?: string
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
    this.spreadsheetIdEnvVar = input.spreadsheetId
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
    if (isUnsupportedDbOperation(this.contract.db.request.create)) {
      return Promise.reject(new Error('create is not supported by this module'))
    }
    return this.request<ModuleApiRow<TContract>, never, ModuleCreate<TContract>>({
      operation: 'create',
      data,
    })
  }

  update(id: string, data: ModuleUpdate<TContract>): Promise<ModuleApiRow<TContract>> {
    if (isUnsupportedDbOperation(this.contract.db.request.update)) {
      return Promise.reject(new Error('update is not supported by this module'))
    }
    return this.request<ModuleApiRow<TContract>, { id: string }, ModuleUpdate<TContract>>({
      operation: 'update',
      query: { id },
      data,
    })
  }

  async batchAppend(rows: Array<ModuleCreate<TContract>>): Promise<Array<ModuleApiRow<TContract>>> {
    if (isUnsupportedDbOperation(this.contract.db.request.create)) {
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

    // `expectedShape: 'array'` makes `write()` itself throw
    // `SheetLibTransportError` if `data` isn't an array at all — see
    // `write()`'s doc comment. Only the batch-specific LENGTH check (which
    // `write()` has no way to know) stays here; this must never re-check
    // array-ness itself, or a mismatched-length batch could double-throw.
    const stored = (await this.write(
      'APPEND',
      transformedRequests.map((request) => request.data),
      undefined,
      'array',
    )) as unknown[]
    // ⚠ Fires AFTER the gateway already answered `status: 'ok'` — the rows
    // almost certainly exist server-side even though the response body
    // didn't match what this method expected. This must never be classified
    // the same as "nothing was written": a caller that (wrongly) treated it
    // as a definite rejection could resubmit the whole batch and double
    // every row. `SheetLibTransportError` is the same "no definite, USABLE
    // answer came back" class a network failure/timeout throws — never
    // `SheetLibRejectedError`.
    if (stored.length !== transformedRequests.length) {
      throw new SheetLibTransportError(
        'APPEND',
        'SheetLib APPEND response row count must match batchAppend input — the gateway confirmed the write but the response shape could not be used to map persisted rows',
      )
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
    if (typeof this.spreadsheetIdEnvVar !== 'string' || this.spreadsheetIdEnvVar.trim() === '') {
      throw new Error(
        'GSheetRepository reads require a spreadsheetId environment variable name',
      )
    }

    const gvizQuery = GVizQueryBuilder.fromColumns(this.columns).fromQuery(query).build()
    return fetchGVizRows({
      spreadsheetId: requireEnv(this.spreadsheetIdEnvVar),
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

  /**
   * `expectedShape` distinguishes the single-row write path (`create()`/
   * `update()` via `execute()`, expects a persisted-row OBJECT) from the
   * batch path (`batchAppend()`, expects an ARRAY of persisted rows) — the
   * two callers need different validation, but both must go through the
   * SAME check: a `status: 'ok'` response is NOT success by itself. The
   * gateway confirming the write and this method being unable to read back
   * *which* row it wrote are two different facts. Blindly returning
   * `response.data` let `undefined`/a scalar/the wrong shape flow straight
   * through `create()`/`update()` typed as a real persisted row — silent
   * partial persistence (e.g. an Invoice header actually written, but the
   * service proceeding with an `undefined` id because `data` never came
   * back). Missing/unusable `data` after a confirmed `status: 'ok'` is
   * ALWAYS `SheetLibTransportError`, never `SheetLibRejectedError` — the
   * write happened; only the confirmation of what got written is unusable.
   */
  private async write(
    action: AppScriptAction,
    data: unknown,
    keyValue?: string,
    expectedShape: 'object' | 'array' = 'object',
  ): Promise<unknown> {
    const response = await this.sendSheetLibRequest<unknown>({ action, data, keyValue })
    if (response.status === 'error') {
      // The gateway gave a definite answer: nothing was written for this
      // request. Message text is unchanged from before this class existed —
      // only the thrown type is new.
      throw new SheetLibRejectedError(action, response.message)
    }
    if (response.status !== 'ok') {
      // A well-formed HTTP response whose body doesn't match the SheetLib
      // envelope at all — not a definite rejection, so this is transport-side.
      throw new SheetLibTransportError(action, `SheetLib ${action} returned an invalid response status`)
    }
    if (response.read_back_failed === true) {
      // The write itself (APPEND/UPDATE) already succeeded — SheetLib's own
      // persisted-row read-back afterward failed. Surface the real reason
      // instead of falling through to the generic "no usable data" message
      // below (which would still be correct, just less specific).
      throw new SheetLibTransportError(
        action,
        `SheetLib ${action} succeeded but the persisted-row read-back failed: ${response.reason ?? 'unknown reason'}`,
      )
    }

    const stored = response.data
    if (expectedShape === 'array') {
      if (!Array.isArray(stored)) {
        throw new SheetLibTransportError(
          action,
          `SheetLib ${action} confirmed the write but "data" was not an array — the write may have succeeded with no usable persisted rows to map back`,
        )
      }
      return stored
    }

    if (stored === undefined || stored === null || typeof stored !== 'object' || Array.isArray(stored)) {
      throw new SheetLibTransportError(
        action,
        `SheetLib ${action} confirmed the write but returned no usable persisted row in "data" — the write may have succeeded with nothing to map back`,
      )
    }
    return stored
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

    let response: Response
    try {
      response = await fetch(this.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'follow',
        // An abort (timeout) is a network-level rejection like any other —
        // caught below and classified as SheetLibTransportError ('unknown'),
        // never a confirmed rejection.
        signal: AbortSignal.timeout(SHEETLIB_WRITE_TIMEOUT_MS),
      })
    } catch (error) {
      // A network failure or timeout: no definite answer came back at all.
      // The write may or may not have persisted server-side — never treat
      // this the same as a confirmed SheetLibRejectedError.
      throw new SheetLibTransportError(
        input.action,
        `SheetLib request failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (!response.ok) {
      // Message text unchanged from before this class existed.
      throw new SheetLibTransportError(
        input.action,
        `SheetLib request failed: ${response.status} ${response.statusText}`,
      )
    }

    try {
      return (await response.json()) as SheetLibResponse<TResponse>
    } catch (error) {
      throw new SheetLibTransportError(
        input.action,
        `SheetLib response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private requireWriteTarget(): string {
    if (typeof this.target !== 'string' || this.target.trim() === '') {
      throw new Error('GSheetRepository writes require an explicit SheetLib target')
    }
    return this.target
  }
}
