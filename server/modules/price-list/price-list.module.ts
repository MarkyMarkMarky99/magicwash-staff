import { z } from 'zod'
import { priceListApiContract } from '../../../contracts/price-list/price-list-api.schema.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import type { ApiRowFromFieldMap } from '../../shared/repositories/base.repository.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { getPriceListRepository } from '../../sheets/PriceList/PriceList.repository.js'
import { priceListRowSchema } from '../../sheets/PriceList/PriceList.db-contract.js'

type PriceListDbRow = z.infer<typeof priceListRowSchema>

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

type PriceListService = BaseCrudService<
  PriceListApiRow,
  PriceListListQuery,
  never,
  never,
  PriceListListResponse,
  never,
  never,
  never,
  PriceListDbRow,
  typeof priceListFieldMap
>

export const priceListService: PriceListService = new BaseCrudService({
  repository: getPriceListRepository,
  api: priceListApiContract,
  searchFields,
  fieldMap: priceListFieldMap,
})

export const priceListRoutes = createCrudRoutes(priceListService, priceListApiContract)
