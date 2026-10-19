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

function monthsBetween(fromISO, toISO) {
  const a = new Date(`${fromISO}T00:00:00`)
  const b = new Date(`${toISO}T00:00:00`)
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1)
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
      .select('id, created_at, total_amount, movement_type, movement_items(quantity, unit_price, unit_cost, returned_quantity, product_id, products(name, cost_price, shipping_cost, freight_cost))')
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
      const price = parseFloat(it.unit_price) || 0
      const cost = parseFloat(it.unit_cost) || productCost.get(it.product_id) || 0
      const lineRevenue = qty * price
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
  const months = monthsBetween(from, to)
  let variableTotal = 0
  let fixedTotal = 0
  const byCategory = {}
  const catMap = new Map((catRes.data || []).map((c) => [c.id, c]))

  for (const e of expenses) {
    const amount = parseFloat(e.amount) || 0
    if (!amount) continue
    if (e.is_recurring || e.recurrence === 'monthly') {
      if (!e.active) continue
      const start = e.recurring_start || e.expense_date
      const end = e.recurring_end
      if (start > to) continue
      if (end && end < from) continue
      const s = start > from ? start : from
      const t = end && end < to ? end : to
      const count = monthsBetween(s, t)
      const total = amount * count
      fixedTotal += total
      const cat = catMap.get(e.category_id)?.name || 'Otros'
      byCategory[cat] = (byCategory[cat] || 0) + total
      for (let i = 0; i < count; i++) {
        const d = addMonths(new Date(`${s}T00:00:00`), i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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
    months,
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
      .select('id, created_at, movement_type, status, total_amount, customer_name, payment_method, movement_payments(method, amount), movement_items(quantity, unit_price, unit_cost, returned_quantity, product_id, products(name, cost_price, shipping_cost, freight_cost))')
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
      revenue += qty * (parseFloat(it.unit_price) || 0)
      cogs += qty * (parseFloat(it.unit_cost) || unitCostOf(it.products) || 0)
    }
    day.sales.push({ ...m, revenue, cogs })
    day.revenue += revenue
    day.cogs += cogs
  }

  for (const e of expRes.data || []) {
    const amount = parseFloat(e.amount) || 0
    if (!amount) continue
    if (e.is_recurring || e.recurrence === 'monthly') {
      if (!e.active) continue
      // se muestra el día 1 de cada mes del rango
      let d = new Date(`${from}T00:00:00`)
      const end = new Date(`${to}T00:00:00`)
      while (d <= end) {
        const first = new Date(d.getFullYear(), d.getMonth(), 1)
        const firstISO = toISODate(first)
        const lastISO = toISODate(new Date(first.getFullYear(), first.getMonth() + 1, 0))
        const start = e.recurring_start || e.expense_date
        const finish = e.recurring_end
        if (firstISO >= from && firstISO <= to && start <= lastISO && (!finish || finish >= firstISO)) {
          const day = ensure(firstISO)
          day.expenses.push({ ...e, is_fixed_day: true })
          day.expensesTotal += amount
        }
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
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
