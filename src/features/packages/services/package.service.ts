import type { z } from 'zod'
import {
  packageCreateRequestSchema,
  packageListQuerySchema,
  packageResponseSchema,
  packageUpdateRequestSchema,
} from '@contracts/packages/package-api.schema'
import { apiGetList, apiPatch, apiPost } from '@/shared/api/api-client'

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

export function createPackage(payload: PackageCreatePayload): Promise<PackageDto> {
  return apiPost<PackageDto>(PACKAGES_ENDPOINT, {
    data: payload,
    requestSchema: packageCreateRequestSchema,
  })
}

export function updatePackage(
  packageCode: string,
  payload: PackageUpdatePayload,
): Promise<PackageDto> {
  return apiPatch<PackageDto>(`${PACKAGES_ENDPOINT}/${encodeURIComponent(packageCode)}`, {
    data: payload,
    requestSchema: packageUpdateRequestSchema,
  })
}
