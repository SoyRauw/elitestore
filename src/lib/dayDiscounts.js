import { supabase } from './supabase'

/** Fecha local YYYY-MM-DD (los días se guardan sin hora). */
export function localISODate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DISCOUNT_SELECT = '*, day_discount_categories(category_id, percentage, categories(id, name, store_id))'

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100

const formatPercent = (value) =>
  `${Number(value).toLocaleString('es-VE', { maximumFractionDigits: 2 })}%`

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
    .select(DISCOUNT_SELECT)
    .eq('is_active', true)
    .in('store_scope', [scope, 'ambos'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchActiveDayDiscounts() {
  const { data, error } = await supabase
    .from('day_discounts')
    .select(DISCOUNT_SELECT)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchAllDayDiscounts() {
  const { data, error } = await supabase
    .from('day_discounts')
    .select(DISCOUNT_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export function dayDiscountValueLabel(discount) {
  if (!discount) return ''
  if (discount.discount_scope === 'categories') {
    const rows = discountCategoryRows(discount)
    return rows.length ? `${rows.length} categorías` : 'Por categorías'
  }
  const value = parseFloat(discount.discount_value) || 0
  return discount.discount_type === 'percentage' ? formatPercent(value) : `$${value.toFixed(2)}`
}

export function discountCategoryRows(discount) {
  return Array.isArray(discount?.day_discount_categories)
    ? discount.day_discount_categories
    : []
}

export function discountMatchesDate(discount, isoDate) {
  return Boolean(
    discount?.is_active &&
    Array.isArray(discount.dates) &&
    discount.dates.includes(isoDate)
  )
}

export function discountMatchesStore(discount, storeId) {
  return discount?.store_scope === 'ambos' || discount?.store_scope === storeId
}

const itemStore = (item) => item.product?.store_id || item.variant?.store_id || 'elite'
const itemCategory = (item) =>
  item.product?.category_id || item.product?.categories?.id || null
const itemBase = (item) => (Number(item.price) || 0) * (Number(item.quantity) || 0)
const isRetail = (item) => !item.wholesale

const storePrefix = (discount) => {
  if (discount?.store_scope === 'elite') return 'Elite · '
  if (discount?.store_scope === 'usa') return 'USA · '
  return ''
}

const categoryLabel = (row) => row?.categories?.name || 'Categoría'

/**
 * Calcula el mejor descuento por línea para un carrito.
 * - Varias campañas pueden coincidir; cada línea toma la que más le convenga.
 * - Solo aplica a líneas de detal.
 * - Devuelve allocations por línea, total y las campañas aplicadas.
 */
export function computeDayDiscountAllocations(items, discounts, isoDate) {
  const list = Array.isArray(items) ? items : []
  const best = list.map(() => null)

  for (const discount of discounts || []) {
    if (!discountMatchesDate(discount, isoDate)) continue
    const scope = discount.discount_scope === 'categories' ? 'categories' : 'store'
    const prefix = storePrefix(discount)

    if (scope === 'categories') {
      for (const row of discountCategoryRows(discount)) {
        const percentage = Number(row.percentage) || 0
        if (percentage <= 0) continue
        const label = `${prefix}${categoryLabel(row)} ${formatPercent(percentage)}`

        list.forEach((item, index) => {
          if (!isRetail(item)) return
          if (!discountMatchesStore(discount, itemStore(item))) return
          if (itemCategory(item) !== row.category_id) return

          const amount = round2(itemBase(item) * (percentage / 100))
          if (amount > (best[index]?.amount || 0)) {
            best[index] = { amount, label, discountId: discount.id }
          }
        })
      }
      continue
    }

    const eligible = list
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => isRetail(item) && discountMatchesStore(discount, itemStore(item)))
    if (eligible.length === 0) continue

    if (discount.discount_type === 'percentage') {
      const percentage = Number(discount.discount_value) || 0
      if (percentage <= 0) continue
      const label = `${prefix}${discount.name} (${formatPercent(percentage)})`

      eligible.forEach(({ item, index }) => {
        const amount = round2(itemBase(item) * (percentage / 100))
        if (amount > (best[index]?.amount || 0)) {
          best[index] = { amount, label, discountId: discount.id }
        }
      })
      continue
    }

    const value = Number(discount.discount_value) || 0
    const base = eligible.reduce((sum, { item }) => sum + itemBase(item), 0)
    const total = Math.min(value, base)
    if (total <= 0) continue
    const label = `${prefix}${discount.name} ($${value.toFixed(2)})`

    const shares = eligible.map(({ item, index }) => ({
      index,
      share: round2(total * (itemBase(item) / base)),
    }))
    const allocated = shares.reduce((sum, line) => sum + line.share, 0)
    const diff = round2(total - allocated)
    if (diff !== 0 && shares.length > 0) {
      shares[shares.length - 1].share = round2(shares[shares.length - 1].share + diff)
    }

    shares.forEach(({ index, share }) => {
      if (share > (best[index]?.amount || 0)) {
        best[index] = {
          amount: Math.min(share, itemBase(list[index])),
          label,
          discountId: discount.id,
        }
      }
    })
  }

  const allocations = best.map((entry, index) => {
    const amount = Math.min(entry?.amount || 0, itemBase(list[index]))
    return round2(amount)
  })

  const appliedMap = new Map()
  best.forEach((entry, index) => {
    if (!entry || allocations[index] <= 0) return
    const current = appliedMap.get(entry.discountId) || {
      discountId: entry.discountId,
      amount: 0,
      labels: new Set(),
    }
    current.amount = round2(current.amount + allocations[index])
    current.labels.add(entry.label)
    appliedMap.set(entry.discountId, current)
  })

  const applied = [...appliedMap.values()]
  const rawLabels = [...new Set(applied.flatMap((entry) => [...entry.labels]))]
  const groupedLabels = new Map()
  rawLabels.forEach((label) => {
    const prefix = label.startsWith('Elite · ')
      ? 'Elite · '
      : label.startsWith('USA · ')
        ? 'USA · '
        : ''
    const rest = label.slice(prefix.length)
    if (!groupedLabels.has(prefix)) groupedLabels.set(prefix, [])
    groupedLabels.get(prefix).push(rest)
  })
  const label = [...groupedLabels.entries()]
    .map(([prefix, parts]) => `${prefix}${parts.join(' · ')}`)
    .join(' · ')

  return {
    total: round2(allocations.reduce((sum, amount) => sum + amount, 0)),
    allocations,
    applied,
    label,
  }
}

/** Mejor porcentaje para una categoría/tienda en la tienda pública. */
export function bestDiscountForCategory(discounts, storeId, categoryId, isoDate) {
  let best = null

  for (const discount of discounts || []) {
    if (!discountMatchesDate(discount, isoDate)) continue
    if (!discountMatchesStore(discount, storeId)) continue
    const prefix = storePrefix(discount)

    if (discount.discount_scope === 'categories') {
      if (!categoryId) continue
      for (const row of discountCategoryRows(discount)) {
        if (row.category_id !== categoryId) continue
        const percentage = Number(row.percentage) || 0
        if (percentage <= 0) continue
        if (!best || percentage > best.percentage) {
          best = {
            percentage,
            label: `${prefix}${categoryLabel(row)} ${formatPercent(percentage)}`,
            discount,
          }
        }
      }
      continue
    }

    if (discount.discount_type !== 'percentage') continue
    const percentage = Number(discount.discount_value) || 0
    if (percentage <= 0) continue
    if (!best || percentage > best.percentage) {
      best = {
        percentage,
        label: `${prefix}${discount.name} (${formatPercent(percentage)})`,
        discount,
      }
    }
  }

  return best
}

/** Etiquetas de todas las promos de porcentaje activas hoy para una tienda. */
export function promotionsForStore(discounts, storeId, isoDate) {
  const labels = new Set()

  for (const discount of discounts || []) {
    if (!discountMatchesDate(discount, isoDate)) continue
    if (!discountMatchesStore(discount, storeId)) continue
    const prefix = storePrefix(discount)

    if (discount.discount_scope === 'categories') {
      for (const row of discountCategoryRows(discount)) {
        const percentage = Number(row.percentage) || 0
        if (percentage > 0) {
          labels.add(`${prefix}${categoryLabel(row)} ${formatPercent(percentage)}`)
        }
      }
      continue
    }

    if (discount.discount_type !== 'percentage') continue
    const percentage = Number(discount.discount_value) || 0
    if (percentage > 0) {
      labels.add(`${prefix}${discount.name} (${formatPercent(percentage)})`)
    }
  }

  return [...labels]
}

/** Reparte un descuento entre las líneas, opcionalmente solo en las de detal y por tienda. */
export function allocateDiscount(items, amount, { onlyRetail = false, storeIds = null } = {}) {
  const allocations = (items || []).map(() => 0)
  const totalAmount = Number(amount) || 0
  if (totalAmount <= 0) return allocations

  const eligible = (items || []).map((item, index) => {
    const itemStoreId = item.product?.store_id || item.variant?.store_id || 'elite'
    const matchesStore = !storeIds || storeIds.includes(itemStoreId)
    return {
      index,
      subtotal: itemBase(item),
      eligible: (!onlyRetail || !item.wholesale) && matchesStore,
    }
  })
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
