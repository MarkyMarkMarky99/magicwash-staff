let lockCount = 0
let previousBodyOverflow: string | undefined
let previousDocumentOverflow: string | undefined

export function acquirePageScrollLock() {
  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }

  lockCount += 1
}

export function releasePageScrollLock() {
  if (lockCount === 0) return

  lockCount -= 1
  if (lockCount !== 0) return

  document.body.style.overflow = previousBodyOverflow ?? ''
  document.documentElement.style.overflow = previousDocumentOverflow ?? ''
  previousBodyOverflow = undefined
  previousDocumentOverflow = undefined
}
