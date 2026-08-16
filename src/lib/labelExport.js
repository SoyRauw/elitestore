import * as XLSX from 'xlsx'

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
}

export function exportProductLabels(product, variants) {
  const rows = []

  variants
    .filter(v => !v.isDeleted && (v.stock || 0) > 0)
    .forEach(v => {
      const quantity = parseInt(v.stock, 10) || 0
      const price = v.price !== '' && v.price != null ? parseFloat(v.price) : parseFloat(product.price) || 0
      for (let i = 0; i < quantity; i++) {
        rows.push({
          SKU: v.sku || '',
          Nombre: product.name || '',
          Color: v.color || '',
          Talla: v.size || '',
          Precio: price.toFixed(2),
          Barcode: v.sku || '',
        })
      }
    })

  if (rows.length === 0) {
    alert('No hay variantes con stock para generar etiquetas')
    return
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Etiquetas')

  const safeSku = sanitizeFilename(product.id || product.name || 'producto')
  const dateStr = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `etiquetas_${safeSku}_${dateStr}.xlsx`)
}
