export function isInvoiceActionAvailable(order: { invoiceNumber?: string | null }): boolean {
  return Boolean(order.invoiceNumber?.trim())
}
