import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getMigrationConfig } from './env.mjs'

const APPLY = process.argv.includes('--apply')
const PAGE = 1000

function number(value) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

async function fetchAll(url, key, path) {
  const rows = []
  let offset = 0
  while (true) {
    const sep = path.includes('?') ? '&' : '?'
    const res = await fetch(`${url}/rest/v1/${path}${sep}limit=${PAGE}&offset=${offset}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(`${path} -> ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const data = await res.json()
    rows.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return rows
}

async function patchProduct(url, key, id, price) {
  const res = await fetch(`${url}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ price }),
  })
  if (!res.ok) throw new Error(`PATCH ${id} -> ${res.status}: ${(await res.text()).slice(0, 300)}`)
}

async function snapshot() {
  const config = getMigrationConfig()
  const [products, variants] = await Promise.all([
    fetchAll(
      config.prod.url,
      config.prod.key,
      'products?select=id,name,price,wholesale_price,cost_price,shipping_cost,freight_cost,store_id&store_id=eq.usa&order=id.asc'
    ),
    fetchAll(
      config.prod.url,
      config.prod.key,
      'product_variants?select=id,product_id,sku,price,wholesale_price,stock,store_id&store_id=eq.usa&order=id.asc'
    ),
  ])
  return { products, variants }
}

async function main() {
  const config = getMigrationConfig()
  const before = await snapshot()

  const minByProduct = new Map()
  for (const variant of before.variants) {
    const price = number(variant.price)
    if (price <= 0) continue
    const current = minByProduct.get(variant.product_id)
    if (current === undefined || price < current) minByProduct.set(variant.product_id, price)
  }

  const updates = before.products
    .map((product) => ({
      id: product.id,
      name: product.name,
      oldPrice: number(product.price),
      newPrice: minByProduct.get(product.id) || 0,
    }))
    .filter((item) => item.newPrice > 0 && Math.abs(item.oldPrice - item.newPrice) > 0.001)

  const zeroBefore = before.products.filter((p) => number(p.price) === 0).length
  const zeroAfterExpected = before.products.filter((p) => (minByProduct.get(p.id) || 0) <= 0).length

  console.log('=== Ajuste de precio base USA ===')
  console.log(`Productos USA: ${before.products.length}`)
  console.log(`Precio base en 0 antes: ${zeroBefore}`)
  console.log(`Productos a actualizar: ${updates.length}`)
  console.log(`Productos sin precio de variante: ${zeroAfterExpected}`)
  console.log('Muestra:')
  updates.slice(0, 20).forEach((item) => {
    console.log(`  ${item.id} | ${item.name} | $${item.oldPrice.toFixed(2)} -> $${item.newPrice.toFixed(2)}`)
  })

  if (!APPLY) {
    console.log('\nDry-run. Ejecuta con --apply para escribir.')
    return
  }

  const snapshotPath = resolve(
    process.cwd(),
    'migration-backups',
    `usa-products-before-price-fix-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  )
  await writeFile(snapshotPath, JSON.stringify(before, null, 2), 'utf8')
  console.log(`\nSnapshot previo: ${snapshotPath}`)

  for (const item of updates) {
    await patchProduct(config.prod.url, config.prod.key, item.id, item.newPrice)
  }

  const after = await snapshot()
  const afterById = new Map(after.products.map((p) => [p.id, p]))
  const variantsAfterById = new Map(after.variants.map((v) => [v.id, v]))

  const zeroAfter = after.products.filter((p) => number(p.price) === 0).length
  const variantChanged = before.variants.filter((v) => {
    const now = variantsAfterById.get(v.id)
    return !now || number(now.price) !== number(v.price) || number(now.stock) !== number(v.stock)
  })
  const costChanged = before.products.filter((p) => {
    const now = afterById.get(p.id)
    return !now ||
      number(now.cost_price) !== number(p.cost_price) ||
      number(now.shipping_cost) !== number(p.shipping_cost) ||
      number(now.freight_cost) !== number(p.freight_cost) ||
      number(now.wholesale_price) !== number(p.wholesale_price)
  })

  console.log('\n=== Verificación ===')
  console.log(`Precio base en 0 después: ${zeroAfter}`)
  console.log(`Variantes con precio/stock cambiados: ${variantChanged.length}`)
  console.log(`Productos con costo/wholesale cambiados: ${costChanged.length}`)
  console.log(`Productos actualizados: ${updates.length}`)

  if (zeroAfter !== 0 || variantChanged.length > 0 || costChanged.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('\nERROR:', error.message)
  process.exit(1)
})
