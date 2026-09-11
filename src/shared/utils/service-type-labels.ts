import { serviceTypeSchema } from '@contracts/shared/service-type.schema'

/**
 * The one Thai wording for a service-type code, and the one icon for it.
 *
 * This lives in `src/shared/utils/` because price-list, invoices and orders all display a service
 * type and features may not import each other. It is not in `contracts/` — that folder holds
 * camelCase API schemas and enums only (CLAUDE.md), and a Thai label is presentation, not contract.
 * The rule against domain knowledge in `src/shared/` is about presentational components; a util
 * that every feature needs belongs here, next to `sheet-date.ts`.
 *
 * Before 2026-09-06 there were four copies with two different Thai wordings
 * (`ซัก อบ รีด` in price-list/invoices vs `ซักรีด` in orders). The orders wording won.
 * Do not reintroduce a local copy — change the wording here instead.
 */
type ServiceType = (typeof serviceTypeSchema.options)[number]

export const serviceTypePresentation: Record<ServiceType, { label: string; icon: string }> = {
  WSIR: { label: 'ซักรีด', icon: 'local_laundry_service' },
  IRON: { label: 'รีด', icon: 'iron' },
  DRCL: { label: 'ซักแห้ง', icon: 'dry_cleaning' },
  WASH: { label: 'ซัก', icon: 'water_drop' },
}

export function serviceTypeLabel(serviceType: string | null | undefined): string | null {
  if (!serviceType) return null
  return serviceTypePresentation[serviceType as ServiceType]?.label ?? serviceType
}

export const serviceTypeOptions = serviceTypeSchema.options.map((value) => ({
  value,
  label: serviceTypePresentation[value].label,
  icon: serviceTypePresentation[value].icon,
}))
