import { supabase } from './supabase'

/** Costo total por unidad (costo + envío + flete) */
export function unitCostOf(product) {
  return (parseFloat(product?.cost_price) || 0)
    + (parseFloat(product?.shipping_cost) || 0)
    + (parseFloat(product?.freight_cost) || 0)
}

export function money(value) {
  return `$${(parseFloat(value) || 0).toFixed(2)}`
}

export function toISODate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function monthEnd(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1)
}

export function presetRange(preset) {
  const now = new Date()
  const thisStart = monthStart(now)
  const thisEnd = monthEnd(now)
  switch (preset) {
    case 'last-month': {
      const s = addMonths(thisStart, -1)
      return { from: toISODate(s), to: toISODate(monthEnd(s)), label: 'Mes pasado' }
    }
    case '3m':
      return { from: toISODate(addMonths(thisStart, -2)), to: toISODate(thisEnd), label: 'Últimos 3 meses' }
    case '6m':
      return { from: toISODate(addMonths(thisStart, -5)), to: toISODate(thisEnd), label: 'Últimos 6 meses' }
    case 'year':
      return { from: toISODate(new Date(now.getFullYear(), 0, 1)), to: toISODate(new Date(now.getFullYear(), 11, 31)), label: 'Este año' }
    default:
      return { from: toISODate(thisStart), to: toISODate(thisEnd), label: 'Este mes' }
  }
}

export function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function recurrenceOf(expense) {
  const e = expense || {}
  return e.recurrence || (e.is_recurring ? 'monthly' : 'once')
}

export function recurrenceLabel(expense) {
  const e = expense || {}
  const rec = recurrenceOf(e)
  if (rec === 'once') return 'No se repite'
  const startISO = e.recurring_start || e.expense_date
  const start = startISO ? new Date(`${startISO}T00:00:00`) : null
  if (rec === 'weekly') return `Semanal (${start ? WEEKDAYS[start.getDay()] : 'cada 7 días'})`
  if (rec === 'semimonthly') return 'Quincenal (15 y último día)'
  if (rec === 'monthly') return `Mensual (día ${start ? start.getDate() : '—'})`
  if (rec === 'yearly') return `Anual (${start ? `${start.getDate()} de ${MONTHS[start.getMonth()]}` : '—'})`
  return rec
}

/** Fechas (YYYY-MM-DD) en que ocurre un gasto dentro de [fromISO, toISO] */
export function occurrencesInRange(expense, fromISO, toISO) {
  const e = expense || {}
  const rec = recurrenceOf(e)
  const from = new Date(`${fromISO}T00:00:00`)
  const to = new Date(`${toISO}T00:00:00`)
  const startISO = e.recurring_start || e.expense_date
  if (!startISO) return []
  const start = new Date(`${startISO}T00:00:00`)
  const end = e.recurring_end ? new Date(`${e.recurring_end}T00:00:00`) : null
  const out = []

  if (rec === 'once') {
    if (!e.expense_date) return []
    const d = new Date(`${e.expense_date}T00:00:00`)
    if (d >= from && d <= to) out.push(e.expense_date)
    return out
  }

  const push = (d) => {
    if (d < start) return
    if (end && d > end) return
    if (d < from || d > to) return
    out.push(toISODate(d))
  }

  if (rec === 'weekly') {
    const STEP = 7 * 24 * 60 * 60 * 1000
    let d = new Date(start)
    if (d < from) {
      const steps = Math.ceil((from - d) / STEP)
      d = new Date(d.getTime() + steps * STEP)
    }
    while (d <= to && (!end || d <= end)) {
      out.push(toISODate(d))
      d = new Date(d.getTime() + STEP)
    }
    return out
  }

  if (rec === 'semimonthly') {
    let y = from.getFullYear()
    let m = from.getMonth()
    while (y < to.getFullYear() || (y === to.getFullYear() && m <= to.getMonth())) {
      push(new Date(y, m, 15))
      push(new Date(y, m, lastDayOfMonth(y, m)))
      m++
      if (m > 11) { m = 0; y++ }
    }
    return out
  }

  if (rec === 'yearly') {
    const anchorMonth = start.getMonth()
    const anchorDay = start.getDate()
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
      const day = Math.min(anchorDay, lastDayOfMonth(y, anchorMonth))
      push(new Date(y, anchorMonth, day))
    }
    return out
  }

  // Mensual (y compatibilidad con gastos fijos antiguos sin recurrence)
  const anchorDay = start.getDate()
  let y = from.getFullYear()
  let m = from.getMonth()
  while (y < to.getFullYear() || (y === to.getFullYear() && m <= to.getMonth())) {
    const day = Math.min(anchorDay, lastDayOfMonth(y, m))
    push(new Date(y, m, day))
    m++
    if (m > 11) { m = 0; y++ }
  }
  return out
}

function monthKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-VE', { month: 'short', year: '2-digit' })
}

export async function fetchCategories() {
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .order('name')
  if (error) throw error
  return data || []
}

export async function fetchExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, expense_categories(name, color)')
    .order('expense_date', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchProductsWithCosts() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, wholesale_price, cost_price, shipping_cost, freight_cost, profit_margin, category_id, images, categories(name), product_variants(id, sku, stock, price, image)')
    .order('name')
  if (error) throw error
  return data || []
}

export async function backfillCosts(overwrite = false) {
  const { data, error } = await supabase.rpc('backfill_movement_item_costs', { p_overwrite: overwrite })
  if (error) throw error
  return data
}

/**
 * Resumen financiero del período.
 * - Ingresos: ventas + apartados completados, netos de devoluciones (returned_quantity).
 * - COGS: costo congelado (o costo actual si aún no se ha hecho backfill).
 * - Gastos: variables del rango + fijos mensuales activos (una vez por mes).
 * - Compras: compras de mercancía del rango.
 */
export async function fetchFinanceSummary(from, to) {
  const fromISO = `${from}T00:00:00`
  const toISO = `${to}T23:59:59.999`

  const [movRes, expRes, prodRes, giftRes, catRes] = await Promise.all([
    supabase
      .from('movements')
      .select('id, created_at, total_amount, movement_type, movement_items(quantity, unit_price, discount_amount, unit_cost, returned_quantity, product_id, products(name, cost_price, shipping_cost, freight_cost))')
      .in('movement_type', ['venta', 'apartado'])
      .eq('status', 'pagado')
      .gte('created_at', fromISO)
      .lte('created_at', toISO),
    supabase.from('expenses').select('*, expense_categories(name, color)'),
    supabase.from('products').select('id, cost_price, shipping_cost, freight_cost, product_variants(stock)'),
    supabase
      .from('movements')
      .select('total_amount')
      .eq('movement_type', 'giftcard')
      .eq('status', 'pagado')
      .gte('created_at', fromISO)
      .lte('created_at', toISO),
    supabase.from('expense_categories').select('id, name, color'),
  ])

  if (movRes.error) throw movRes.error
  if (expRes.error) throw expRes.error
  if (prodRes.error) throw prodRes.error
  if (giftRes.error) throw giftRes.error
  if (catRes.error) throw catRes.error

  const movements = movRes.data || []
  const products = prodRes.data || []
  const productCost = new Map(products.map((p) => [p.id, unitCostOf(p)]))

  let revenue = 0
  let cogs = 0
  const byMonth = {}
  const byProduct = {}

  for (const m of movements) {
    const key = monthKey(m.created_at)
    if (!byMonth[key]) byMonth[key] = { key, label: monthLabel(key), revenue: 0, cogs: 0, expenses: 0, purchases: 0 }
    for (const it of m.movement_items || []) {
      const qty = Math.max(0, (it.quantity || 0) - (it.returned_quantity || 0))
      const originalQty = Math.max(1, it.quantity || 0)
      const price = parseFloat(it.unit_price) || 0
      const cost = parseFloat(it.unit_cost) || productCost.get(it.product_id) || 0
      const discountShare = (parseFloat(it.discount_amount) || 0) * (qty / originalQty)
      const lineRevenue = Math.max(0, qty * price - discountShare)
      const lineCost = qty * cost
      revenue += lineRevenue
      cogs += lineCost
      byMonth[key].revenue += lineRevenue
      byMonth[key].cogs += lineCost

      const pName = it.products?.name || 'Producto'
      if (!byProduct[pName]) byProduct[pName] = { name: pName, revenue: 0, cogs: 0 }
      byProduct[pName].revenue += lineRevenue
      byProduct[pName].cogs += lineCost
    }
  }

  // Gastos
  const expenses = expRes.data || []
  let variableTotal = 0
  let fixedTotal = 0
  const byCategory = {}
  const catMap = new Map((catRes.data || []).map((c) => [c.id, c]))

  for (const e of expenses) {
    const amount = parseFloat(e.amount) || 0
    if (!amount) continue
    const rec = recurrenceOf(e)
    if (rec !== 'once') {
      if (!e.active) continue
      const dates = occurrencesInRange(e, from, to)
      if (dates.length === 0) continue
      const total = amount * dates.length
      fixedTotal += total
      const cat = catMap.get(e.category_id)?.name || 'Otros'
      byCategory[cat] = (byCategory[cat] || 0) + total
      for (const dateISO of dates) {
        const key = monthKey(`${dateISO}T12:00:00`)
        if (!byMonth[key]) byMonth[key] = { key, label: monthLabel(key), revenue: 0, cogs: 0, expenses: 0, purchases: 0 }
        byMonth[key].expenses += amount
      }
    } else {
      if (e.expense_date < from || e.expense_date > to) continue
      variableTotal += amount
      const cat = catMap.get(e.category_id)?.name || 'Otros'
      byCategory[cat] = (byCategory[cat] || 0) + amount
      const key = monthKey(`${e.expense_date}T12:00:00`)
      if (!byMonth[key]) byMonth[key] = { key, label: monthLabel(key), revenue: 0, cogs: 0, expenses: 0, purchases: 0 }
      byMonth[key].expenses += amount
    }
  }

  const inventoryValue = products.reduce((sum, p) => {
    const stock = (p.product_variants || []).reduce((s, v) => s + (parseInt(v.stock, 10) || 0), 0)
    return sum + stock * unitCostOf(p)
  }, 0)

  const expensesTotal = variableTotal + fixedTotal
  const grossProfit = revenue - cogs
  const netProfit = grossProfit - expensesTotal
  // Inversión = valor del inventario actual + gastos del período
  const investment = inventoryValue + expensesTotal
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0
  const roi = investment > 0 ? (netProfit / investment) * 100 : null
  const giftcardsSold = (giftRes.data || []).reduce((s, g) => s + (parseFloat(g.total_amount) || 0), 0)

  const series = Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key))
  const topProducts = Object.values(byProduct)
    .map((p) => ({ ...p, profit: p.revenue - p.cogs }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 8)

  return {
    revenue,
    cogs,
    grossProfit,
    variableTotal,
    fixedTotal,
    expensesTotal,
    netProfit,
    investment,
    margin,
    roi,
    inventoryValue,
    giftcardsSold,
    series,
    byCategory,
    topProducts,
  }
}

