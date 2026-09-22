import { z } from 'zod'
import { itemsApiContract } from '../../../contracts/items/items-api.schema.js'
import { generateShortId } from '../../../shared/utils/id.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import type { ApiRowFromFieldMap, RepositoryTransformer } from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { getItemsRepository } from '../../sheets/Items/Items.repository.js'
import { itemsRowSchema } from '../../sheets/Items/Items.db-contract.js'

type ItemsDbRow = z.infer<typeof itemsRowSchema>

export const itemsFieldMap = {
  id: 'id',
  item_code: 'itemCode',
  category: 'category',
  subcategory: 'subcategory',
  itemtype: 'itemType',
  variant: 'variant',
  display_name_th: 'displayNameTh',
  display_name_en: 'displayNameEn',
  active: 'active',
  image_url: 'imageUrl',
} as const satisfies Record<keyof ItemsDbRow & string, string>

type ItemsApiRow = ApiRowFromFieldMap<ItemsDbRow, typeof itemsFieldMap>
type ItemsListQuery = z.infer<typeof itemsApiContract.query.list>
type ItemsCreate = z.infer<typeof itemsApiContract.request.create>
type ItemsUpdate = z.infer<typeof itemsApiContract.request.update>
type ItemsResponse = z.infer<typeof itemsApiContract.response.list>

const itemsRepository: SheetRepositoryContract<ItemsDbRow> = {
  read: (query) => getItemsRepository().read(query),
  append: async (row) => {
    const existingRows = await getItemsRepository().read()
    const existingIds = new Set(existingRows.map((existing) => existing.id))
    let id = generateShortId()
    while (existingIds.has(id)) {
      id = generateShortId()
    }

    let maximum = 0
    for (const existing of existingRows) {
      const match = typeof existing.item_code === 'string' ? /^ITM-(\d+)$/.exec(existing.item_code) : null
      if (match !== null) {
        const suffix = Number(match[1])
        if (Number.isSafeInteger(suffix)) maximum = Math.max(maximum, suffix)
      }
    }

    return getItemsRepository().append({
      ...row,
      id,
      item_code: `ITM-${String(maximum + 1).padStart(4, '0')}`,
      variant: row.variant ?? null,
      display_name_en: row.display_name_en ?? null,
      image_url: row.image_url ?? null,
    })
  },
  batchAppend: (rows) => getItemsRepository().batchAppend(rows),
  update: (keyValue, patch) => getItemsRepository().update(keyValue, patch),
  delete: (keyValue, deletedBy) => getItemsRepository().delete(keyValue, deletedBy),
}

const nullableColumns = ['variant', 'display_name_en', 'image_url'] as const
const transformer: RepositoryTransformer = {
  response(response, { request }) {
    if (request.operation === 'read' || response === null || typeof response !== 'object' || Array.isArray(response)) {
      return response
    }
    const row = { ...response } as Record<string, unknown>
    for (const column of nullableColumns) {
      if (row[column] === '') row[column] = null
    }
    return row
  },
}

export const itemsService = new BaseCrudService<
  ItemsApiRow, ItemsListQuery, ItemsCreate, ItemsUpdate,
  ItemsResponse, ItemsResponse, ItemsResponse, ItemsResponse,
  ItemsDbRow, typeof itemsFieldMap
>({
  repository: itemsRepository,
  api: itemsApiContract,
  searchFields: ['itemCode', 'category', 'subcategory', 'itemType', 'variant', 'displayNameTh', 'displayNameEn'],
  fieldMap: itemsFieldMap,
  transformer,
})

export const itemsRoutes = createCrudRoutes(itemsService, itemsApiContract)
