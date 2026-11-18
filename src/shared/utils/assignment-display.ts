import type { TeamAgentAssignment } from '@shared/ai-gateway/tasks/team-agent'
import { agentDisplayName } from './agent-display-names'
import { formatSheetDateTime, normalizeSheetDate, sheetTimestampMs, todaySheetDate } from './sheet-date'

export interface AssignmentDue {
  day: string
  month: string
  year: string
  time: string
  today: boolean
}

const DUE_PATTERN = /^(\d{2}) ([A-Za-z]{3}) (\d{4}) (\d{2}:\d{2}):\d{2}$/

/** dueAt arrives as `yyyy-MM-dd HH:mm:ss` in Asia/Bangkok; formatSheetDateTime also accepts the other sheet formats. */
export function assignmentDue(assignment: Pick<TeamAgentAssignment, 'dueAt'>): AssignmentDue | null {
  if (!assignment.dueAt) return null
  const match = DUE_PATTERN.exec(formatSheetDateTime(assignment.dueAt))
  if (!match) return null
  return {
    day: String(Number(match[1])),
    month: match[2]!,
    year: match[3]!,
    time: match[4]!,
    today: normalizeSheetDate(assignment.dueAt) === todaySheetDate(),
  }
}

export function assignmentDueText(assignment: Pick<TeamAgentAssignment, 'dueAt'>): string {
  const due = assignmentDue(assignment)
  if (!due) return 'No due time'
  return due.today ? `due today ${due.time}` : `due ${due.day} ${due.month} ${due.time}`
}

export function assignmentOrderText(assignment: Pick<TeamAgentAssignment, 'orderId'>): string {
  return assignment.orderId ? `Order ${assignment.orderId}` : ''
}

export function assignmentOverdue(assignment: Pick<TeamAgentAssignment, 'dueAt' | 'status'>, now: number = Date.now()): boolean {
  const due = assignment.dueAt ? sheetTimestampMs(assignment.dueAt) : null
  return assignment.status === 'open' && due !== null && due < now
}

/** An agent creator shows as the agent's catalog name; an admin as their name or id. */
export function assignmentCreatorText(assignment: Pick<TeamAgentAssignment, 'createdBy'>): string {
  const creator = assignment.createdBy
  if (!creator) return ''
  if (creator.kind === 'agent' && creator.agentId) return agentDisplayName(creator.agentId) ?? creator.agentId
  return creator.name ?? creator.staffId ?? creator.agentId ?? ''
}
