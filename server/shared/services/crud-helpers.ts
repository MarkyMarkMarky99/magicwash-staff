import { ApiError } from '../http/api-error.js'

export function requireSingleRow<T extends object>(rows: Array<Partial<T>>, id: string): Partial<T> {
  if (rows.length === 0) {
    throw ApiError.notFound(`Resource '${id}' not found`)
  }
  if (rows.length > 1) {
    throw ApiError.conflict(`Resource '${id}' resolved to multiple rows`)
  }
  return rows[0]!
}

export function projectResponse<TResponse extends object>(
  row: Record<string, unknown>,
  schema: { shape: Record<string, unknown> },
): TResponse {
  return Object.fromEntries(
    Object.keys(schema.shape).map((key) => [key, row[key]]),
  ) as TResponse
}
