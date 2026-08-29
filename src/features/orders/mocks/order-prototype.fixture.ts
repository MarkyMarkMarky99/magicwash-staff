/**
 * Throwaway prototype data for the Orders frontend. Delete this module when the
 * backend is available. Each fixture export names the backend blockers it replaces.
 */
import type { z } from 'zod'
import type { customerListResponseSchema } from '@contracts/customers/customer-api.schema'
import type { orderListResponseSchema } from '@contracts/orders/order-api.schema'

type Order = z.infer<typeof orderListResponseSchema>
type Customer = z.infer<typeof customerListResponseSchema>

export interface OrderPrototypePhoto {
  id: string
  orderId: string
  customerId: string | null
  deliveryId: string | null
  imageType: string | null
  imagePath: string | null
  notes: string | null
  quantity: number | null
  createdAt: string | null
  createdBy: string | null
}

/** Delete with Blocker 1 (global list) and Blocker 3 (create-order customer choices). */
export const prototypeCustomers: Customer[] = [
  { customerId: 'CUS-1001', customerIndex: 'C-001', customerName: 'ณัฐวดี สุขใจ', phone: '0812345678', address: 'สุขุมวิท  เขตวัฒนา กรุงเทพฯ', location: 'สุขุมวิท 55', customerType: 'Member' },
  { customerId: 'CUS-1002', customerIndex: 'C-002', customerName: 'ธนกฤต วัฒนานนท์', phone: '0895550198', address: null, location: 'พระโขนง', customerType: 'Regular' },
  { customerId: 'CUS-1003', customerIndex: 'C-003', customerName: 'โรงแรมริมคลอง', phone: '021234567', address: 'คลองตันเหนือ เขตวัฒนา กรุงเทพฯ', location: 'ทองหล่อ', customerType: 'Corporate' },
]

