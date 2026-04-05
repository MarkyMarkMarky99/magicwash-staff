import { ref } from 'vue'

const customer = ref(null)

export function useSelectedCustomer() {
  return { customer }
}
