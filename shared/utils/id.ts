const LOWERCASE_HEX_ALPHABET = '0123456789abcdef'

export function generateId({
  length,
  alphabet,
  prefix = '',
}: {
  length: number
  alphabet: string
  prefix?: string
}): string {
  if (!Number.isSafeInteger(length) || length < 1) {
    throw new RangeError('length must be a positive safe integer')
  }
  if (alphabet.length === 0) {
    throw new RangeError('alphabet must not be empty')
  }

  let id = prefix
  let remaining = length
  const limit = 0x100000000 - (0x100000000 % alphabet.length)
  while (remaining > 0) {
    const randomValues = new Uint32Array(Math.min(remaining, 16384))
    crypto.getRandomValues(randomValues)
    for (const value of randomValues) {
      if (value >= limit) continue
      id += alphabet[value % alphabet.length]
      remaining--
    }
  }
  return id
}

export function generateShortId(prefix = ''): string {
  let id: string
  do {
    id = generateId({ length: 8, alphabet: LOWERCASE_HEX_ALPHABET, prefix })
  } while (/^[0-9]+(e[0-9]+)?$/.test(id))
  return id
}
