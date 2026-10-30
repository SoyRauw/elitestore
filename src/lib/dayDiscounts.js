import { supabase } from './supabase'

/** Fecha local YYYY-MM-DD (los días se guardan sin hora). */
export function localISODate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function computeDayDiscountAmount(discount, base) {
  const amountBase = Math.max(0, Number(base) || 0)
  if (!discount || amountBase <= 0) return 0
  const value = parseFloat(discount.discount_value) || 0
  if (discount.discount_type === 'percentage') {
    return Math.min(amountBase * (value / 100), amountBase)
  }
  return Math.min(value, amountBase)
}

/** Devuelve la promo que más descuenta para una fecha y base dadas. */
export function findBestDayDiscount(discounts, isoDate, base) {
  let best = null
  let bestAmount = 0
  for (const discount of discounts || []) {
    if (!discount?.is_active) continue
    if (!Array.isArray(discount.dates) || !discount.dates.includes(isoDate)) continue
    const amount = computeDayDiscountAmount(discount, base)
    if (amount > bestAmount) {
      best = discount
      bestAmount = amount
    }
  }
  return { discount: best, amount: Number(bestAmount.toFixed(2)) }
}

export async function fetchDayDiscounts(scope = 'elite') {
  const { data, error } = await supabase
    .from('day_discounts')
    .select('*')
    .eq('is_active', true)
    .in('store_scope', [scope, 'ambos'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchAllDayDiscounts() {
  const { data, error } = await supabase
    .from('day_discounts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export function dayDiscountValueLabel(discount) {
  if (!discount) return ''
  const value = parseFloat(discount.discount_value) || 0
  return discount.discount_type === 'percentage' ? `${value}%` : `$${value.toFixed(2)}`
}

/** Reparte un descuento entre las líneas, opcionalmente solo en las de detal. */
export function allocateDiscount(items, amount, { onlyRetail = false } = {}) {
  const allocations = (items || []).map(() => 0)
  const totalAmount = Number(amount) || 0
  if (totalAmount <= 0) return allocations

  const eligible = (items || []).map((item, index) => ({
    index,
    subtotal: (Number(item.price) || 0) * (Number(item.quantity) || 0),
    eligible: !onlyRetail || !item.wholesale,
  }))
  const eligibleTotal = eligible
    .filter((line) => line.eligible)
    .reduce((sum, line) => sum + line.subtotal, 0)
  if (eligibleTotal <= 0) return allocations

  let allocated = 0
  for (const line of eligible) {
    if (!line.eligible) continue
    const share = Number((totalAmount * (line.subtotal / eligibleTotal)).toFixed(2))
    allocations[line.index] = share
    allocated += share
  }

  const lastEligible = [...eligible].reverse().find((line) => line.eligible)
  if (lastEligible) {
    allocations[lastEligible.index] = Number(
      (allocations[lastEligible.index] + (totalAmount - allocated)).toFixed(2)
    )
  }
  return allocations
}
