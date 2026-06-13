import { AppScriptClient } from '../google-sheets/appscript.client'
import { GVizClient } from '../google-sheets/gviz.client'
import { BaseSheetRepository } from '../repositories/base-sheet.repository'
import { requireEnv } from '../utils/env'
import type {
  ResourceRepository,
  SheetClause,
  SheetColumnLetters,
  SheetIdColumn,
  SheetListFilter,
} from './sheet-crud.types'
import { columnLetterFor, makeFieldResolver } from './sheet-naming'
import {
  createClauseBuilders,
  createSheetQuery,
  type SheetClauseBuilders,
} from './gviz-query.factory'

/** Where the sheet lives: env var *names* + a fallback tab name. */
export interface GoogleSheetSource {
  /** Fallback sheet (tab) name when the env override is absent. */
  sheetName: string
  sheetNameEnv?: string
  spreadsheetIdEnv: string
  scriptUrlEnv: string
}

export interface GoogleSheetRepositoryConfig<
  TRow extends object,
  TFilter extends SheetListFilter,
> {
  sheet: GoogleSheetSource
  /**
   * The module's DB contract bundle (`SheetDbSchemas` satisfies this
   * structurally). The repository uses `row` — its key order derives the GViz
   * column letters (1st key = column A) — `idColumn`, and `fieldMap` to resolve
   * sort fields to columns; the action payload schemas are the service's
   * concern. Validating row *contents* is also the service's concern, not
   * transport's.
   */
  db: {
    row: { shape: Record<keyof TRow & string, unknown> }
    idColumn: SheetIdColumn<TRow> & string
    fieldMap: Record<keyof TRow & string, string>
  }
  /** Receives clause builders bound to the derived letters; cross-field domain logic goes in as plain functions. */
  clauses: (
    clause: SheetClauseBuilders<TRow, TFilter>,
    columns: SheetColumnLetters<TRow>,
  ) => Array<SheetClause<TFilter>>
}

/**
 * The Google Sheets implementation of {@link ResourceRepository}: GViz for
 * reads, Apps Script doPost for writes. All transport detail — query strings,
 * column letters, env wiring — stays behind this boundary; callers speak in
 * ids, filters, and row payloads only.
 *
 * Call at module scope: Node's module cache makes the instance a singleton,
 * and env is read once at first import (safe: `tsc` doesn't execute modules;
 * Vercel cold start has env).
 */
export function createGoogleSheetRepository<
  TRow extends object,
  TFilter extends SheetListFilter,
>(config: GoogleSheetRepositoryConfig<TRow, TFilter>): ResourceRepository<TRow, TFilter> {
  // ── Derived from the row schema: column names (declaration order =
  //    physical sheet order) and GViz letters. ──
  const columnNames = Object.keys(config.db.row.shape) as Array<keyof TRow & string>
  const letters = {} as SheetColumnLetters<TRow>
  columnNames.forEach((name, index) => {
    letters[name] = columnLetterFor(index)
  })

  // The explicit field map resolves API sort fields back to their columns.
  // (Cast erases the generic for the stringly runtime; the service config's
  // mapped types already verified the map is exact.)
  const resolver = makeFieldResolver(config.db.fieldMap as Record<string, string>)

  const query = createSheetQuery<TRow, TFilter>({
    columns: letters,
    idColumn: config.db.idColumn,
    clauses: config.clauses(createClauseBuilders<TRow, TFilter>(letters), letters),
    // Sort fields are API field names; resolve them to columns through the map.
    // (Cast: the engine view is stringly; byFilter guards misses.)
    sortColumns: Object.fromEntries(
      columnNames.map((column) => [resolver.toField(column), column]),
    ) as Record<TFilter['sortBy'], keyof TRow>,
  })

  const sheetFromEnv = config.sheet.sheetNameEnv
    ? process.env[config.sheet.sheetNameEnv]
    : undefined
  const sheet = new BaseSheetRepository<TRow>({
    sheet: sheetFromEnv || config.sheet.sheetName,
    gvizClient: new GVizClient({ spreadsheetId: requireEnv(config.sheet.spreadsheetIdEnv) }),
    appScriptClient: new AppScriptClient({ scriptUrl: requireEnv(config.sheet.scriptUrlEnv) }),
  })

  return {
    async findById(id) {
      const [row] = await sheet.get(query.byId(id))
      return row ?? null
    },

    findByFilter(filter) {
      return sheet.get(query.byFilter(filter))
    },

    append(payload) {
      return sheet.create(payload)
    },

    update(id, payload) {
      // Route id wins: spread the payload first, then pin the id column last, so a
      // before-hook payload can never redirect the write to a different row — the
      // route param is the sole source of truth for which row is updated.
      // (Cast: the computed key defeats inference; idColumn is keyof TRow.)
      return sheet.update({ ...payload, [config.db.idColumn]: id } as Partial<TRow>)
    },
  }
}
