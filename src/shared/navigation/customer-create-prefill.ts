export type CustomerCreatePrefill = Partial<{
  customerName: string
  phone: string
  address: string
  lineId: string
  facebook: string
  whatsapp: string
  email: string
  customerType: 'Member' | 'Regular' | 'Corporate'
}>

let customerCreatePrefill: CustomerCreatePrefill | null = null

export function setCustomerCreatePrefill(values: CustomerCreatePrefill): void {
  customerCreatePrefill = values
}

export function takeCustomerCreatePrefill(): CustomerCreatePrefill | null {
  const values = customerCreatePrefill
  customerCreatePrefill = null
  return values
}
