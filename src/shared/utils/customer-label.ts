export function formatCustomerLabel(name: string | null | undefined, index: string | null | undefined): string {
  const base = name?.trim() || ''
  const trimmedIndex = index?.trim()
  return trimmedIndex ? `${base} (${trimmedIndex})` : base
}
