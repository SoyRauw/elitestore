import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function latestBackup() {
  const root = resolve(process.cwd(), 'migration-backups')
  const dirs = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  if (dirs.length === 0) throw new Error('No hay backups en migration-backups')
  return resolve(root, dirs[dirs.length - 1])
}

async function main() {
  const root = await latestBackup()
  console.log('Backup:', root)

  const elite = {
    customers: await loadJson(resolve(root, 'elite/customers.json')),
    cashSessions: await loadJson(resolve(root, 'elite/cash_sessions.json')),
    profiles: await loadJson(resolve(root, 'elite/profiles.json')),
    movements: await loadJson(resolve(root, 'elite/movements.json')),
  }
  const usa = {
    customers: await loadJson(resolve(root, 'usa/customers.json')),
    cashSessions: await loadJson(resolve(root, 'usa/cash_sessions.json')),
    profiles: await loadJson(resolve(root, 'usa/profiles.json')),
    movements: await loadJson(resolve(root, 'usa/movements.json')),
    movementItems: await loadJson(resolve(root, 'usa/movement_items.json')),
    movementPayments: await loadJson(resolve(root, 'usa/movement_payments.json')),
    products: await loadJson(resolve(root, 'usa/products.json')),
    variants: await loadJson(resolve(root, 'usa/product_variants.json')),
    categories: await loadJson(resolve(root, 'usa/categories.json')),
  }

  const eliteCustomerById = new Map(elite.customers.map((c) => [c.id, c]))
  const eliteCustomerByIdNumber = new Map(
    elite.customers.map((c) => [normalize(c.id_number), c]).filter(([key]) => key)
  )
  const eliteSessionById = new Map(elite.cashSessions.map((s) => [s.id, s]))
  const eliteProfileById = new Map(elite.profiles.map((p) => [p.id, p]))
  const eliteProfileByEmail = new Map(
    elite.profiles.map((p) => [String(p.email || '').toLowerCase(), p]).filter(([key]) => key)
  )
  const eliteProfileByUsername = new Map(
    elite.profiles.map((p) => [String(p.username || '').toLowerCase(), p]).filter(([key]) => key)
  )

  console.log('\n=== USA customers vs Elite ===')
  let customerMatchedByIdNumber = 0
  const customerUnmatched = []
  for (const customer of usa.customers) {
    const match = eliteCustomerByIdNumber.get(normalize(customer.id_number))
    if (match) customerMatchedByIdNumber += 1
    else customerUnmatched.push(customer)
  }
  console.log(`USA customers: ${usa.customers.length}`)
  console.log(`Coinciden por cédula/RIF con Elite: ${customerMatchedByIdNumber}`)
  console.log(`Sin coincidencia: ${customerUnmatched.length}`)
  for (const c of customerUnmatched.slice(0, 30)) {
    console.log(`  - ${c.id} | ${c.id_number || 'sin cédula'} | ${c.name || ''} | ${c.phone || ''}`)
  }

  console.log('\n=== USA movements: clientes ===')
  const customerRefs = new Map()
  for (const movement of usa.movements) {
    const id = movement.customer_id || null
    customerRefs.set(id, (customerRefs.get(id) || 0) + 1)
  }
  let nullCustomers = 0
  let eliteCustomerRefs = 0
  let localCustomerRefs = 0
  let unknownCustomerRefs = 0
  const unknownCustomerIds = new Set()
  const usaCustomerIds = new Set(usa.customers.map((c) => c.id))
  for (const [id, count] of customerRefs) {
    if (!id) { nullCustomers += count; continue }
    if (eliteCustomerById.has(id)) eliteCustomerRefs += count
    else if (usaCustomerIds.has(id)) { localCustomerRefs += count; unknownCustomerIds.add(id) }
    else { unknownCustomerRefs += count; unknownCustomerIds.add(id) }
  }
  console.log(`Movimientos con customer_id nulo: ${nullCustomers}`)
  console.log(`Movimientos con customer_id de Elite: ${eliteCustomerRefs}`)
  console.log(`Movimientos con customer_id local de USA: ${localCustomerRefs}`)
  console.log(`Movimientos con customer_id desconocido: ${unknownCustomerRefs}`)
  if (unknownCustomerIds.size) console.log(`IDs locales/desconocidos: ${[...unknownCustomerIds].join(', ')}`)

  console.log('\n=== USA cash sessions vs Elite ===')
  const usaSessionIds = new Set(usa.cashSessions.map((s) => s.id))
  let matchedSessions = 0
  let localOnlySessions = 0
  for (const session of usa.cashSessions) {
    if (eliteSessionById.has(session.id)) matchedSessions += 1
    else localOnlySessions += 1
  }
  console.log(`USA cash_sessions: ${usa.cashSessions.length}`)
  console.log(`Ya existen en Elite: ${matchedSessions}`)
  console.log(`Solo locales de USA: ${localOnlySessions}`)

  console.log('\n=== USA payments: cash_session_id ===')
  const paymentSessionRefs = new Map()
  for (const payment of usa.movementPayments) {
    const id = payment.cash_session_id || null
    paymentSessionRefs.set(id, (paymentSessionRefs.get(id) || 0) + 1)
  }
  let nullSessionPayments = 0
  let eliteSessionPayments = 0
  let localSessionPayments = 0
  let unknownSessionPayments = 0
  const unknownSessionIds = new Set()
  for (const [id, count] of paymentSessionRefs) {
    if (!id) { nullSessionPayments += count; continue }
    if (eliteSessionById.has(id)) eliteSessionPayments += count
    else if (usaSessionIds.has(id)) { localSessionPayments += count; unknownSessionIds.add(id) }
    else { unknownSessionPayments += count; unknownSessionIds.add(id) }
  }
  console.log(`Pagos sin cash_session_id: ${nullSessionPayments}`)
  console.log(`Pagos con sesión de Elite: ${eliteSessionPayments}`)
  console.log(`Pagos con sesión local de USA: ${localSessionPayments}`)
  console.log(`Pagos con sesión desconocida: ${unknownSessionPayments}`)
  if (unknownSessionIds.size) console.log(`Sesiones locales/desconocidas: ${[...unknownSessionIds].join(', ')}`)

  console.log('\n=== USA movements: cash_session_id ===')
  const movementSessionRefs = new Map()
  for (const movement of usa.movements) {
    const id = movement.cash_session_id || null
    movementSessionRefs.set(id, (movementSessionRefs.get(id) || 0) + 1)
  }
  let nullSessionMovements = 0
  let eliteSessionMovements = 0
  let localSessionMovements = 0
  let unknownSessionMovements = 0
  for (const [id, count] of movementSessionRefs) {
    if (!id) { nullSessionMovements += count; continue }
    if (eliteSessionById.has(id)) eliteSessionMovements += count
    else if (usaSessionIds.has(id)) localSessionMovements += count
    else unknownSessionMovements += count
  }
  console.log(`Movimientos sin cash_session_id: ${nullSessionMovements}`)
  console.log(`Movimientos con sesión de Elite: ${eliteSessionMovements}`)
  console.log(`Movimientos con sesión local de USA: ${localSessionMovements}`)
  console.log(`Movimientos con sesión desconocida: ${unknownSessionMovements}`)

  console.log('\n=== USA profiles vs Elite ===')
  for (const profile of usa.profiles) {
    const byEmail = eliteProfileByEmail.get(String(profile.email || '').toLowerCase())
    const byUsername = eliteProfileByUsername.get(String(profile.username || '').toLowerCase())
    const match = byEmail || byUsername
    console.log(`  USA ${profile.id} | ${profile.username || ''} | ${profile.email || ''} | ${profile.role || ''} -> ${match ? `Elite ${match.id} (${match.username || match.email})` : 'SIN MATCH'}`)
  }

  console.log('\n=== USA movements: user_id ===')
  const userIds = new Map()
  for (const movement of usa.movements) {
    const id = movement.user_id || null
    userIds.set(id, (userIds.get(id) || 0) + 1)
  }
  for (const [id, count] of userIds) {
    const usaProfile = usa.profiles.find((p) => p.id === id)
    const eliteProfile = id ? eliteProfileById.get(id) : null
    console.log(`  ${id || 'null'} | ${count} movimientos | USA: ${usaProfile ? (usaProfile.username || usaProfile.email) : '—'} | Elite: ${eliteProfile ? (eliteProfile.username || eliteProfile.email) : '—'}`)
  }

  console.log('\n=== Resumen USA ===')
  const types = new Map()
  const statuses = new Map()
  let total = 0
  let minDate = null
  let maxDate = null
  for (const movement of usa.movements) {
    types.set(movement.movement_type || '—', (types.get(movement.movement_type || '—') || 0) + 1)
    statuses.set(movement.status || '—', (statuses.get(movement.status || '—') || 0) + 1)
    total += parseFloat(movement.total_amount) || 0
    const date = movement.created_at
    if (date && (!minDate || date < minDate)) minDate = date
    if (date && (!maxDate || date > maxDate)) maxDate = date
  }
  console.log(`Movimientos: ${usa.movements.length} | Total: $${total.toFixed(2)}`)
  console.log(`Rango: ${minDate} -> ${maxDate}`)
  console.log('Tipos:', Object.fromEntries(types))
  console.log('Estados:', Object.fromEntries(statuses))

  const methods = new Map()
  for (const payment of usa.movementPayments) {
    methods.set(payment.method || '—', (methods.get(payment.method || '—') || 0) + 1)
  }
  console.log('Métodos de pago:', Object.fromEntries(methods))
  console.log(`Productos USA: ${usa.products.length} | Variantes: ${usa.variants.length} | Categorías: ${usa.categories.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
