import type { InjectionKey, Ref } from 'vue'

export const appointmentPendingCountKey: InjectionKey<Readonly<Ref<number>>> = Symbol(
  'appointment-pending-count',
)
