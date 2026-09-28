export function formatPhoneDisplay(digits: string): string {
  if (digits.length < 3) return digits

  const first = digits.slice(0, 3)
  const middle = digits.slice(3, 6)
  if (digits.length < 6) return `${first}-${middle}`

  return `${first}-${middle}-${digits.slice(6, 10)}`
}

export function nextPhoneDigits(previousDigits: string, rawInput: string): string {
  const digits = rawInput.replace(/\D/g, '')
  if (digits === previousDigits && rawInput.length < formatPhoneDisplay(previousDigits).length) {
    return previousDigits.slice(0, -1)
  }
  return digits.slice(0, 10)
}
