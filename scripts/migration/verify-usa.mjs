import { getMigrationConfig, loadEnv } from './env.mjs'

const PAGE_SIZE = 1000

function number(value) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

async function fetchAll(url, key, table, select = '*') {
  const rows = []
  let offset = 0
  while (true) {
    const res = await fetch(
      `${url}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${PAGE_SIZE}&offset=${offset}&order=id.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    if (!res.ok) throw new Error(`${table} -> ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const data = await res.json()
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return rows
}

async function main() {
  const config = getMigrationConfig()
  const prod = config.prod
  const usa = config.usa

  const [products, categories, variants, movements, items, payments, customers, profiles, cashSessions] =
    await Promise.all([
      fetchAll(prod.url, prod.key, 'products'),
      fetchAll(prod.url, prod.key, 'categories'),
      fetchAll(prod.url, prod.key, 'product_variants'),
      fetchAll(prod.url, prod.key, 'movements'),
      fetchAll(prod.url, prod.key, 'movement_items'),
      fetchAll(prod.url, prod.key, 'movement_payments'),
      fetchAll(prod.url, prod.key, 'customers'),
      fetchAll(prod.url, prod.key, 'profiles'),
      fetchAll(prod.url, prod.key, 'cash_sessions'),
    ])

  const usaProducts = products.filter((p) => p.store_id === 'usa')
  const usaCategories = categories.filter((c) => c.store_id === 'usa')
  const usaVariants = variants.filter((v) => v.store_id === 'usa')
  const usaMovements = movements.filter((m) => m.store_id === 'usa')
  const usaItems = items.filter((i) => i.store_id === 'usa')
  const usaMovementIds = new Set(usaMovements.map((m) => m.id))
  const usaPayments = payments.filter((p) => usaMovementIds.has(p.movement_id))
  const total = usaMovements.reduce((sum, m) => sum + number(m.total_amount), 0)

  const customerIds = new Set(customers.map((c) => c.id))
  const profileIds = new Set(profiles.map((p) => p.id))
  const sessionIds = new Set(cashSessions.map((s) => s.id))
  const productById = new Map(products.map((p) => [p.id, p]))
  const variantById = new Map(variants.map((v) => [v.id, v]))

  const issues = []
  if (usaProducts.length !== 87) issues.push(`Productos USA: ${usaProducts.length} (esperado 87)`)
  if (usaCategories.length !== 5) issues.push(`Categorías USA: ${usaCategories.length} (esperado 5)`)
  if (usaVariants.length !== 145) issues.push(`Variantes USA: ${usaVariants.length} (esperado 145)`)
  if (usaMovements.length !== 112) issues.push(`Movimientos USA: ${usaMovements.length} (esperado 112)`)
  if (usaItems.length !== 167) issues.push(`Líneas USA: ${usaItems.length} (esperado 167)`)
  if (usaPayments.length !== 112) issues.push(`Pagos USA: ${usaPayments.length} (esperado 112)`)
  if (Math.abs(total - 1882) > 0.05) issues.push(`Total USA: ${total.toFixed(2)} (esperado 1882.00)`)

  const inactiveUsa = usaProducts.filter((p) => !p.active)
  if (inactiveUsa.length) issues.push(`Productos USA inactivos: ${inactiveUsa.length}`)

  const badCustomers = usaMovements.filter((m) => m.customer_id && !customerIds.has(m.customer_id))
  if (badCustomers.length) issues.push(`Movimientos con cliente inexistente: ${badCustomers.length}`)

  const badUsers = usaMovements.filter((m) => !m.user_id || !profileIds.has(m.user_id))
  if (badUsers.length) issues.push(`Movimientos sin usuario válido: ${badUsers.length}`)

  const badSessions = usaMovements.filter((m) => m.cash_session_id && !sessionIds.has(m.cash_session_id))
  if (badSessions.length) issues.push(`Movimientos con caja inexistente: ${badSessions.length}`)

  const badItems = usaItems.filter((i) => {
    const product = productById.get(i.product_id)
    if (!product || product.store_id !== 'usa') return true
    if (i.variant_id) {
      const variant = variantById.get(i.variant_id)
      if (!variant || variant.store_id !== 'usa') return true
    }
    return false
  })
  if (badItems.length) issues.push(`Líneas con producto/variante fuera de USA: ${badItems.length}`)

  const publicEnv = loadEnv('.env')
  const publicUrl = publicEnv.VITE_SUPABASE_URL
  const publicKey = publicEnv.VITE_SUPABASE_ANON_KEY
  let publicElite = null
  let publicUsa = null
  if (publicUrl && publicKey) {
    const count = async (store) => {
      const res = await fetch(
        `${publicUrl}/rest/v1/products?select=id&active=eq.true&store_id=eq.${store}`,
        { headers: { apikey: publicKey, Prefer: 'count=exact', Range: '0-0' } }
      )
      const range = res.headers.get('content-range') || ''
      return Number(range.split('/')[1] || 0)
    }
    publicElite = await count('elite')
    publicUsa = await count('usa')
  }

  console.log('=== Verificación unificación USA ===')
  console.log(`Productos: ${products.length} (Elite ${products.length - usaProducts.length} / USA ${usaProducts.length})`)
  console.log(`Categorías: ${categories.length} (USA nuevas ${usaCategories.length})`)
  console.log(`Variantes: ${variants.length} (USA ${usaVariants.length})`)
  console.log(`Movimientos: ${movements.length} (USA ${usaMovements.length})`)
  console.log(`Líneas: ${items.length} (USA ${usaItems.length})`)
  console.log(`Pagos USA: ${usaPayments.length}`)
  console.log(`Total ventas USA: $${total.toFixed(2)}`)
  console.log(`Clientes: ${customers.length} | Perfiles: ${profiles.length} | Cajas: ${cashSessions.length}`)
  console.log(`Productos USA inactivos: ${inactiveUsa.length}`)
  if (publicElite !== null) {
    console.log(`Público anon: Elite ${publicElite} | USA ${publicUsa}`)
    if (publicUsa !== 87) issues.push(`El catálogo público no ve 87 productos USA (ve ${publicUsa})`)
  }

  if (issues.length) {
    console.log('\nPROBLEMAS:')
    issues.forEach((issue) => console.log(` - ${issue}`))
    process.exit(1)
  }

  console.log('\nTodo cuadra.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
