import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

const PAYMENT_METHODS = {
  efectivo: 'Efectivo',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
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
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()
}

export function exportMovementsToExcel(movements, filename = 'reporte_ventas') {
  const rows = movements.map((m) => ({
    Fecha: formatDate(m.created_at),
    Recibo: `#${m.id?.slice(0, 8)}`,
    Tipo: m.movement_type?.toUpperCase() || '—',
    Cliente: m.customer_name || 'Cliente general',
    Método: PAYMENT_METHODS[m.payment_method] || m.payment_method || '—',
    Subtotal: formatMoney(m.total_amount + (m.discount_amount || 0)),
    Descuento: formatMoney(m.discount_amount || 0),
    Total: formatMoney(m.total_amount),
    Estado: m.status?.toUpperCase() || '—',
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas')
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
