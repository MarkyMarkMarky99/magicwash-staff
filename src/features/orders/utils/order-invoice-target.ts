export type InvoiceTarget = {
  name: 'invoice-detail'
  params: {
    invoiceNumber: string
  }
}

export function isInvoiceActionAvailable(order: { invoiceNumber?: string | null }): boolean {
  return Boolean(order.invoiceNumber?.trim())
}

export function getInvoiceTarget(invoiceNumber: string | null | undefined): InvoiceTarget | null {
  const normalizedInvoiceNumber = invoiceNumber?.trim()
  if (!normalizedInvoiceNumber) return null

  return {
    name: 'invoice-detail',
    params: { invoiceNumber: normalizedInvoiceNumber },
  }
}
