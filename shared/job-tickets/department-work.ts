export function isDepartmentWorkTicket(ticket: {
  scope?: string
  department?: string
  taskCode?: string | null
  deletedAt?: string | null
}, department?: string): boolean {
  return department === 'Logistics'
    ? ticket.scope === 'ORDER' && ticket.department === 'Logistics' && ticket.taskCode === 'LOG-BAG' && !ticket.deletedAt
    : ticket.scope === 'ITEM'
}
