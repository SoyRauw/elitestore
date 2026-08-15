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

export const getVariantOptions = (product) => {
  const variants = (product?.product_variants || []).filter((v) => v.stock > 0)
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
  if (product?.images?.length) return product.images[0]
  return null
}
