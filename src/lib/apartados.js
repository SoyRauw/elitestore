/**
 * Apartados (layaway) helpers.
 * A layaway is a movement with movement_type = 'apartado'.
 * Initial payment must be >= 20% of the total.
 * Payment window: 15 days from creation (extendable in 15-day chunks).
 */

export const APARTADO_INITIAL_PCT = 0.20
export const APARTADO_DAYS = 15
export const APARTADO_EXTENSION_DAYS = 15

export function minInitialFor(total) {
  return Math.ceil((parseFloat(total) || 0) * APARTADO_INITIAL_PCT * 100) / 100
}

export function dueDateFrom(createdAtISO) {
  const d = new Date(createdAtISO || Date.now())
  d.setDate(d.getDate() + APARTADO_DAYS)
  return d
}

export function dueDateExtended(fromISO, extensions) {
  const d = new Date(fromISO || new Date().toISOString())
  d.setDate(d.getDate() + APARTADO_DAYS * (1 + (parseInt(extensions, 10) || 0)))
  return d
}

export function paidAmount(payments) {
  return (payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
}

export function pendingAmount(total, payments) {
  return Math.max(0, Math.round(((parseFloat(total) || 0) - paidAmount(payments)) * 100) / 100)
}

/** Pending of an apartado using its denormalized paid_amount */
export function pendingFromPaid(total, paidAmountValue) {
  return Math.max(0, Math.round(((parseFloat(total) || 0) - (parseFloat(paidAmountValue) || 0)) * 100) / 100)
}

/** daysUntil due date for an active apartado (negative = overdue) */
export function daysUntilDue(movement) {
  if (!movement?.due_date) return null
  return Math.ceil(
    (new Date(movement.due_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  )
}

/** 'ok' | 'soon' (<=3 days) | 'overdue' */
export function apartadoStatusBadge(movement) {
  if (movement.status !== 'activo') return movement.status
  const days = daysUntilDue(movement)
  if (days === null) return 'activo'
  if (days < 0) return 'overdue'
  if (days <= 3) return 'soon'
  return 'ok'
}
