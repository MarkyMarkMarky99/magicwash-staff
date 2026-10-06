import type { InjectionKey, Ref } from 'vue'

export const staffSignedInKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('staff-signed-in')
