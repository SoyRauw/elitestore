/**
 * Utilidades para generar IDs de producto y SKUs de variantes.
 *
 * Ejemplos:
 *   generateProductId('Pijamas', 'Pijama Satín') -> 'PIJ-SAT'
 *   generateVariantSKU('PIJ-SAT', { color:null, variant_name:'Corazones', size:'M' }) -> 'PIJ-SAT-COR-M'
 */

const normalize = (str) =>
  (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()

const slugWords = (str) =>
  normalize(str)
    .split(/\s+/)
    .filter(Boolean)

export const abbreviate = (str, length = 3) => {
  const words = slugWords(str)
  if (words.length === 0) return ''
  if (words.length === 1) return words[0].slice(0, length)
  return words.map((w) => w.slice(0, length)).join('')
}

export const generateProductId = (categoryName, productName, existingIds = []) => {
  const catAbbr = abbreviate(categoryName, 3)
  const nameAbbr = abbreviate(productName, 3)
  const base = [catAbbr, nameAbbr].filter(Boolean).join('-')
  if (!base) return ''

  if (!existingIds.includes(base)) return base

  let suffix = 2
  while (existingIds.includes(`${base}-${suffix}`)) {
    suffix++
  }
  return `${base}-${suffix}`
}

export const generateVariantSKU = (productId, variant, existingSKUs = []) => {
  const parts = [productId]

  const color = normalize(variant.color)
  if (color) parts.push(abbreviate(color, 3))

  const model = normalize(variant.variant_name)
  if (model) parts.push(abbreviate(model, 3))

  const size = normalize(variant.size)
  if (size) parts.push(size)

  const base = parts.filter(Boolean).join('-')
  if (!base) return ''

  if (!existingSKUs.includes(base)) return base

  let suffix = 2
  while (existingSKUs.includes(`${base}-${suffix}`)) {
    suffix++
  }
  return `${base}-${suffix}`
}

/**
 * Nuevo sistema de códigos numéricos por categoría:
 *   generateCategoryPrefix('Blusas', []) -> 'BLU'
 *   generateProductCode('BLU', []) -> 'BLU-001'
 *   generateVariantCode('BLU-001', []) -> 'BLU-001-001'
 */

export const generateCategoryPrefix = (name, existingPrefixes = []) => {
  const base = normalize(name).replace(/[^A-Z]/g, '')
  if (!base) return 'CAT'

  let length = 3
  let candidate = base.slice(0, length)

  while (existingPrefixes.includes(candidate)) {
    length++
    if (length <= base.length) {
      candidate = base.slice(0, length)
    } else {
      const suffix = length - base.length
      candidate = `${base}${suffix}`
    }
  }

  return candidate
}

export const generateProductCode = (categoryPrefix, existingCodes = []) => {
  if (!categoryPrefix) return ''
  const regex = new RegExp(`^${categoryPrefix}-(\\d{3,})$`)
  let max = 0
  existingCodes.forEach((code) => {
    const match = code?.match(regex)
    if (match) max = Math.max(max, parseInt(match[1], 10))
  })
  const next = max + 1
  return `${categoryPrefix}-${String(next).padStart(3, '0')}`
}

export const generateVariantCode = (productCode, size, existingVariantCodes = []) => {
  if (!productCode) return ''
  const prefix = `${productCode}-`
  let max = 0
  existingVariantCodes.forEach((code) => {
    if (code?.startsWith(prefix)) {
      const parts = code.slice(prefix.length).split('-')
      const numPart = parts[0]
      if (/^\d+$/.test(numPart)) {
        max = Math.max(max, parseInt(numPart, 10))
      }
    }
  })
  const next = max + 1
  const sizeSuffix = size ? `-${size}` : ''
  return `${productCode}-${String(next).padStart(3, '0')}${sizeSuffix}`
}

export const formatVariantLabel = (variant, sizeLabel = 'Talla') => {
  const parts = []
  if (variant.color) parts.push(variant.color)
  if (variant.variant_name) parts.push(variant.variant_name)
  if (variant.size) parts.push(`${sizeLabel} ${variant.size}`)
  if (parts.length === 0) return 'Estándar'
  return parts.join(' / ')
}

/* ===== Orden determinista de variantes ===== */

const SIZE_FALLBACK = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', '4XL', '5XL', 'UNI', 'ÚNICA', 'UNICA']

const normalizeSize = (size) => String(size || '').trim().toUpperCase()

export const variantGroupKey = (variant) =>
  `${String(variant?.color || '').trim().toLowerCase()}::${String(variant?.variant_name || '').trim().toLowerCase()}`

const sizeRank = (size, sizeOptions = []) => {
  const normalized = normalizeSize(size)
  const index = (sizeOptions || []).findIndex((opt) => normalizeSize(opt) === normalized)
  if (index >= 0) return index
  const fallback = SIZE_FALLBACK.indexOf(normalized)
  return fallback >= 0 ? 1000 + fallback : 2000
}

const variantNumber = (variant, productId) => {
  const sku = String(variant?.sku || '').toUpperCase()
  if (!sku) return null
  const prefix = productId ? `${String(productId).toUpperCase()}-` : ''
  const rest = prefix && sku.startsWith(prefix) ? sku.slice(prefix.length) : sku
  const match = rest.match(/^(\d+)(?:-|$)/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Ordena variantes por color/modelo (orden de creación) y luego por talla
 * según las opciones de la categoría. No modifica el arreglo original.
 */
export const sortVariants = (variants, productId, sizeOptions = []) => {
  const list = Array.isArray(variants) ? variants : []
  const firstIndex = new Map()
  list.forEach((variant, index) => {
    const key = variantGroupKey(variant)
    if (!firstIndex.has(key)) firstIndex.set(key, index)
  })

  const groupMeta = new Map()
  list.forEach((variant) => {
    const key = variantGroupKey(variant)
    if (!groupMeta.has(key)) {
      groupMeta.set(key, { firstIndex: firstIndex.get(key), minCreated: Infinity, minNumber: Infinity })
    }
    const meta = groupMeta.get(key)
    if (variant?.created_at) {
      const created = Date.parse(variant.created_at)
      if (Number.isFinite(created) && created < meta.minCreated) meta.minCreated = created
    }
    const number = variantNumber(variant, productId)
    if (number != null && number < meta.minNumber) meta.minNumber = number
  })

  const compareGroups = (a, b) => {
    const metaA = groupMeta.get(variantGroupKey(a))
    const metaB = groupMeta.get(variantGroupKey(b))
    if (!metaA || !metaB) return 0
    const hasCreatedA = Number.isFinite(metaA.minCreated)
    const hasCreatedB = Number.isFinite(metaB.minCreated)
    if (hasCreatedA && hasCreatedB && metaA.minCreated !== metaB.minCreated) {
      return metaA.minCreated - metaB.minCreated
    }
    if (hasCreatedA !== hasCreatedB) return hasCreatedA ? -1 : 1
    if (metaA.minNumber !== Infinity && metaB.minNumber !== Infinity && metaA.minNumber !== metaB.minNumber) {
      return metaA.minNumber - metaB.minNumber
    }
    return metaA.firstIndex - metaB.firstIndex
  }

  return [...list].sort((a, b) => {
    const groupComparison = compareGroups(a, b)
    if (groupComparison !== 0) return groupComparison
    const rankA = sizeRank(a?.size, sizeOptions)
    const rankB = sizeRank(b?.size, sizeOptions)
    if (rankA !== rankB) return rankA - rankB
    const numberA = variantNumber(a, productId)
    const numberB = variantNumber(b, productId)
    if (numberA != null && numberB != null && numberA !== numberB) return numberA - numberB
    return String(a?.sku || '').localeCompare(String(b?.sku || ''), 'es', { numeric: true })
  })
}

export const getVariantOptions = (product) => {
  // Ordena con todas las variantes (aunque no tengan stock) para que el orden
  // de colores/modelos no cambie según el stock disponible.
  const ordered = sortVariants(
    product?.product_variants || [],
    product?.id,
    product?.categories?.size_options || []
  )
  const variants = ordered.filter((v) => v.stock > 0)
  const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))]
  const variantNames = [...new Set(variants.map((v) => v.variant_name).filter(Boolean))]
  const sizes = [...new Set(variants.map((v) => v.size).filter(Boolean))]
  return { variants, colors, variantNames, sizes }
}

