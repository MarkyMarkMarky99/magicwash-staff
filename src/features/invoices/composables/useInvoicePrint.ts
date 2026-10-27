import { ref } from 'vue'
import { printInvoice } from '@/data/invoices/invoice-print.service'
import { ApiError } from '@/shared/api/api-client'

/**
 * Sends a saved invoice to the shop printer through the print server and
 * keeps the Thai success/error message for the page to show.
 *
 * `isCurrent` lets a page drop the result when it has moved on to another
 * invoice while the request was in flight.
 */
export function useInvoicePrint() {
  const printing = ref(false)
  const printSuccess = ref<string | null>(null)
  const printError = ref<string | null>(null)

  function resetPrintStatus() {
    printSuccess.value = null
    printError.value = null
  }

  async function print(invoiceNumber: string, isCurrent: () => boolean = () => true) {
    if (printing.value) return

    printing.value = true
    resetPrintStatus()

    try {
      const result = await printInvoice(invoiceNumber)
      if (!isCurrent()) return
      printSuccess.value = `ส่งคำขอพิมพ์ไปยัง ${result.printerName} แล้ว`
    } catch (reason) {
      if (!isCurrent()) return
      if (reason instanceof ApiError && reason.status === 422) {
        printError.value = 'เลขที่ใบแจ้งหนี้ไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง'
      } else if (reason instanceof ApiError && reason.status === 502) {
        printError.value = 'ไม่สามารถติดต่อเครื่องพิมพ์ได้ กรุณาตรวจสอบเครื่องพิมพ์แล้วลองอีกครั้ง'
      } else {
        printError.value = 'ไม่สามารถส่งคำขอพิมพ์ได้ กรุณาตรวจสอบเครื่องพิมพ์ก่อนลองอีกครั้ง'
      }
    } finally {
      printing.value = false
    }
  }

  return { printing, printSuccess, printError, resetPrintStatus, print }
}
