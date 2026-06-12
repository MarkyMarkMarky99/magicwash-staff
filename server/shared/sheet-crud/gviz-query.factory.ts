import type { SheetClause, SheetColumnLetters, SheetListFilter } from './sheet-crud.types'

/**
 * The GViz query dialect for sheet-crud: the clause builders (eq / contains /
 * dateRange) and the byId / byFilter query assembly that strings them together.
 * Both halves are GViz-specific — single-quote escaping, `contains`,
 * `date '...'`, `select * where ... order by` — and always travel together, so
 * they live in one file. The Google Sheets repository composes them; complex
 * modules with their own queries can reuse them directly.
 */

// ── GViz value safety ─────────────────────────────────────────────────────────

/** Strip quotes so user input can't break out of a GViz string literal. */
export function sanitizeGVizValue(value: string): string {
  return value.replace(/'/g, '')
}

// ── Clause builders ───────────────────────────────────────────────────────────

/** Filter fields holding a plain string value (null/empty means "no constraint"). */
export type StringFilterKey<TFilter> = {
  [K in keyof TFilter]-?: NonNullable<TFilter[K]> extends string ? K : never
}[keyof TFilter]

export interface SheetClauseBuilders<TRow, TFilter> {
  /** `column = value`; several columns become an OR group (value may match any). */
  eq(field: StringFilterKey<TFilter>, column: keyof TRow | Array<keyof TRow>): SheetClause<TFilter>
  /** `contains` across one or more columns (OR group). */
  contains(field: StringFilterKey<TFilter>, columns: Array<keyof TRow>): SheetClause<TFilter>
  /** Inclusive `date` range; either bound may be absent. */
  dateRange(
    fromField: StringFilterKey<TFilter>,
    toField: StringFilterKey<TFilter>,
    column: keyof TRow,
  ): SheetClause<TFilter>
}

/**
 * Declarative GViz clause builders bound to a module's column letters.
 * Covers the common filter shapes; anything beyond (cross-field logic,
 * status overrides) belongs in the module as a plain `SheetClause` function.
 */
export function createClauseBuilders<TRow, TFilter>(
  columns: SheetColumnLetters<TRow>,
): SheetClauseBuilders<TRow, TFilter> {
  const read = (filter: TFilter, field: keyof TFilter): string | null => {
    const value: unknown = filter[field]
    if (typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    return trimmed === '' ? null : sanitizeGVizValue(trimmed)
  }

  const orGroup = (parts: string[]): string =>
    parts.length === 1 ? parts[0] : `(${parts.join(' or ')})`

  return {
    eq(field, column) {
      const letters = (Array.isArray(column) ? column : [column]).map((name) => columns[name])
      return (filter) => {
        const value = read(filter, field)
        return value === null ? null : orGroup(letters.map((letter) => `${letter} = '${value}'`))
      }
    },

    contains(field, columnNames) {
      const letters = columnNames.map((name) => columns[name])
      return (filter) => {
        const value = read(filter, field)
        return value === null
          ? null
          : orGroup(letters.map((letter) => `${letter} contains '${value}'`))
      }
    },

    dateRange(fromField, toField, column) {
      const letter = columns[column]
      return (filter) => {
        const from = read(filter, fromField)
        const to = read(filter, toField)
        if (from && to) {
          return `${letter} >= date '${from}' and ${letter} <= date '${to}'`
        }
        if (from) {
          return `${letter} >= date '${from}'`
        }
        if (to) {
          return `${letter} <= date '${to}'`
        }
        return null
      }
    },
  }
}

// ── Query assembly ────────────────────────────────────────────────────────────

export interface SheetQueryConfig<TRow, TFilter extends SheetListFilter> {
  columns: SheetColumnLetters<TRow>
  idColumn: keyof TRow
  /** Applied in order; null results are dropped, the rest joined with `and`. */
  clauses: Array<SheetClause<TFilter>>
  /** API sort field -> row column; sortBy validation stays in the Zod enum. */
  sortColumns: Record<TFilter['sortBy'], keyof TRow>
}

export interface SheetQuery<TFilter> {
  byId(id: string): string
  byFilter(filter: TFilter): string
}

/** Build the module's GViz queries from a clause list and a sort-field map. */
export function createSheetQuery<TRow, TFilter extends SheetListFilter>(
  config: SheetQueryConfig<TRow, TFilter>,
): SheetQuery<TFilter> {
  return {
    byId(id) {
      return `
        select *
        where ${config.columns[config.idColumn]} = '${sanitizeGVizValue(id)}'
        limit 1
      `
    },

    byFilter(filter) {
      const clauses = config.clauses
        .map((clause) => clause(filter))
        .filter((clause): clause is string => clause !== null)

      const where = clauses.length ? `where ${clauses.join('\nand ')}` : ''
      // The constraint widens filter.sortBy to string; restate its real type.
      const sortField = filter.sortBy as TFilter['sortBy']
      const sortColumn = config.sortColumns[sortField] as keyof TRow | undefined
      if (!sortColumn) {
        // sortBy comes from a Zod enum, so a miss is a config bug, not client input.
        throw new Error(`No column resolves for sort field '${String(sortField)}'`)
      }

      return `
        select *
        ${where}
        order by ${config.columns[sortColumn]} ${filter.sortOrder}
      `
    },
  }
}
