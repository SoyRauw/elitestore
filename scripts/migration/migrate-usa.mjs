import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getMigrationConfig } from './env.mjs'

const PAGE_SIZE = 1000
const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const FROM_BACKUP = args.has('--from-backup')
const ACTIVATE = args.has('--activate')

if (APPLY && FROM_BACKUP) {
  console.error('No se puede usar --apply con --from-backup')
  process.exit(1)
}

function number(value) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function integer(value) {
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : 0
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function restJson(url, key, path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${path} -> ${res.status}: ${body.slice(0, 400)}`)
  }
  return res.json()
}

async function fetchAll(url, key, table) {
  const rows = []
  let offset = 0
  while (true) {
    const data = await restJson(
      url,
      key,
      `${table}?select=*&limit=${PAGE_SIZE}&offset=${offset}&order=id.asc`
    )
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return rows
}

async function insertRows(url, key, table, rows, label) {
  if (rows.length === 0) {
    console.log(`  ${label || table}: nada que insertar`)
    return
  }
  if (!APPLY) {
    console.log(`  ${label || table}: ${rows.length} filas (dry-run)`)
    return
  }

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`${table} insert -> ${res.status}: ${body.slice(0, 600)}`)
    }
  }
  console.log(`  ${label || table}: ${rows.length} filas insertadas`)
}

async function latestBackup() {
  const root = resolve(process.cwd(), 'migration-backups')
  const dirs = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  if (dirs.length === 0) throw new Error('No hay backups')
  return resolve(root, dirs[dirs.length - 1])
}

async function loadBackupData() {
  const root = await latestBackup()
  console.log(`Modo backup: ${root}`)
  const read = async (db, table) => JSON.parse(await readFile(resolve(root, db, `${table}.json`), 'utf8'))
  return {
    elite: {
      categories: await read('elite', 'categories'),
      products: await read('elite', 'products'),
      variants: await read('elite', 'product_variants'),
      customers: await read('elite', 'customers'),
      cashSessions: await read('elite', 'cash_sessions'),
      movements: await read('elite', 'movements'),
      movementItems: await read('elite', 'movement_items'),
      movementPayments: await read('elite', 'movement_payments'),
      profiles: await read('elite', 'profiles'),
      customerCoupons: await read('elite', 'customer_coupons'),
    },
    usa: {
      categories: await read('usa', 'categories'),
      products: await read('usa', 'products'),
      variants: await read('usa', 'product_variants'),
      customers: await read('usa', 'customers'),
      cashSessions: await read('usa', 'cash_sessions'),
      movements: await read('usa', 'movements'),
      movementItems: await read('usa', 'movement_items'),
      movementPayments: await read('usa', 'movement_payments'),
      profiles: await read('usa', 'profiles'),
    },
  }
}

async function loadLiveData(config) {
  console.log('Leyendo datos en vivo...')
  const prod = config.prod
  const usa = config.usa

  // Verifica que el esquema unificado ya esté aplicado.
  try {
    await restJson(prod.url, prod.key, 'products?select=store_id&limit=1')
  } catch (error) {
    throw new Error(
      'El esquema unificado no está aplicado en producción. Ejecuta supabase/migrations/20261125_unified_stores.sql primero.\n' +
        error.message
    )
  }

  const [elite, usaData] = await Promise.all([
    Promise.all([
      fetchAll(prod.url, prod.key, 'categories'),
      fetchAll(prod.url, prod.key, 'products'),
      fetchAll(prod.url, prod.key, 'product_variants'),
      fetchAll(prod.url, prod.key, 'customers'),
      fetchAll(prod.url, prod.key, 'cash_sessions'),
      fetchAll(prod.url, prod.key, 'movements'),
      fetchAll(prod.url, prod.key, 'movement_items'),
      fetchAll(prod.url, prod.key, 'movement_payments'),
      fetchAll(prod.url, prod.key, 'profiles'),
      fetchAll(prod.url, prod.key, 'customer_coupons'),
    ]),
    Promise.all([
      fetchAll(usa.url, usa.key, 'categories'),
      fetchAll(usa.url, usa.key, 'products'),
      fetchAll(usa.url, usa.key, 'product_variants'),
      fetchAll(usa.url, usa.key, 'customers'),
      fetchAll(usa.url, usa.key, 'cash_sessions'),
      fetchAll(usa.url, usa.key, 'movements'),
      fetchAll(usa.url, usa.key, 'movement_items'),
      fetchAll(usa.url, usa.key, 'movement_payments'),
      fetchAll(usa.url, usa.key, 'profiles'),
    ]),
  ])

  const keys = [
    'categories', 'products', 'variants', 'customers', 'cashSessions',
    'movements', 'movementItems', 'movementPayments', 'profiles', 'customerCoupons',
  ]
  const eliteObj = {}
  const usaObj = {}
  keys.forEach((key, index) => {
    if (elite[index] !== undefined) eliteObj[key] = elite[index]
    if (usaData[index] !== undefined) usaObj[key] = usaData[index]
  })
  return { elite: eliteObj, usa: usaObj }
}

async function main() {
  const config = getMigrationConfig()
  const data = FROM_BACKUP ? await loadBackupData() : await loadLiveData(config)
  const { elite, usa } = data

  console.log('\n=== Mapeo de usuarios ===')
  const eliteProfileByEmail = new Map(
    elite.profiles.map((p) => [String(p.email || '').toLowerCase(), p]).filter(([k]) => k)
  )
  const eliteProfileByUsername = new Map(
    elite.profiles.map((p) => [String(p.username || '').toLowerCase(), p]).filter(([k]) => k)
  )
  const userMap = new Map()
  for (const profile of usa.profiles) {
    const match =
      eliteProfileByEmail.get(String(profile.email || '').toLowerCase()) ||
      eliteProfileByUsername.get(String(profile.username || '').toLowerCase()) ||
      (profile.email === 'ventas@usa.local' ? eliteProfileByUsername.get('ventas') : null)
    if (match) {
      userMap.set(profile.id, match.id)
      console.log(`  ${profile.email || profile.username} -> ${match.email || match.username}`)
    } else {
      console.warn(`  SIN MAPEO: ${profile.email || profile.username} (${profile.id})`)
    }
  }

  console.log('\n=== Mapeo de clientes ===')
  const eliteCustomerById = new Map(elite.customers.map((c) => [c.id, c]))
  const eliteCustomerByIdNumber = new Map(
    elite.customers.map((c) => [normalize(c.id_number), c]).filter(([k]) => k)
  )
  const customerMap = new Map()
  const customersToCreate = []
  for (const customer of usa.customers) {
    const key = normalize(customer.id_number)
    const match = key ? eliteCustomerByIdNumber.get(key) : null
    if (match) {
      customerMap.set(customer.id, match.id)
      continue
    }
    const id = eliteCustomerById.has(customer.id) ? randomUUID() : customer.id
    customerMap.set(customer.id, id)
    customersToCreate.push({
      id,
      name: customer.name || 'Cliente',
      id_number: customer.id_number || null,
      phone: customer.phone || null,
      email: customer.email || null,
      address: customer.address || null,
      birthday: customer.birthday || null,
      created_at: customer.created_at || new Date().toISOString(),
      points: 0,
      balance: 0,
    })
    console.log(`  Nuevo cliente: ${customer.id_number || 'sin cédula'} | ${customer.name || ''}`)
  }
  console.log(`  Mapeados: ${usa.customers.length - customersToCreate.length} | Nuevos: ${customersToCreate.length}`)

  console.log('\n=== Mapeo de cajas ===')
  const eliteSessionById = new Map(elite.cashSessions.map((s) => [s.id, s]))
  const sessionMap = new Map()
  const sessionsToCreate = []
  for (const session of usa.cashSessions) {
    if (eliteSessionById.has(session.id)) {
      sessionMap.set(session.id, session.id)
      continue
    }
    let status = session.status
    let closedAt = session.closed_at
    if (status === 'open') {
      status = 'closed'
      closedAt = closedAt || session.opened_at
      console.warn(`  Caja abierta local se migrará cerrada: ${session.id}`)
    }
    sessionMap.set(session.id, session.id)
    sessionsToCreate.push({
      id: session.id,
      user_id: userMap.get(session.user_id) || null,
      opened_at: session.opened_at,
      closed_at: closedAt,
      status,
      opening_amount: number(session.opening_amount),
      closing_amount: numberOrNull(session.closing_amount),
      expected_amount: numberOrNull(session.expected_amount),
      notes: session.notes || null,
      exchange_rate: numberOrNull(session.exchange_rate),
      expected_bs: numberOrNull(session.expected_bs),
      closing_bs: numberOrNull(session.closing_bs),
    })
  }
  console.log(`  Existentes: ${usa.cashSessions.length - sessionsToCreate.length} | Nuevas: ${sessionsToCreate.length}`)

  console.log('\n=== Mapeo de categorías ===')
  const eliteCategoryByName = new Map(
    elite.categories.map((c) => [String(c.name || '').trim().toLowerCase(), c]).filter(([k]) => k)
  )
  const eliteCategoryIds = new Set(elite.categories.map((c) => c.id))
  const eliteSlugs = new Set(elite.categories.map((c) => c.slug).filter(Boolean))
  const elitePrefixes = new Set(elite.categories.map((c) => c.prefix).filter(Boolean))
  const categoryMap = new Map()
  const categoriesToCreate = []
  for (const category of usa.categories) {
    const match = eliteCategoryByName.get(String(category.name || '').trim().toLowerCase())
    if (match) {
      categoryMap.set(category.id, match.id)
      console.log(`  ${category.name} -> existente ${match.id}`)
      continue
    }
    const id = eliteCategoryIds.has(category.id) ? randomUUID() : category.id
    let slug = `${slugify(category.name)}-usa`
    let suffix = 2
    while (eliteSlugs.has(slug)) {
      slug = `${slugify(category.name)}-usa-${suffix}`
      suffix += 1
    }
    eliteSlugs.add(slug)
    let prefix = category.prefix || slugify(category.name).slice(0, 3).toUpperCase() || 'USA'
    while (elitePrefixes.has(prefix)) {
      prefix = `U${prefix}`
    }
    elitePrefixes.add(prefix)
    const row = {
      id,
      name: category.name,
      created_at: category.created_at || new Date().toISOString(),
      size_label: category.size_label || 'Peso',
      size_options: category.size_options || [],
      prefix,
      sizes_enabled: false,
      store_id: 'usa',
    }
    categoryMap.set(category.id, id)
    categoriesToCreate.push(row)
    console.log(`  Nueva categoría: ${category.name} -> ${id}`)
  }

  console.log('\n=== Mapeo de productos ===')
  const eliteProductById = new Map(elite.products.map((p) => [p.id, p]))
  const productsToCreate = []
  for (const product of usa.products) {
    if (eliteProductById.has(product.id)) {
      console.warn(`  Producto ya existe en Elite, se omite: ${product.id}`)
      continue
    }
    const row = {
      id: product.id,
      name: product.name,
      description: product.description || null,
      price: number(product.sale_price),
      category_id: categoryMap.get(product.category_id) || null,
      images: product.image ? [product.image] : [],
      featured: false,
      active: product.active ?? true,
      created_at: product.created_at || new Date().toISOString(),
      updated_at: product.created_at || new Date().toISOString(),
      wholesale_price: 0,
      min_wholesale_qty: 0,
      cost_price: number(product.cost),
      shipping_cost: number(product.tax),
      freight_cost: number(product.shipping_cost),
      profit_margin: numberOrNull(product.profit_margin) ?? 50,
      store_id: 'usa',
    }
    productsToCreate.push(row)
  }
  console.log(`  Nuevos productos: ${productsToCreate.length}`)

  console.log('\n=== Mapeo de variantes ===')
  const eliteVariantById = new Map(elite.variants.map((v) => [v.id, v]))
  const usaVariantById = new Map(usa.variants.map((v) => [v.id, v]))
  const variantsToCreate = []
  for (const variant of usa.variants) {
    if (eliteVariantById.has(variant.id)) {
      console.warn(`  Variante ya existe en Elite, se omite: ${variant.id}`)
      continue
    }
    if (!eliteProductById.has(variant.product_id) && !productsToCreate.some((p) => p.id === variant.product_id)) {
      console.warn(`  Variante sin producto: ${variant.id} (${variant.product_id})`)
      continue
    }
    variantsToCreate.push({
      id: variant.id,
      product_id: variant.product_id,
      sku: variant.sku,
      color: variant.color || null,
      size: variant.size || null,
      variant_name: variant.variant_name || null,
      barcode: variant.barcode || null,
      price: number(variant.price),
      wholesale_price: 0,
      stock: integer(variant.stock),
      created_at: variant.created_at || new Date().toISOString(),
      image: variant.image || null,
      images: variant.image ? [variant.image] : [],
      active: variant.active ?? true,
      store_id: 'usa',
    })
  }
  console.log(`  Nuevas variantes: ${variantsToCreate.length}`)

  const eliteMovementById = new Map(elite.movements.map((m) => [m.id, m]))
  const eliteCouponIds = new Set((elite.customerCoupons || []).map((c) => c.id))
  const elitePaymentIds = new Set(elite.movementPayments.map((p) => p.id))
  const eliteItemIds = new Set(elite.movementItems.map((i) => i.id))

  console.log('\n=== Mapeo de ventas ===')
  const usaItemsByMovement = new Map()
  for (const item of usa.movementItems) {
    const list = usaItemsByMovement.get(item.movement_id) || []
    list.push(item)
    usaItemsByMovement.set(item.movement_id, list)
  }
  const movementsToCreate = []
  const itemsToCreate = []
  const paymentsToCreate = []
  const warnings = []

  for (const movement of usa.movements) {
    if (eliteMovementById.has(movement.id)) {
      console.warn(`  Movimiento ya existe en Elite, se omite: ${movement.id}`)
      continue
    }

    let customerId = movement.customer_id || null
    if (customerId && customerMap.has(customerId)) {
      customerId = customerMap.get(customerId)
    } else if (customerId && !eliteCustomerById.has(customerId)) {
      customerId = null
    }

    let cashSessionId = movement.cash_session_id || null
    if (cashSessionId && sessionMap.has(cashSessionId)) {
      cashSessionId = sessionMap.get(cashSessionId)
    } else if (cashSessionId && !eliteSessionById.has(cashSessionId)) {
      cashSessionId = null
    }

    const customerCouponId =
      movement.customer_coupon_id && eliteCouponIds.has(movement.customer_coupon_id)
        ? movement.customer_coupon_id
        : null

    const row = {
      id: movement.id,
      movement_type: movement.movement_type || 'venta',
      status: movement.status || 'pagado',
      customer_name: movement.customer_name || null,
      customer_phone: movement.customer_phone || null,
      payment_method: movement.payment_method || null,
      total_amount: number(movement.total_amount),
      notes: movement.notes || null,
      created_at: movement.created_at,
      updated_at: movement.created_at,
      user_id: userMap.get(movement.user_id) || null,
      customer_id: customerId,
      cash_session_id: cashSessionId,
      customer_coupon_id: customerCouponId,
      discount_amount: number(movement.discount_amount),
      points_earned: Math.floor(number(movement.total_amount)),
      sale_type: 'retail',
      credit_amount: number(movement.credit_amount),
      reference_movement_id: null,
      due_date: null,
      extended_count: 0,
      paid_amount: 0,
      day_discount_id: null,
      day_discount_amount: 0,
      day_discount_name: null,
      store_id: 'usa',
    }
    movementsToCreate.push(row)

    const items = usaItemsByMovement.get(movement.id) || []
    const grossTotal = items.reduce((sum, item) => sum + number(item.quantity) * number(item.unit_price), 0)
    const headerDiscount = number(movement.discount_amount)
    let allocatedDiscount = 0

    items.forEach((item, index) => {
      if (eliteItemIds.has(item.id)) {
        warnings.push(`Línea ya existe: ${item.id}`)
        return
      }
      let lineDiscount = 0
      if (headerDiscount > 0 && grossTotal > 0) {
        if (index === items.length - 1) {
          lineDiscount = Math.round((headerDiscount - allocatedDiscount) * 100) / 100
        } else {
          lineDiscount = Math.round((headerDiscount * (number(item.quantity) * number(item.unit_price) / grossTotal)) * 100) / 100
          allocatedDiscount += lineDiscount
        }
      }
      const product = productsToCreate.find((p) => p.id === item.product_id) ||
        eliteProductById.get(item.product_id)
      const variant = usaVariantById.get(item.variant_id)
      const unitCost = product
        ? number(product.cost_price) + number(product.shipping_cost) + number(product.freight_cost)
        : 0
      itemsToCreate.push({
        id: item.id,
        movement_id: item.movement_id,
        product_id: item.product_id,
        size: variant?.size || '',
        quantity: integer(item.quantity),
        unit_price: number(item.unit_price),
        variant_id: item.variant_id || null,
        returned_quantity: 0,
        discount_amount: lineDiscount,
        original_item_id: null,
        is_wholesale: false,
        unit_cost: unitCost,
        store_id: 'usa',
      })
    })

    const lineRevenue = items.reduce(
      (sum, item) => sum + number(item.quantity) * number(item.unit_price),
      0
    ) - headerDiscount
    if (movement.movement_type !== 'giftcard' && Math.abs(lineRevenue - number(movement.total_amount)) > 0.05) {
      warnings.push(
        `Descuadre en ${movement.id}: líneas ${lineRevenue.toFixed(2)} vs total ${number(movement.total_amount).toFixed(2)}`
      )
    }
  }

  for (const payment of usa.movementPayments) {
    if (elitePaymentIds.has(payment.id)) {
      warnings.push(`Pago ya existe: ${payment.id}`)
      continue
    }
    let cashSessionId = payment.cash_session_id || null
    if (cashSessionId && sessionMap.has(cashSessionId)) {
      cashSessionId = sessionMap.get(cashSessionId)
    } else if (cashSessionId && !eliteSessionById.has(cashSessionId)) {
      cashSessionId = null
    }
    paymentsToCreate.push({
      id: payment.id,
      movement_id: payment.movement_id,
      method: payment.method,
      amount: number(payment.amount),
      reference: payment.reference || null,
      created_at: payment.created_at || new Date().toISOString(),
      bs_amount: numberOrNull(payment.bs_amount),
      bs_rate: numberOrNull(payment.bs_rate),
      vuelto_bs: numberOrNull(payment.vuelto_bs),
      vuelto_pm_amount: numberOrNull(payment.vuelto_pm_amount),
      vuelto_pm_reference: payment.vuelto_pm_reference || null,
      vuelto_credito: numberOrNull(payment.vuelto_credito),
      cash_session_id: cashSessionId,
    })
  }

  console.log(`  Ventas nuevas: ${movementsToCreate.length}`)
  console.log(`  Líneas nuevas: ${itemsToCreate.length}`)
  console.log(`  Pagos nuevos: ${paymentsToCreate.length}`)
  console.log(`  Total ventas USA: $${usa.movements.reduce((s, m) => s + number(m.total_amount), 0).toFixed(2)}`)
  if (warnings.length) {
    console.log('\nAdvertencias:')
    warnings.slice(0, 50).forEach((warning) => console.log(`  - ${warning}`))
    if (warnings.length > 50) console.log(`  ... y ${warnings.length - 50} más`)
  }

  console.log('\n=== Plan de escritura ===')
  await insertRows(config.prod.url, config.prod.key, 'categories', categoriesToCreate, 'categorías')
  await insertRows(config.prod.url, config.prod.key, 'products', productsToCreate, 'productos')
  await insertRows(config.prod.url, config.prod.key, 'product_variants', variantsToCreate, 'variantes')
  await insertRows(config.prod.url, config.prod.key, 'customers', customersToCreate, 'clientes')
  await insertRows(config.prod.url, config.prod.key, 'cash_sessions', sessionsToCreate, 'cajas')
  await insertRows(config.prod.url, config.prod.key, 'movements', movementsToCreate, 'movimientos')
  await insertRows(config.prod.url, config.prod.key, 'movement_items', itemsToCreate, 'líneas')
  await insertRows(config.prod.url, config.prod.key, 'movement_payments', paymentsToCreate, 'pagos')

  if (ACTIVATE) {
    console.log('\n=== Activando productos USA ===')
    if (!APPLY) {
      console.log('  (dry-run) se activarían los productos store_id=usa')
    } else {
      const res = await fetch(`${config.prod.url}/rest/v1/products?store_id=eq.usa`, {
        method: 'PATCH',
        headers: {
          apikey: config.prod.key,
          Authorization: `Bearer ${config.prod.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ active: true }),
      })
      if (!res.ok) throw new Error(`activar productos -> ${res.status}: ${await res.text()}`)
      console.log('  Productos USA activados')
    }
  }

  console.log(`\n${APPLY ? 'Migración aplicada' : 'Dry-run completo'}.`)
}

main().catch((error) => {
  console.error('\nERROR:', error.message)
  process.exit(1)
})
