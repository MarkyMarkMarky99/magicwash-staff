type GateTicket = {
  laundryItemId?: string | null
  stepNo?: number | null
  status?: string | null
  department?: string | null
}

export function findEarlierJobTicket<T extends GateTicket>(ticket: GateTicket, orderTickets: readonly T[]): T | undefined {
  return orderTickets
    .filter(candidate => !!ticket.laundryItemId
      && candidate.laundryItemId === ticket.laundryItemId
      && typeof candidate.stepNo === 'number'
      && typeof ticket.stepNo === 'number'
      && candidate.stepNo < ticket.stepNo
      && candidate.status !== 'Completed')
    .sort((left, right) => (left.stepNo ?? 0) - (right.stepNo ?? 0))[0]
}
