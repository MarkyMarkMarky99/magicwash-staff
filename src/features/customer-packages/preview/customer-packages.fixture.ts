export type PackageStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED'

export type PackageTransaction = {
  id: string
  type: 'PURCHASE' | 'USAGE' | 'REFUND' | 'ADJUSTMENT' | 'VOID' | 'EXPIRE' | 'TRANSFER'
  credit_change: number
  remaining_credit: number
  reference_source: string
  reference_id: string
  notes: string
  created_at: string
}

export type CustomerPackage = {
  id: string
  customer_id: string
  customer_name: string
  customer_phone: string | null
  customer_address: string | null
  package_code: string
  package_name: string
  package_eligible_service: string
  start_date: string
  expiry_date: string
  status: PackageStatus
  service_day: string | null
  time_slot: string | null
  invoice_id: string
  notes: string | null
  remaining_credit: number
  transactions: PackageTransaction[]
}

const tx = (
  id: string,
  type: PackageTransaction['type'],
  change: number,
  remaining: number,
  date: string,
  notes: string,
): PackageTransaction => ({
  id,
  type,
  credit_change: change,
  remaining_credit: remaining,
  reference_source: type === 'PURCHASE' ? 'INVOICE' : 'ORDER_ITEM',
  reference_id: type === 'PURCHASE' ? `INV-${id.slice(3, 11)}` : `ITEM-${id.slice(3, 11)}`,
  notes,
  created_at: `${date}T10:00:00Z`,
})

export const CUSTOMER_PACKAGES: CustomerPackage[] = [
  {
    id: 'CP-20260801-0001', customer_id: 'CUS-1001', customer_name: 'สมชาย ใจดี', customer_phone: '0812341001', customer_address: 'กรุงเทพมหานคร', package_code: 'PKG-WF-10', package_name: 'Wash & Fold 10', package_eligible_service: 'WASH_FOLD', start_date: '2026-08-01', expiry_date: '2026-10-29', status: 'ACTIVE', service_day: 'MON', time_slot: '10:00-12:00', invoice_id: 'INV260801001', notes: null, remaining_credit: 7,
    transactions: [tx('TX-20260801-0001', 'PURCHASE', 10, 10, '2026-08-01', 'Initial package credit'), tx('TX-20260805-0001', 'USAGE', -3, 7, '2026-08-05', 'Wash and fold order')],
  },
  {
    id: 'CP-20260728-0002', customer_id: 'CUS-1002', customer_name: 'นันทพร วัฒนะ', customer_phone: '0892341002', customer_address: 'นนทบุรี', package_code: 'PKG-WF-20', package_name: 'Wash & Fold 20', package_eligible_service: 'WASH_FOLD', start_date: '2026-07-28', expiry_date: '2026-10-25', status: 'ACTIVE', service_day: 'WED', time_slot: '13:00-15:00', invoice_id: 'INV260728002', notes: 'Preferred afternoon pickup', remaining_credit: 14,
    transactions: [tx('TX-20260728-0002', 'PURCHASE', 20, 20, '2026-07-28', 'Initial package credit'), tx('TX-20260804-0002', 'USAGE', -6, 14, '2026-08-04', 'Weekly laundry service')],
  },
  {
    id: 'CP-20260501-0003', customer_id: 'CUS-1003', customer_name: 'วิชัย รัตนกุล', customer_phone: '0862341003', customer_address: 'ปทุมธานี', package_code: 'PKG-SHOE-05', package_name: 'Shoe Care 5', package_eligible_service: 'SHOE_CLEANING', start_date: '2026-05-01', expiry_date: '2026-07-29', status: 'EXPIRED', service_day: null, time_slot: null, invoice_id: 'INV260501003', notes: null, remaining_credit: 0,
    transactions: [tx('TX-20260501-0003', 'PURCHASE', 5, 5, '2026-05-01', 'Initial package credit'), tx('TX-20260729-0003', 'EXPIRE', -5, 0, '2026-07-29', 'Unused credit expired')],
  },
  {
    id: 'CP-20260802-0004', customer_id: 'CUS-1004', customer_name: 'ศิริพร แสงทอง', customer_phone: '0822341004', customer_address: 'สมุทรปราการ', package_code: 'PKG-MIX-10', package_name: 'Laundry Mix 10', package_eligible_service: 'WASH_FOLD', start_date: '2026-08-02', expiry_date: '2026-10-31', status: 'ACTIVE', service_day: 'FRI', time_slot: '15:00-17:00', invoice_id: 'INV260802004', notes: 'Leave at reception', remaining_credit: 7,
    transactions: [tx('TX-20260802-0004', 'PURCHASE', 10, 10, '2026-08-02', 'Initial package credit'), tx('TX-20260809-0004', 'USAGE', -3, 7, '2026-08-09', 'Family laundry order')],
  },
  {
    id: 'CP-20260715-0005', customer_id: 'CUS-1005', customer_name: 'กิตติพงษ์ มั่นคง', customer_phone: '0952341005', customer_address: null, package_code: 'PKG-IRON-10', package_name: 'Pressing 10', package_eligible_service: 'PRESSING', start_date: '2026-07-15', expiry_date: '2026-10-13', status: 'ACTIVE', service_day: 'SAT', time_slot: '18:00-20:00', invoice_id: 'INV260715005', notes: null, remaining_credit: 14,
    transactions: [tx('TX-20260715-0005', 'PURCHASE', 20, 20, '2026-07-15', 'Initial package credit'), tx('TX-20260722-0005', 'USAGE', -6, 14, '2026-07-22', 'Pressing order')],
  },
  {
    id: 'CP-20260710-0008', customer_id: 'CUS-1008', customer_name: 'มาลี จันทร์ฉาย', customer_phone: null, customer_address: 'เชียงใหม่', package_code: 'PKG-MIX-10', package_name: 'Laundry Mix 10', package_eligible_service: 'WASH_FOLD', start_date: '2026-07-10', expiry_date: '2026-10-08', status: 'CANCELLED', service_day: 'THU', time_slot: '13:00-15:00', invoice_id: 'INV260710008', notes: 'Cancelled after address change', remaining_credit: 0,
    transactions: [tx('TX-20260710-0008', 'PURCHASE', 10, 10, '2026-07-10', 'Initial package credit'), tx('TX-20260712-0008', 'VOID', -10, 0, '2026-07-12', 'Credits voided on cancellation')],
  },
]

