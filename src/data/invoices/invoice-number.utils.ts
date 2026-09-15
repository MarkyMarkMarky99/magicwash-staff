export function generateInvoiceNumber(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  let digits = ''
  for (let i = 0; i < 8; i++) {
    digits += String(Math.floor(Math.random() * 10))
  }
  return `INV${yy}${mm}${digits}`
}
