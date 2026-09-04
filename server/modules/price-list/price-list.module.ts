import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { priceListApiContract } from '../../../contracts/price-list/price-list-api.schema.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import type {
  ApiRowFromFieldMap,
  RepositoryTransformer,
} from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { getPriceListRepository } from '../../sheets/PriceList/PriceList.repository.js'
import { priceListRowSchema } from '../../sheets/PriceList/PriceList.db-contract.js'

type PriceListDbRow = z.infer<typeof priceListRowSchema>
type PriceListCreate = z.infer<typeof priceListApiContract.request.create>
type PriceListUpdate = z.infer<typeof priceListApiContract.request.update>

export const priceListFieldMap = {
  id: 'id',
  item_code: 'itemCode',
  category: 'category',
  subcategory: 'subcategory',
  itemtype: 'itemType',
  variant: 'variant',
  display_name_th: 'displayNameTh',
  display_name_en: 'displayNameEn',
  service_type: 'serviceType',
  price_group: 'priceGroup',
  unit: 'unit',
  price: 'price',
  credit_eligible: 'creditEligible',
  effective_from: 'effectiveFrom',
  effective_to: 'effectiveTo',
  active: 'active',
} as const satisfies Record<keyof PriceListDbRow & string, string>

export const searchFields = [
  'itemCode',
  'category',
  'subcategory',
  'itemType',
  'variant',
  'displayNameTh',
  'displayNameEn',
] as const

type PriceListApiRow = ApiRowFromFieldMap<PriceListDbRow, typeof priceListFieldMap>
type PriceListListQuery = z.infer<typeof priceListApiContract.query.list>
type PriceListListResponse = z.infer<typeof priceListApiContract.response.list>
type PriceListCreateResponse = z.infer<typeof priceListApiContract.response.create>
type PriceListUpdateResponse = z.infer<typeof priceListApiContract.response.update>

type PriceListService = BaseCrudService<
  PriceListApiRow,
  PriceListListQuery,
  PriceListCreate,
  PriceListUpdate,
  PriceListListResponse,
  never,
  PriceListCreateResponse,
  PriceListUpdateResponse,
  PriceListDbRow,
  typeof priceListFieldMap
>

const priceListRepository: SheetRepositoryContract<PriceListDbRow> = {
  read: (query) => getPriceListRepository().read(query),
  append: async (row) => {
    const existingRows = await getPriceListRepository().read()
    const id = nextPriceListId(existingRows)

    return getPriceListRepository().append({
      ...withPriceListNullableDefaults(row),
      id,
    })
  },
  batchAppend: (rows) => getPriceListRepository().batchAppend(rows),
  update: (keyValue, patch) => getPriceListRepository().update(keyValue, patch),
  delete: (keyValue, deletedBy) => getPriceListRepository().delete(keyValue, deletedBy),
}

export const priceListService: PriceListService = new BaseCrudService({
  repository: priceListRepository,
  api: priceListApiContract,
  searchFields,
  fieldMap: priceListFieldMap,
  transformer: createPriceListTransformer(),
})

export const priceListRoutes = createCrudRoutes(priceListService, priceListApiContract)

const GVIZ_DATE_PATTERN = /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,[^)]+)?\)$/
const PRICE_LIST_NULLABLE_COLUMNS = [
  'variant',
  'display_name_en',
  'unit',
  'effective_to',
] as const

function createPriceListTransformer(): RepositoryTransformer {
  return {
    response(response, { request }) {
      if (!isRecord(response)) {
        return response
      }

      const row = { ...response }
      for (const column of ['effective_from', 'effective_to']) {
        row[column] = normalizePriceListDate(row[column])
      }

      if (request.operation !== 'read') {
        for (const column of PRICE_LIST_NULLABLE_COLUMNS) {
          if (row[column] === '') {
            row[column] = null
          }
        }
      }

      return row
    },
  }
}

function withPriceListNullableDefaults(
  row: Partial<PriceListDbRow>,
): Partial<PriceListDbRow> {
  const normalized = { ...row }
  for (const column of PRICE_LIST_NULLABLE_COLUMNS) {
    if (normalized[column] === undefined) {
      normalized[column] = null
    }
  }
  return normalized
}

function nextPriceListId(rows: Array<Partial<PriceListDbRow>>): string {
  const existingIds = new Set(
    rows.flatMap((row) => (typeof row.id === 'string' ? [row.id] : [])),
  )

  let id = createPriceListId()
  while (existingIds.has(id)) {
    id = createPriceListId()
  }
  return id
}

function createPriceListId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8)
}

function normalizePriceListDate(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  const match = GVIZ_DATE_PATTERN.exec(value)
  if (match === null) {
    return value
  }

  const month = Number(match[2])
  if (month < 0 || month > 11) {
    return value
  }

  return `${match[1]}-${String(month + 1).padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
