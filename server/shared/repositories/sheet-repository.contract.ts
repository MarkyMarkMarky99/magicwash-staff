import type { ReadQueryDTO } from '../dtos/read-query.dto.js'
import type { GVizQueryBuilder } from './utils/gviz-query.builder.js'

export interface SheetRepositoryContract<TDbRow extends object> {
  read(query?: ReadQueryDTO<Partial<TDbRow>>): Promise<Array<Partial<TDbRow>>>
  readRaw(query: string): Promise<Array<Partial<TDbRow>>>
  queryBuilder(): GVizQueryBuilder
  append(row: Partial<TDbRow>): Promise<TDbRow>
  batchAppend(rows: Array<Partial<TDbRow>>): Promise<TDbRow[]>
  update(keyValue: string, patch: Partial<TDbRow>): Promise<TDbRow>
  delete(keyValue: string, deletedBy: string): Promise<TDbRow>
}

export interface SheetRowUpdate<TDbRow extends object> {
  keyValue: string
  patch: Partial<TDbRow>
}

export interface SheetBatchUpdateContract<TDbRow extends object> {
  updateMany(updates: ReadonlyArray<SheetRowUpdate<TDbRow>>): Promise<TDbRow[]>
}
