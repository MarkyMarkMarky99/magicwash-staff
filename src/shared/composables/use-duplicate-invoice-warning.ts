import { computed, ref, watch, type Ref } from 'vue'

type DuplicateInvoiceOrder = {
  invoiceNumber: string | null
}

export function useDuplicateInvoiceWarning(
  order: Ref<DuplicateInvoiceOrder | null>,
) {
  const awaitingConfirmationState = ref(false)
  const awaitingConfirmation = computed(() => awaitingConfirmationState.value)

  const warningInvoiceNumber = computed(() => {
    const invoiceNumber = order.value?.invoiceNumber?.trim()
    return invoiceNumber || null
  })

  watch(
    order,
    () => {
      awaitingConfirmationState.value = false
    },
    { flush: 'sync' },
  )

  function requestCreate(): boolean {
    if (warningInvoiceNumber.value === null) return true
    awaitingConfirmationState.value = true
    return false
  }

  function confirmCreate(): boolean {
    awaitingConfirmationState.value = false
    return true
  }

  function cancelCreate() {
    awaitingConfirmationState.value = false
  }

  function reset() {
    awaitingConfirmationState.value = false
  }

  return {
    warningInvoiceNumber,
    awaitingConfirmation,
    requestCreate,
    confirmCreate,
    cancelCreate,
    reset,
  }
}
