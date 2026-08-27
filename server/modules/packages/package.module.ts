import { z } from 'zod'
import { packageApiContract } from '../../../contracts/packages/package-api.schema.js'
import { ApiError } from '../../shared/http/api-error.js'
import { createCrudRoutes } from '../../shared/http/crud-routes.js'
import type {
  ApiRowFromFieldMap,
  RepositoryTransformer,
} from '../../shared/repositories/base.repository.js'
import type { SheetRepositoryContract } from '../../shared/repositories/sheet-repository.contract.js'
import { DuplicatePrimaryKeyError } from '../../shared/repositories/sheets-api.client.js'
import { BaseCrudService } from '../../shared/services/base-crud.service.js'
import { formatBangkokTimestamp } from '../../shared/utils/bangkok-timestamp.js'
import { packagesRowSchema } from '../../sheets/Packages/Packages.db-contract.js'
import { getPackagesRepository } from '../../sheets/Packages/Packages.repository.js'

type PackagesDbRow = z.infer<typeof packagesRowSchema>

export const packageFieldMap = {
  package_code: 'packageCode',
  name: 'name',
  eligible_service: 'eligibleService',
  included_credit: 'includedCredit',
  price: 'price',
  notes: 'notes',
  created_at: 'createdAt',
  created_by: 'createdBy',
  updated_at: 'updatedAt',
  updated_by: 'updatedBy',
  deleted_at: 'deletedAt',
  deleted_by: 'deletedBy',
} as const satisfies Record<keyof PackagesDbRow & string, string>

export const packageSearchFields = ['packageCode', 'name', 'eligibleService'] as const

type PackageApiRow = ApiRowFromFieldMap<PackagesDbRow, typeof packageFieldMap>
type PackageListQuery = z.infer<typeof packageApiContract.query.list>
type PackageCreate = z.infer<typeof packageApiContract.request.create>
type PackageUpdate = z.infer<typeof packageApiContract.request.update>
type PackageListResponse = z.infer<typeof packageApiContract.response.list>
type PackageDetailResponse = z.infer<typeof packageApiContract.response.detail>
type PackageCreateResponse = z.infer<typeof packageApiContract.response.create>
type PackageUpdateResponse = z.infer<typeof packageApiContract.response.update>

type PackageService = BaseCrudService<
  PackageApiRow,
  PackageListQuery,
  PackageCreate,
  PackageUpdate,
  PackageListResponse,
  PackageDetailResponse,
  PackageCreateResponse,
  PackageUpdateResponse,
  PackagesDbRow,
  typeof packageFieldMap
>

const packageRepository: SheetRepositoryContract<PackagesDbRow> = {
  read: (query) => getPackagesRepository().read(query),
  append: (row) => appendPackage(row),
  batchAppend: (rows) => getPackagesRepository().batchAppend(rows),
  update: (keyValue, patch) => updatePackage(keyValue, patch),
  delete: (keyValue, deletedBy) => getPackagesRepository().delete(keyValue, deletedBy),
}

export const packageService: PackageService = new BaseCrudService({
  repository: packageRepository,
  api: packageApiContract,
  searchFields: packageSearchFields,
  fieldMap: packageFieldMap,
  transformer: createPackageTransformer(),
})

export const packageRoutes = createCrudRoutes(packageService, packageApiContract)

async function appendPackage(row: Partial<PackagesDbRow>): Promise<PackagesDbRow> {
  try {
    return await getPackagesRepository().append({ notes: null, ...row })
  } catch (error) {
    if (error instanceof DuplicatePrimaryKeyError) {
      throw ApiError.conflict(`Package code '${row.package_code}' already exists`)
    }
    throw error
  }
}

async function updatePackage(
  keyValue: string,
  patch: Partial<PackagesDbRow>,
): Promise<PackagesDbRow> {
  const raw = { ...patch } as Record<string, unknown>
  const active = raw.active
  delete raw.active

  if (active === false) {
    raw.deleted_at = formatBangkokTimestamp(new Date())
    raw.deleted_by = raw.updated_by ?? ''
  } else if (active === true) {
    raw.deleted_at = null
    raw.deleted_by = null
  }

  return getPackagesRepository().update(keyValue, raw as Partial<PackagesDbRow>)
}

function createPackageTransformer(): RepositoryTransformer {
  return {
    response(response) {
      if (!isRecord(response)) {
        return response
      }

      const row = { ...response }
      for (const column of ['notes', 'updated_at', 'updated_by', 'deleted_at', 'deleted_by']) {
        if (row[column] === '') {
          row[column] = null
        }
      }
      return row
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