/** Actividad diaria para el calendario: ventas, abonos, gastos y compras */
export async function fetchDailyActivity(from, to) {
  const fromISO = `${from}T00:00:00`
  const toISO = `${to}T23:59:59.999`

  const [movRes, expRes] = await Promise.all([
    supabase
      .from('movements')
      .select('id, created_at, movement_type, status, total_amount, customer_name, payment_method, movement_payments(method, amount), movement_items(quantity, unit_price, discount_amount, unit_cost, returned_quantity, product_id, products(name, cost_price, shipping_cost, freight_cost))')
      .in('movement_type', ['venta', 'apartado', 'abono', 'giftcard'])
      .eq('status', 'pagado')
      .gte('created_at', fromISO)
      .lte('created_at', toISO)
      .order('created_at', { ascending: true }),
    supabase.from('expenses').select('*, expense_categories(name, color)'),
  ])

  if (movRes.error) throw movRes.error
  if (expRes.error) throw expRes.error

  const days = {}

  const ensure = (date) => {
    if (!days[date]) {
      days[date] = { date, sales: [], abonos: [], giftcards: [], expenses: [], revenue: 0, cogs: 0, expensesTotal: 0 }
    }
    return days[date]
  }

  for (const m of movRes.data || []) {
    const date = toISODate(new Date(m.created_at))
    const day = ensure(date)
    if (m.movement_type === 'abono') {
      day.abonos.push(m)
      continue
    }
    if (m.movement_type === 'giftcard') {
      day.giftcards.push(m)
      continue
    }
    let revenue = 0
    let cogs = 0
    for (const it of m.movement_items || []) {
      const qty = Math.max(0, (it.quantity || 0) - (it.returned_quantity || 0))
      const originalQty = Math.max(1, it.quantity || 0)
      const discountShare = (parseFloat(it.discount_amount) || 0) * (qty / originalQty)
      revenue += Math.max(0, qty * (parseFloat(it.unit_price) || 0) - discountShare)
      cogs += qty * (parseFloat(it.unit_cost) || unitCostOf(it.products) || 0)
    }
    day.sales.push({ ...m, revenue, cogs })
    day.revenue += revenue
    day.cogs += cogs
  }

  for (const e of expRes.data || []) {
    const amount = parseFloat(e.amount) || 0
    if (!amount) continue
    const rec = recurrenceOf(e)
    if (rec !== 'once') {
      if (!e.active) continue
      const dates = occurrencesInRange(e, from, to)
      for (const dateISO of dates) {
        const day = ensure(dateISO)
        day.expenses.push({ ...e, is_fixed_day: true })
        day.expensesTotal += amount
      }
      continue
    }
    if (e.expense_date < from || e.expense_date > to) continue
    const day = ensure(e.expense_date)
    day.expenses.push(e)
    day.expensesTotal += amount
  }

  return days
}
