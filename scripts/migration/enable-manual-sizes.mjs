import { getMigrationConfig } from './env.mjs'

const APPLY = process.argv.includes('--apply')
const PAGE = 1000

const MANUAL_CATEGORIES = [
  'BATH & BODY',
  'BEAUTY AND HOME',
  'FOOD',
  'MEDICAMENTOS',
  'VICTORIA SECRET',
]

const MANUAL_LABEL = 'Medida'

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

async function patch(url, key, path, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${path} -> ${res.status}: ${(await res.text()).slice(0, 300)}`)
}

async function main() {
  const { prod } = getMigrationConfig()
  const categories = await fetchAll(
    prod.url,
    prod.key,
    'categories?select=id,name,store_id,size_label,size_options,sizes_enabled&order=name.asc'
  )
  const targets = categories.filter(
    (category) =>
      category.store_id === 'usa' &&
      MANUAL_CATEGORIES.some((name) => name.toUpperCase() === category.name.trim().toUpperCase())
  )
  const missing = MANUAL_CATEGORIES.filter(
    (name) => !targets.some((category) => category.name.trim().toUpperCase() === name.toUpperCase())
  )

  const variants = await fetchAll(
    prod.url,
    prod.key,
    'product_variants?select=id,product_id,sku,size,store_id&store_id=eq.usa&order=id.asc'
  )
  const naVariants = variants.filter(
    (variant) => String(variant.size || '').trim().toUpperCase() === 'N/A'
  )

  console.log('=== Tallas/medidas manuales para USA ===')
  console.log(`Categorías a pasar a Manual (${MANUAL_LABEL}): ${targets.length}`)
  targets.forEach((category) => {
    console.log(`  ${category.name} | enabled=${category.sizes_enabled} label=${category.size_label} opciones=${(category.size_options || []).length}`)
  })
  if (missing.length) console.log(`  No encontradas: ${missing.join(', ')}`)
  console.log(`Variantes USA con "N/A" a limpiar: ${naVariants.length}`)
  naVariants.slice(0, 20).forEach((variant) => {
    console.log(`  ${variant.sku || variant.id} | size=${variant.size}`)
  })

  if (!APPLY) {
    console.log('\nDry-run. Ejecuta con --apply para escribir.')
    return
  }

  if (targets.length) {
    await patch(
      prod.url,
      prod.key,
      `categories?id=in.(${targets.map((category) => encodeURIComponent(category.id)).join(',')})`,
      {
        sizes_enabled: true,
        size_options: [],
        size_label: MANUAL_LABEL,
      }
    )
  }

  if (naVariants.length) {
    await patch(
      prod.url,
      prod.key,
      `product_variants?id=in.(${naVariants.map((variant) => encodeURIComponent(variant.id)).join(',')})`,
      { size: null }
    )
  }

  const afterCategories = await fetchAll(
    prod.url,
    prod.key,
    'categories?select=id,name,store_id,size_label,size_options,sizes_enabled&order=name.asc'
  )
  const afterTargets = afterCategories.filter(
    (category) =>
      category.store_id === 'usa' &&
      MANUAL_CATEGORIES.some((name) => name.toUpperCase() === category.name.trim().toUpperCase())
  )
  const afterVariants = await fetchAll(
    prod.url,
    prod.key,
    'product_variants?select=id,size,store_id&store_id=eq.usa&order=id.asc'
  )
  const afterNa = afterVariants.filter(
    (variant) => String(variant.size || '').trim().toUpperCase() === 'N/A'
  )

  console.log('\n=== Verificación ===')
  afterTargets.forEach((category) => {
    console.log(`  ${category.name} | enabled=${category.sizes_enabled} label=${category.size_label} opciones=${(category.size_options || []).length}`)
  })
  console.log(`Variantes USA con "N/A" restantes: ${afterNa.length}`)
  console.log(`Categorías manuales verificadas: ${afterTargets.filter((c) => c.sizes_enabled === true && (c.size_options || []).length === 0).length}/${targets.length}`)

  if (afterNa.length > 0) process.exit(1)
}

main().catch((error) => {
  console.error('\nERROR:', error.message)
  process.exit(1)
})
