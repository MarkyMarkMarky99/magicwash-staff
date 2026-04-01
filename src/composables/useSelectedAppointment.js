import { ref } from 'vue'

const appointment = ref(null)
const currentDate = ref(null)

export function useSelectedAppointment() {
  return { appointment, currentDate }
}
