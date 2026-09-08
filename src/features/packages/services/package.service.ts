import type { z } from 'zod'
import {
  packageCreateRequestSchema,
  packageListQuerySchema,
  packageResponseSchema,
  packageUpdateRequestSchema,
} from '@contracts/packages/package-api.schema'
import { apiGetList, apiPatch, apiPost } from '@/shared/api/api-client'
import { invalidate } from '@/shared/api/response-cache'

export type PackageDto = z.infer<typeof packageResponseSchema>
export type PackageListQuery = z.infer<typeof packageListQuerySchema>
export type PackageCreatePayload = z.infer<typeof packageCreateRequestSchema>
export type PackageUpdatePayload = z.infer<typeof packageUpdateRequestSchema>

const PACKAGES_ENDPOINT = '/api/packages'

export async function listPackages(
  query: Partial<PackageListQuery> = {},
): Promise<PackageDto[]> {
  const { items } = await apiGetList<PackageDto>(PACKAGES_ENDPOINT, {
    query,
    querySchema: packageListQuerySchema,
  })
  return items
}

export async function createPackage(payload: PackageCreatePayload): Promise<PackageDto> {
  const result = await apiPost<PackageDto>(PACKAGES_ENDPOINT, {
    data: payload,
    requestSchema: packageCreateRequestSchema,
  })
  invalidate('/api/packages')
  // Customer-package responses join the Packages sheet for name and price.
  invalidate('/api/customer-packages')
  return result
}

export async function updatePackage(
  packageCode: string,
  payload: PackageUpdatePayload,
): Promise<PackageDto> {
  const result = await apiPatch<PackageDto>(`${PACKAGES_ENDPOINT}/${encodeURIComponent(packageCode)}`, {
    data: payload,
    requestSchema: packageUpdateRequestSchema,
  })
  invalidate('/api/packages')
  // Customer-package responses join the Packages sheet for name and price.
  invalidate('/api/customer-packages')
  return result
}
