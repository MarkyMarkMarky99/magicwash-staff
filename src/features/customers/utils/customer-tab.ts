export const CUSTOMER_DETAIL_TABS = ['orders', 'packages', 'invoices'] as const

export type CustomerDetailTab = typeof CUSTOMER_DETAIL_TABS[number]

export function resolveCustomerTab(value: unknown): CustomerDetailTab {
  return CUSTOMER_DETAIL_TABS.find((tab) => tab === value) ?? 'orders'
}
