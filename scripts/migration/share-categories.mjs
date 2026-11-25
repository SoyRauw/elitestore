import { getMigrationConfig } from './env.mjs'

const PAGE = 1000
const APPLY = process.argv.includes('--apply')

const SHARED_NAMES = new Set([
  'pijama',
  'blusas',
  'shorts',
  'chaqueta',
  'top',
  'body',
  'sueter',
  'franelas',
  'pantalon',
  'pantuflas',
  'brasier',
  'vestido',
  'cartera',
  'conjuntos',
  'jeans',
  'bragas',
  'calzado',
  'home luxury',
])

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
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

async function insertBothStore(url, key) {
  const res = await fetch(`${url}/rest/v1/stores?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([{ id: 'both', name: 'Ambas tiendas', active: true }]),
  })
  if (!res.ok) throw new Error(`stores -> ${res.status}: ${(await res.text()).slice(0, 300)}`)
}

async function patchCategory(url, key, id, storeId) {
  const res = await fetch(`${url}/rest/v1/categories?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ store_id: storeId }),
  })
  if (!res.ok) throw new Error(`category ${id} -> ${res.status}: ${(await res.text()).slice(0, 300)}`)
}

async function main() {
  const { prod } = getMigrationConfig()
  const categories = await fetchAll(
    prod.url,
    prod.key,
    'categories?select=id,name,store_id&order=name.asc'
  )

  const targets = categories.filter((category) => SHARED_NAMES.has(normalize(category.name)))
  const pending = targets.filter((category) => category.store_id !== 'both')

  console.log('=== Categorías compartidas Elite/USA ===')
  console.log(`Categorías totales: ${categories.length}`)
  console.log(`Categorías objetivo: ${targets.length}`)
  console.log(`A actualizar a "both": ${pending.length}`)
  pending.forEach((category) => {
    console.log(`  ${category.name} (${category.store_id}) -> both`)
  })

  if (!APPLY) {
    console.log('\nDry-run. Ejecuta con --apply para escribir.')
    return
  }

  await insertBothStore(prod.url, prod.key)
  for (const category of pending) {
    await patchCategory(prod.url, prod.key, category.id, 'both')
  }

  const after = await fetchAll(prod.url, prod.key, 'categories?select=id,name,store_id&order=name.asc')
  const both = after.filter((category) => category.store_id === 'both')
  console.log(`\nCategorías compartidas ahora: ${both.length}`)
  both.forEach((category) => console.log(`  ${category.name}`))
}

main().catch((error) => {
  console.error('\nERROR:', error.message)
  process.exit(1)
})
