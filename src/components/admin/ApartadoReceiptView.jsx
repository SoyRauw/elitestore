import { formatVariantLabel } from '../../lib/sku'
import styles from './ApartadoReceiptView.module.css'

function formatMoney(value) {
  return `$${(parseFloat(value) || 0).toFixed(2)}`
}

export default function ApartadoReceiptView({ apartado }) {
  const a = apartado || {}
  const abonado = a.paidAmount != null
    ? (parseFloat(a.paidAmount) || 0)
    : (a.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const pendiente = Math.max(0, Math.round(((parseFloat(a.total) || 0) - abonado) * 100) / 100)

  return (
    <div className={styles.receipt}>
      <div className={styles.brand}>
        <div className={styles.brandName}>Elite Store</div>
        <div className={styles.brandSubtitle}>Comprobante de apartado</div>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span>Apartado</span>
          <strong>#{a.movement?.id?.slice(0, 8) || '—'}</strong>
        </div>
        <div className={styles.metaRow}>
          <span>Fecha</span>
          <strong>{new Date(a.createdAt).toLocaleString()}</strong>
        </div>
        <div className={styles.metaRow}>
          <span>Vence el</span>
          <strong>{a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'}</strong>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Cliente</div>
        <div className={styles.customerName}>{a.customer?.name || '—'}</div>
        {a.customer?.id_number && <div className={styles.customerMeta}>Cédula: {a.customer.id_number}</div>}
        {a.customer?.phone && <div className={styles.customerMeta}>Teléfono: {a.customer.phone}</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Prendas apartadas</div>
        {(a.items || []).map((item, i) => (
          <div key={i} className={styles.item}>
            <div className={styles.itemMain}>
              <span className={styles.itemQty}>{item.quantity}x</span>
              <span className={styles.itemName}>{item.product?.name}</span>
            </div>
            <div className={styles.itemVariantLabel}>
              {formatVariantLabel(item.variant, item.product?.categories?.size_label)}
            </div>
            <div className={styles.itemPrice}>
              {formatMoney(item.unit_price)} c/u
              <strong>{formatMoney(item.unit_price * item.quantity)}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.totals}>
        <div className={styles.totalRow}>
          <span>Total a pagar en 15 días</span>
          <strong>{formatMoney(a.total)}</strong>
        </div>
        <div className={styles.totalRow}>
          <span>Inicial pagada</span>
          <strong>{formatMoney(abonado)}</strong>
        </div>
        <div className={styles.totalFinal}>
          <span>Pendiente</span>
          <strong>{formatMoney(pendiente)}</strong>
        </div>
      </div>

      <div className={styles.footer}>
        ⚠️ Si el apartado no se cancela en la fecha indicada se pierde la reserva.
      </div>
    </div>
  )
}

function getApartadoHTML({ apartado }) {
  const a = apartado || {}
  const abonado = a.paidAmount != null
    ? (parseFloat(a.paidAmount) || 0)
    : (a.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const pendiente = Math.max(0, Math.round(((parseFloat(a.total) || 0) - abonado) * 100) / 100)
  const returnId = a.movement?.id?.slice(0, 8) || '—'

  const productsHTML = (a.items || []).map(item => {
    const variantLabel = formatVariantLabel(item.variant, item.product?.categories?.size_label)
    return `
    <div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #f0f0f0;">
      <div style="display:flex; gap:6px; font-weight:500; color:#1f2937;">
        <span style="font-weight:700; min-width:24px;">${item.quantity}x</span>
        <span>${item.product?.name || '—'}</span>
      </div>
      <div style="font-size:12px; color:#6b7280; margin-top:3px; margin-left:30px;">${variantLabel}</div>
      <div style="display:flex; justify-content:space-between; margin-top:4px; margin-left:30px; font-size:13px;">
        <span>${formatMoney(item.unit_price)} c/u</span>
        <strong>${formatMoney(item.unit_price * item.quantity)}</strong>
      </div>
    </div>
  `}).join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Apartado ${returnId}</title>
        <style>
          @page { size: portrait; margin: 10mm; }
          body { margin:0; padding:0; font-family: ui-monospace, Consolas, monospace; font-size:14px; color:#1f2937; background:white; }
          .receipt { width:100%; padding:16px; box-sizing:border-box; border:1px dashed #d1d5db; border-radius:8px; background:white; }
          .brand { text-align:center; border-bottom:1px dashed #d1d5db; padding-bottom:12px; margin-bottom:14px; }
          .brand-name { font-size:22px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; }
          .brand-sub { font-size:12px; color:#6b7280; }
          .meta-row { display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; }
          .meta-row span { color:#6b7280; }
          .section-title { font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px; }
          .total-box { display:flex; justify-content:space-between; font-size:18px; font-weight:700; border-top:2px dashed #d1d5db; padding-top:14px; margin-top:14px; }
          .footer { text-align:center; margin-top:18px; padding-top:14px; border-top:1px dashed #d1d5db; font-size:12px; color:#6b7280; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="brand">
            <div class="brand-name">Elite Store</div>
            <div class="brand-sub">Comprobante de apartado</div>
          </div>
          <div>
            <div class="meta-row"><span>Apartado</span><strong>#${returnId}</strong></div>
            <div class="meta-row"><span>Fecha</span><strong>${new Date(a.createdAt || Date.now()).toLocaleString()}</strong></div>
            <div class="meta-row"><span>Vence el</span><strong>${a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '—'}</strong></div>
          </div>
          <div style="border-top:1px dashed #d1d5db; padding-top:12px; margin-top:12px;">
            <div class="section-title">Cliente</div>
            <div style="font-weight:600; color:#1f2937;">${a.customer?.name || '—'}</div>
            ${a.customer?.id_number ? `<div style="font-size:12px; color:#6b7280; margin-top:2px;">Cédula: ${a.customer.id_number}</div>` : ''}
            ${a.customer?.phone ? `<div style="font-size:12px; color:#6b7280; margin-top:2px;">Teléfono: ${a.customer.phone}</div>` : ''}
          </div>
          <div style="border-top:1px dashed #d1d5db; padding-top:14px; margin-top:14px;">
            <div class="section-title">Prendas apartadas</div>
            ${productsHTML}
          </div>
          <div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
              <span>Total a pagar en 15 días</span><strong>${formatMoney(a.total)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
              <span>Inicial pagada</span><strong>${formatMoney(abonado)}</strong>
            </div>
            <div class="total-box"><span>Pendiente</span><span>${formatMoney(pendiente)}</span></div>
          </div>
          <div class="footer">⚠️ Si el apartado no se cancela en la fecha indicada, se pierde la reserva.</div>
        </div>
      </body>
    </html>
  `
}

export function printApartadoReceipt(data) {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '-9999px'
  iframe.style.left = '-9999px'
  iframe.style.width = '100%'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(getApartadoHTML(data))
  doc.close()

  const doPrint = () => {
    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }

  if (iframe.contentWindow.document.readyState === 'complete') {
    doPrint()
  } else {
    iframe.onload = doPrint
  }

  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
    }
  }, 60000)
}
