import type { InjectionKey, Ref } from 'vue'

export const agentsUnreadKey: InjectionKey<Readonly<Ref<number>>> = Symbol('agents-unread')

/** Unread count per team agent id; an id missing from the map has none. */
export const agentsUnreadByAgentKey: InjectionKey<Readonly<Ref<Readonly<Record<string, number>>>>> = Symbol('agents-unread-by-agent')
