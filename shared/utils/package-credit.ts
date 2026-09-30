export const OVERAGE_THB_PER_CREDIT = 25

export function overageAmount(credits: number): number {
  return Math.round(credits * OVERAGE_THB_PER_CREDIT * 100) / 100
}
