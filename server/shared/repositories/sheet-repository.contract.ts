import type { ReadQueryDTO } from '../dtos/read-query.dto.js'

export interface SheetRepositoryContract<TDbRow extends object> {
  read(query?: ReadQueryDTO<Partial<TDbRow>>): Promise<Array<Partial<TDbRow>>>
  append(row: Partial<TDbRow>): Promise<TDbRow>
  batchAppend(rows: Array<Partial<TDbRow>>): Promise<TDbRow[]>
  update(keyValue: string, patch: Partial<TDbRow>): Promise<TDbRow>
  delete(keyValue: string, deletedBy: string): Promise<TDbRow>
}
