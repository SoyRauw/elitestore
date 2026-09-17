import { formatVariantLabel } from '../../lib/sku'
import styles from './ReturnReceiptView.module.css'

function formatMoney(value) {
  return `$${(parseFloat(value) || 0).toFixed(2)}`
}

export default function ReturnReceiptView({ movement, items, customer, totalCredit, newBalance, createdAt }) {
  const date = createdAt ? new Date(createdAt) : new Date()
  const returnId = movement?.id?.slice(0, 8) || '—'

  return (
    <div className={`${styles.receipt} print-receipt`}>
      <div className={styles.brand}>
        <div className={styles.brandName}>Elite Store</div>
        <div className={styles.brandSubtitle}>Comprobante de devolución</div>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span>Devolución</span>
          <strong>#{returnId}</strong>
        </div>
        <div className={styles.metaRow}>
          <span>Fecha</span>
          <strong>{date.toLocaleString()}</strong>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Cliente</div>
        <div className={styles.customerName}>{customer?.name}</div>
        {customer?.id_number && <div className={styles.customerMeta}>Cédula: {customer.id_number}</div>}
        {customer?.phone && <div className={styles.customerMeta}>Teléfono: {customer.phone}</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Productos devueltos</div>
        {items?.map((item, i) => (
          <div key={i} className={styles.item}>
            <div className={styles.itemMain}>
              <span className={styles.itemQty}>{item.returnQty}x</span>
              <span className={styles.itemName}>{item.product?.name}</span>
            </div>
            <div className={styles.itemVariantLabel}>
              {formatVariantLabel(item.variant, item.product?.categories?.size_label)}
            </div>
            <div className={styles.itemInvoice}>
              Factura origen: #{item.invoice?.id?.slice(0, 8) || '—'}
            </div>
            <div className={styles.itemPrice}>
              {formatMoney(item.unit_price)} c/u
              <strong>{formatMoney(item.unit_price * item.returnQty)}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.totals}>
        <div className={styles.totalFinal}>
          <span>Crédito generado</span>
          <strong>{formatMoney(totalCredit)}</strong>
        </div>
        <div className={styles.balanceRow}>
          <span>Saldo actual del cliente</span>
          <strong>{formatMoney(newBalance)}</strong>
        </div>
      </div>

      <div className={styles.footer}>¡Gracias por preferirnos!</div>
    </div>
  )
}

function getReceiptHTML({ movement, items, customer, totalCredit, newBalance, createdAt }) {
  const date = createdAt ? new Date(createdAt) : new Date()
  const returnId = movement?.id?.slice(0, 8) || '—'

  const productsHTML = (items || []).map(item => {
    const variantLabel = formatVariantLabel(item.variant, item.product?.categories?.size_label)
    return `
    <div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #f0f0f0;">
      <div style="display:flex; gap:6px; font-weight:500; color:#1f2937;">
        <span style="font-weight:700; min-width:24px;">${item.returnQty}x</span>
        <span>${item.product?.name || '—'}</span>
      </div>
      <div style="font-size:12px; color:#6b7280; margin-top:3px; margin-left:30px;">${variantLabel}</div>
      <div style="font-size:11px; color:#c4788a; margin-top:2px; margin-left:30px;">Factura origen: #${item.invoice?.id?.slice(0, 8) || '—'}</div>
      <div style="display:flex; justify-content:space-between; margin-top:4px; margin-left:30px; font-size:13px;">
        <span>${formatMoney(item.unit_price)} c/u</span>
        <strong>${formatMoney(item.unit_price * item.returnQty)}</strong>
      </div>
    </div>
  `}).join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Devolución ${returnId}</title>
        <style>
          @page { size: portrait; margin: 10mm; }
          @media print {
            body { margin: 0; padding: 0; }
            .receipt { border: none; border-radius: 0; padding: 0; max-width: none; width: 100%; }
          }
          body { margin:0; padding:0; font-family: ui-monospace, Consolas, monospace; font-size:14px; color:#1f2937; background:white; }
          .receipt { width:100%; max-width:100%; padding:16px; box-sizing:border-box; border:1px dashed #d1d5db; border-radius:8px; background:white; }
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
            <div class="brand-sub">Comprobante de devolución</div>
          </div>
          <div>
            <div class="meta-row"><span>Devolución</span><strong>#${returnId}</strong></div>
            <div class="meta-row"><span>Fecha</span><strong>${date.toLocaleString()}</strong></div>
          </div>
          <div style="border-top:1px dashed #d1d5db; padding-top:12px; margin-top:12px;">
            <div class="section-title">Cliente</div>
            <div style="font-weight:600; color:#1f2937;">${customer?.name || '—'}</div>
            ${customer?.id_number ? `<div style="font-size:12px; color:#6b7280; margin-top:2px;">Cédula: ${customer.id_number}</div>` : ''}
            ${customer?.phone ? `<div style="font-size:12px; color:#6b7280; margin-top:2px;">Teléfono: ${customer.phone}</div>` : ''}
          </div>
          <div style="border-top:1px dashed #d1d5db; padding-top:14px; margin-top:14px;">
            <div class="section-title">Productos devueltos</div>
            ${productsHTML}
          </div>
          <div>
            <div class="total-box"><span>Crédito generado</span><span>${formatMoney(totalCredit)}</span></div>
            <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:13px; color:#166534;">
              <span>Saldo actual del cliente</span>
              <strong>${formatMoney(newBalance)}</strong>
            </div>
          </div>
          <div class="footer">¡Gracias por preferirnos!</div>
        </div>
      </body>
    </html>
  `
}

export function printReturnReceipt(data) {
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
  doc.write(getReceiptHTML(data))
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
