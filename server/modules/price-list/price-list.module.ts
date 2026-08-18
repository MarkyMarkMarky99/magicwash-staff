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
  wash_dry_iron_price: 'washDryIronPrice',
  iron_only_price: 'ironOnlyPrice',
  dry_clean_price: 'dryCleanPrice',
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
    const itemCode = nextPriceListItemCode(existingRows)

    return getPriceListRepository().append({
      ...row,
      id,
      item_code: itemCode,
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
  'wash_dry_iron_price',
  'iron_only_price',
  'dry_clean_price',
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

function nextPriceListItemCode(rows: Array<Partial<PriceListDbRow>>): string {
  let maximum = 0
  for (const row of rows) {
    if (typeof row.item_code !== 'string') {
      continue
    }

    const match = /^ITM-(\d+)$/.exec(row.item_code)
    if (match === null) {
      continue
    }

    const suffix = Number(match[1])
    if (Number.isSafeInteger(suffix)) {
      maximum = Math.max(maximum, suffix)
    }
  }

  return `ITM-${String(maximum + 1).padStart(4, '0')}`
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
