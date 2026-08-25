import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { formatVariantLabel } from './sku'

const PAYMENT_METHODS = {
  efectivo: 'Efectivo',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  zinli: 'Zinli',
  binance: 'Binance',
  transferencia: 'Transferencia',
  punto: 'Punto de Venta',
  multiple: 'Múltiple',
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function formatMoney(value) {
  return `$${(parseFloat(value) || 0).toFixed(2)}`
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_\-() ]/gi, '_')
}

function formatMovementPayments(movement) {
  const method = movement.payment_method
  if (method !== 'multiple') {
    return `${PAYMENT_METHODS[method] || method || '—'} ${formatMoney(movement.total_amount)}`
  }
  if (!movement.movement_payments?.length) {
    return 'Múltiple'
  }
  return movement.movement_payments
    .map((p) => `${PAYMENT_METHODS[p.method] || p.method} ${formatMoney(p.amount)}`)
    .join(' / ')
}

export function exportMovementsToExcel(movements, movementItems, filename = 'reporte_ventas') {
  const movementsById = new Map(movements.map((m) => [m.id, m]))

  // 1. Sheet "Ventas" — one row per movement
  const salesRows = movements.map((m) => ({
    Fecha: formatDate(m.created_at),
    Recibo: `#${m.id?.slice(0, 8)}`,
    Tipo: m.movement_type?.toUpperCase() || '—',
    Cliente: m.customer_name || 'Cliente general',
    Método: formatMovementPayments(m),
    Subtotal: formatMoney((parseFloat(m.total_amount) || 0) + (parseFloat(m.discount_amount) || 0)),
    Descuento: formatMoney(m.discount_amount || 0),
    Total: formatMoney(m.total_amount),
    Estado: m.status?.toUpperCase() || '—',
  }))

  // 2. Sheet "Productos vendidos" — one row per movement_item
  const itemRows = movementItems.map((item) => {
    const movement = movementsById.get(item.movement_id) || {}
    const date = movement.created_at ? new Date(movement.created_at) : null
    return {
      Fecha: date ? date.toLocaleDateString() : '—',
      Hora: date ? date.toLocaleTimeString() : '—',
      Recibo: `#${movement.id?.slice(0, 8)}`,
      Cliente: movement.customer_name || 'Cliente general',
      Producto: item.products?.name || '—',
      Variante: formatVariantLabel(item.product_variants || {}),
      SKU: item.product_variants?.sku || '—',
      Cantidad: item.quantity,
      'Precio unitario': formatMoney(item.unit_price),
      Total: formatMoney((item.quantity || 0) * (item.unit_price || 0)),
      'Método de pago': formatMovementPayments(movement),
    }
  })

  // 3. Sheet "Resumen por producto" — aggregated by product + variant
  const productSummary = {}
  movementItems.forEach((item) => {
    const name = item.products?.name || '—'
    const variant = formatVariantLabel(item.product_variants || {})
    const sku = item.product_variants?.sku || item.products?.sku || '—'
    const key = `${name}|${variant}|${sku}`
    const quantity = item.quantity || 0
    const total = quantity * (item.unit_price || 0)

    if (!productSummary[key]) {
      productSummary[key] = { Producto: name, Variante: variant, SKU: sku, quantity: 0, total: 0 }
    }
    productSummary[key].quantity += quantity
    productSummary[key].total += total
  })

  const summaryRows = Object.values(productSummary).map((p) => ({
    Producto: p.Producto,
    Variante: p.Variante,
    SKU: p.SKU,
    'Unidades vendidas': p.quantity,
    'Monto total': formatMoney(p.total),
  }))

  const wb = XLSX.utils.book_new()
  const wsSales = XLSX.utils.json_to_sheet(salesRows)
  const wsItems = XLSX.utils.json_to_sheet(itemRows)
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows)

  XLSX.utils.book_append_sheet(wb, wsSales, 'Ventas')
  XLSX.utils.book_append_sheet(wb, wsItems, 'Productos vendidos')
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen por producto')
  XLSX.writeFile(wb, `${sanitizeFilename(filename)}.xlsx`)
}

export function exportMovementsToPDF(movements, summary = {}, filename = 'reporte_ventas') {
  const doc = new jsPDF()
  const safeFilename = sanitizeFilename(filename)

  doc.setFontSize(18)
  doc.text('Reporte de Ventas', 14, 20)

  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 28)

  if (summary.totalSales !== undefined) {
    doc.setFontSize(12)
    doc.setTextColor(0)
    doc.text(`Total ventas: ${formatMoney(summary.totalSales)}`, 14, 40)
    doc.text(`Transacciones: ${summary.totalTransactions || 0}`, 14, 47)
  }

  const rows = movements.map((m) => [
    formatDate(m.created_at),
    `#${m.id?.slice(0, 8)}`,
    m.customer_name || 'Cliente general',
    PAYMENT_METHODS[m.payment_method] || m.payment_method || '—',
    formatMoney(m.total_amount),
  ])

  doc.autoTable({
    startY: summary.totalSales !== undefined ? 55 : 40,
    head: [['Fecha', 'Recibo', 'Cliente', 'Método', 'Total']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [196, 120, 138] },
    styles: { fontSize: 9, cellPadding: 2 },
  })

  doc.save(`${safeFilename}.pdf`)
}

export function exportSummaryToPDF(summary, filename = 'resumen_ventas') {
  const doc = new jsPDF()
  doc.setFontSize(18)
  doc.text('Resumen de Ventas', 14, 20)

  doc.setFontSize(11)
  doc.setTextColor(100)
  doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 28)

  const body = [
    ['Total de ventas', formatMoney(summary.totalSales)],
    ['Transacciones', summary.totalTransactions || 0],
    ['Ticket promedio', formatMoney(summary.averageTicket || 0)],
  ]

  doc.autoTable({
    startY: 40,
    head: [['Métrica', 'Valor']],
    body,
    theme: 'striped',
    headStyles: { fillColor: [196, 120, 138] },
    styles: { fontSize: 10, cellPadding: 3 },
  })

  const methodBody = Object.entries(summary.byMethod || {}).map(([method, amount]) => [
    PAYMENT_METHODS[method] || method,
    formatMoney(amount),
  ])

  if (methodBody.length > 0) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Método de pago', 'Monto']],
      body: methodBody,
      theme: 'striped',
      headStyles: { fillColor: [196, 120, 138] },
      styles: { fontSize: 10, cellPadding: 3 },
    })
  }

  doc.save(`${sanitizeFilename(filename)}.pdf`)
}