/** Delete with Blocker 1 (global list), Blocker 2 (detail), Blocker 3 (create), Blocker 4 (items), and Blocker 7 (OrdersView sync). */
export const prototypeOrders: Order[] = [
  { orderId: 'ORD-20260830-001', customerId: 'CUS-1001', orderNumber: 'ORD-260830-001', invoiceNumber: 'INV-260830-014', receivedDate: '2026-08-30', dueDate: '2026-09-02', serviceType: 'WSIR', status: 'PENDING', quantity: 12, note: 'เสื้อเชิ้ตสีขาวแยกซัก กรุณาตรวจคราบคอเสื้อ', items: [{ id: 'ITEM-001', description: 'เสื้อเชิ้ตสีขาว', serviceType: 'WSIR', quantity: 4 }, { id: 'ITEM-002', description: 'กางเกงสแลค', serviceType: 'IRON', quantity: 2 }] },
  { orderId: 'ORD-20260829-002', customerId: 'CUS-1002', orderNumber: 'ORD-260829-002', invoiceNumber: null, receivedDate: '2026-08-29', dueDate: null, serviceType: 'DRCL', status: 'RECEIVED', quantity: 3, note: 'ชุดสูทสีเข้ม ห้ามอบร้อน', items: [{ id: 'ITEM-003', description: 'สูทผ้าวูล', serviceType: 'DRCL', quantity: 1 }, { id: 'ITEM-004', description: 'กางเกงสูท', serviceType: 'DRCL', quantity: 2 }] },
  { orderId: 'ORD-20260828-003', customerId: 'CUS-1003', orderNumber: 'ORD-260828-003', invoiceNumber: 'INV-260828-009', receivedDate: '2026-08-28', dueDate: '2026-08-31', serviceType: 'WASH', status: 'SUBMITTED', quantity: 25, note: 'ผ้าปูที่นอนสำหรับห้องพัก', items: [{ id: 'ITEM-005', description: 'ผ้าปูที่นอนคิงไซซ์', serviceType: 'WASH', quantity: 10 }] },
  { orderId: 'ORD-20260827-004', customerId: 'CUS-1001', orderNumber: null, invoiceNumber: 'INV-260827-006', receivedDate: '2026-08-27', dueDate: '2026-08-30', serviceType: 'IRON', status: 'APPROVED', quantity: 8, note: null, items: [] },
  { orderId: 'ORD-20260826-005', customerId: 'CUS-1002', orderNumber: 'ORD-260826-005', invoiceNumber: null, receivedDate: '2026-08-26', dueDate: '2026-08-29', serviceType: 'WSIR', status: 'COMPLETED', quantity: 6, note: 'รับคืนที่เคาน์เตอร์หลัง 18.00 น.', items: [{ id: 'ITEM-006', description: 'เดรสผ้าไหม', serviceType: 'WSIR', quantity: 1 }] },
  { orderId: 'ORD-20260825-006', customerId: 'CUS-1003', orderNumber: 'ORD-260825-006', invoiceNumber: 'INV-260825-002', receivedDate: '2026-08-25', dueDate: '2026-08-28', serviceType: 'WASH', status: 'CANCELLED', quantity: null, note: 'ลูกค้ายกเลิกก่อนเริ่มงาน', items: [{ id: null, description: 'ผ้าเช็ดตัวโรงแรม', serviceType: 'WASH', quantity: 20.5 }] },
  { orderId: 'ORD-20260824-007', customerId: 'CUS-1001', orderNumber: 'ORD-260824-007', invoiceNumber: 'INV-260824-001', receivedDate: '2026-08-24', dueDate: '2026-08-27', serviceType: 'DRCL', status: null, quantity: 2, note: 'โปรดดูแลชุดไทยผ้าไหมปักดิ้นทองอย่างระมัดระวังเป็นพิเศษ ห้ามใช้น้ำยาฟอกขาว ห้ามรีดทับลายปัก ให้ห่อแยกชิ้นและโทรแจ้งลูกค้าก่อนดำเนินการหากพบรอยชำรุดหรือคราบที่ไม่สามารถขจัดได้', items: [{ id: 'ITEM-007', description: 'ชุดไทยผ้าไหมปักดิ้นทองสำหรับงานพิธีการ โปรดตรวจสภาพเนื้อผ้าและลายปักทุกชิ้นก่อนทำความสะอาด ห้ามใช้น้ำยาฟอกขาว ห้ามรีดทับลายปัก ให้ห่อแยกชิ้นและโทรแจ้งลูกค้าทันทีหากพบรอยชำรุดหรือคราบที่ไม่สามารถขจัดได้', serviceType: 'DRCL', quantity: 2 }] },
]

/** Delete with Blocker 2 (detail photo strip), Blocker 5 (image write), Blocker 6 (orders capture UI), and Blocker 7 (sync after image write). */
export const prototypeOrderPhotos: OrderPrototypePhoto[] = [
  { id: 'IMG-001', orderId: 'ORD-20260830-001', customerId: 'CUS-1001', deliveryId: null, imageType: 'WEIGHT', imagePath: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=320&q=80', notes: 'ชั่งน้ำหนักก่อนรับเข้า', quantity: 20.5, createdAt: '2026-08-30T09:15:00Z', createdBy: 'staff-001' },
  { id: 'IMG-002', orderId: 'ORD-20260830-001', customerId: 'CUS-1001', deliveryId: null, imageType: 'BAG', imagePath: 'https://images.unsplash.com/photo-1627225924765-552d49cf47ad?auto=format&fit=crop&w=320&q=80', notes: null, quantity: null, createdAt: '2026-08-30T09:16:00Z', createdBy: null },
  { id: 'IMG-003', orderId: 'ORD-20260829-002', customerId: 'CUS-1002', deliveryId: null, imageType: 'FORM', imagePath: null, notes: 'ใบรับผ้า', quantity: null, createdAt: '30/08/2026 09:20:00', createdBy: null },
]