export const getFirstAvailableVariant = (product) => {
  const { variants } = getVariantOptions(product)
  return variants[0] || null
}

export const getVariantImage = (product, variant) => {
  if (variant?.image) return variant.image
  if (Array.isArray(variant?.images) && variant.images.length > 0) return variant.images[0]
  if (product?.images?.length) return product.images[0]
  return null
}

/** Todas las fotos de una variante (galería de su color/modelo). */
export const getVariantImages = (product, variant) => {
  const list = []
  const push = (url) => {
    if (url && !list.includes(url)) list.push(url)
  }
  if (Array.isArray(variant?.images)) variant.images.forEach(push)
  if (variant?.image) push(variant.image)
  if (list.length === 0 && product?.images?.length) product.images.forEach(push)
  return list
}

export const getVariantModels = (product) => {
  const { variants } = getVariantOptions(product)
  const groups = {}

  variants.forEach((v) => {
    const modelKey = [v.color, v.variant_name].filter(Boolean).join(' / ') || 'Estándar'
    if (!groups[modelKey]) {
      groups[modelKey] = {
        key: modelKey,
        color: v.color || null,
        variantName: v.variant_name || null,
        image: null,
        images: [],
        variants: [],
      }
    }
    groups[modelKey].variants.push(v)
  })

  return Object.values(groups).map((g) => {
    const images = []
    const push = (url) => {
      if (url && !images.includes(url)) images.push(url)
    }
    g.variants.forEach((v) => {
      const variantImages = Array.isArray(v.images) && v.images.length > 0
        ? v.images
        : (v.image ? [v.image] : [])
      variantImages.forEach(push)
    })
    const gallery = images.length > 0 ? images : (product?.images || []).filter(Boolean)
    const prices = g.variants.map((v) => v.price || 0).filter(Boolean)
    return {
      ...g,
      image: gallery[0] || null,
      images: gallery,
      sizes: [...new Set(g.variants.map((v) => v.size || 'Única').filter(Boolean))],
      firstVariant: g.variants[0],
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
    }
  })
}

export const getProductPriceRange = (product) => {
  const { variants } = getVariantOptions(product)
  const prices = variants.length
    ? variants.map((v) => v.price).filter(Boolean)
    : [product?.price].filter(Boolean)
  if (prices.length === 0) return { min: 0, max: 0 }
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

export const findVariantByModelAndSize = (product, modelKey, size) => {
  const { variants } = getVariantOptions(product)
  return variants.find((v) => {
    const vModelKey = [v.color, v.variant_name].filter(Boolean).join(' / ') || 'Estándar'
    const vSize = v.size || 'Única'
    return vModelKey === modelKey && vSize === size
  }) || null
}
