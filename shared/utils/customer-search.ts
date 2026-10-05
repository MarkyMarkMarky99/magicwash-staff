export interface CustomerSearchFields {
  customerIndex?: unknown
  customerName?: unknown
  phone?: unknown
  address?: unknown
}

export function normalizeSearchKeyword(keyword: string): string {
  return keyword.trim().toLowerCase()
}

export function containsKeyword(value: unknown, keyword: string): boolean {
  return String(value ?? '').toLowerCase().includes(normalizeSearchKeyword(keyword))
}

export function matchesCustomerKeyword(customer: CustomerSearchFields, keyword: string): boolean {
  if (normalizeSearchKeyword(keyword) === '') return true
  return [customer.customerIndex, customer.customerName, customer.phone, customer.address]
    .some((value) => containsKeyword(value, keyword))
}
