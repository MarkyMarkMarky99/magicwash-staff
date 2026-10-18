export function isStaffCardCode(code: string): boolean {
  return code.trim().toUpperCase().startsWith('MWS-')
}
