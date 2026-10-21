import { ApiError } from '../../shared/http/api-error.js'

type CustomerPhoneRow = {
  CustomerID?: string
  Phone?: string | null
  DeletedAt?: string | null
}

export function requireAvailableCustomerPhone(
  customers: readonly CustomerPhoneRow[],
  phone: string,
  customerId?: string,
): void {
  const phoneDigits = phone.replace(/\D/g, '')
  if (customers.some((row) =>
    (customerId === undefined || row.CustomerID !== customerId)
    && (row.DeletedAt == null || row.DeletedAt === '')
    && typeof row.Phone === 'string'
    && row.Phone.replace(/\D/g, '') === phoneDigits
  )) {
    throw ApiError.conflict('duplicate_phone', { code: 'duplicate_phone' })
  }
}
