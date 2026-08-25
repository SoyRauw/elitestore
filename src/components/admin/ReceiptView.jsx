import { formatVariantLabel } from '../../lib/sku'
import styles from './ReceiptView.module.css'

const PAYMENT_METHODS = {
  efectivo: 'Efectivo',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  zinli: 'Zinli',
  binance: 'Binance',
  transferencia: 'Transferencia',
  punto: 'Punto de Venta',
  pendiente: 'Pendiente',
  multiple: 'Múltiple',
}

function getAppliedCouponName(appliedCoupon) {
  if (!appliedCoupon) return null
  if (appliedCoupon.type === 'reward') return appliedCoupon.coupon?.name
  if (appliedCoupon.type === 'customer') return appliedCoupon.coupon?.reward_coupons?.name
  return appliedCoupon.name || appliedCoupon.reward_coupons?.name || null
}

export default function ReceiptView({ movement, items, payments, customer, subtotal, discount, appliedCoupon, total, createdAt, className = '' }) {
  const date = createdAt ? new Date(createdAt) : new Date()
  const totalPaid = (payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  const change = Math.max(0, totalPaid - total)
  const invoiceId = movement?.id?.slice(0, 8) || '—'

  return (
    <div className={`${styles.receipt} print-receipt ${className}`}>
      <div className={styles.brand}>
        <div className={styles.brandName}>Elite Store</div>
        <div className={styles.brandSubtitle}>Recibo de venta</div>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span>Recibo</span>
          <strong>#{invoiceId}</strong>
        </div>
        <div className={styles.metaRow}>
          <span>Fecha</span>
          <strong>{date.toLocaleString()}</strong>
        </div>
        {movement?.movement_type && (
          <div className={styles.metaRow}>
            <span>Tipo</span>
            <strong>{movement.movement_type.toUpperCase()}</strong>
          </div>
        )}
        {movement?.status && (
          <div className={styles.metaRow}>
            <span>Estado</span>
            <strong>{movement.status.toUpperCase()}</strong>
          </div>
        )}
      </div>

      {(customer?.name || movement?.customer_name) && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Cliente</div>
          <div className={styles.customerName}>{customer?.name || movement.customer_name}</div>
          {(customer?.id_number || movement?.customer_id) && (
            <div className={styles.customerMeta}>Cédula: {customer?.id_number || '—'}</div>
          )}
          {(customer?.phone || movement?.customer_phone) && (
            <div className={styles.customerMeta}>Teléfono: {customer?.phone || movement.customer_phone}</div>
          )}
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Productos</div>
        {items?.map((item, i) => (
          <div key={i} className={styles.item}>
            <div className={styles.itemMain}>
              <span className={styles.itemQty}>{item.quantity}x</span>
              <span className={styles.itemName}>{item.product?.name || item.products?.name}</span>
            </div>
            <div className={styles.itemVariantLabel}>
              {formatVariantLabel(item.variant || item.product_variants, item.product?.categories?.size_label || item.products?.categories?.size_label)}
            </div>
            <div className={styles.itemPrice}>
              ${(item.price || item.unit_price || 0).toFixed(2)} c/u
              <strong>${((item.price || item.unit_price || 0) * item.quantity).toFixed(2)}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.totals}>
        <div className={styles.totalRow}>
          <span>Subtotal</span>
          <strong>${(subtotal || 0).toFixed(2)}</strong>
        </div>
        {(discount || movement?.discount_amount) > 0 && (
          <div className={`${styles.totalRow} ${styles.discountRow}`}>
            <span>
              Descuento
              {(getAppliedCouponName(appliedCoupon) || movement?.customer_coupons?.reward_coupons?.name) && (
                <span className={styles.couponName}>
                  ({getAppliedCouponName(appliedCoupon) || movement?.customer_coupons?.reward_coupons?.name})
                </span>
              )}
            </span>
            <strong>-${(discount || movement?.discount_amount || 0).toFixed(2)}</strong>
          </div>
        )}
        <div className={styles.totalFinal}>
          <span>Total</span>
          <strong>${(total || 0).toFixed(2)}</strong>
        </div>
      </div>

      {payments && payments.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Pagos</div>
          {payments.map((p, i) => (
            <div key={i} className={styles.paymentRow}>
              <span>{PAYMENT_METHODS[p.method] || p.method}</span>
              <strong>${(parseFloat(p.amount) || 0).toFixed(2)}</strong>
              {p.reference && <div className={styles.paymentRef}>Ref: {p.reference}</div>}
            </div>
          ))}
          <div className={styles.totalPaidRow}>
            <span>Total pagado</span>
            <strong>${totalPaid.toFixed(2)}</strong>
          </div>
          {change > 0 && (
            <div className={styles.changeRow}>
              <span>Vuelto</span>
              <strong>${change.toFixed(2)}</strong>
            </div>
          )}
        </div>
      )}

      {movement?.notes && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Notas</div>
          <div className={styles.notes}>{movement.notes}</div>
        </div>
      )}

      <div className={styles.footer}>¡Gracias por su compra!</div>
    </div>
  )
}

const PAYMENT_METHODS_INLINE = {
  efectivo: 'Efectivo',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  zinli: 'Zinli',
  binance: 'Binance',
  transferencia: 'Transferencia',
  punto: 'Punto de Venta',
  pendiente: 'Pendiente',
  multiple: 'Múltiple',
}

function formatInlineVariantLabel(variant) {
  if (!variant) return '—'
  const parts = []
  if (variant.color) parts.push(variant.color)
  if (variant.variant_name) parts.push(variant.variant_name)
  if (variant.size) parts.push(`Talla ${variant.size}`)
  return parts.join(' / ') || '—'
}

function formatMoney(value) {
  return `$${(parseFloat(value) || 0).toFixed(2)}`
}

function getReceiptHTML({ movement, items, payments, customer, subtotal, discount, appliedCoupon, total, createdAt }) {
  const date = createdAt ? new Date(createdAt) : new Date()
  const invoiceId = movement?.id?.slice(0, 8) || '—'
  const totalPaid = (payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  const change = Math.max(0, totalPaid - total)
  const customerName = customer?.name || movement?.customer_name || null
  const customerId = customer?.id_number || null
  const customerPhone = customer?.phone || movement?.customer_phone || null
  const discountAmount = discount || movement?.discount_amount || 0
  const couponName = getAppliedCouponName(appliedCoupon) || movement?.customer_coupons?.reward_coupons?.name

  const productsHTML = (items || []).map(item => {
    const name = item.product?.name || item.products?.name || '—'
    const variant = item.variant || item.product_variants
    const unitPrice = item.price || item.unit_price || 0
    const qty = item.quantity || 1
    return `
      <div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #f0f0f0;">
        <div style="display:flex; gap:6px; font-weight:500; color:#1f2937;">
          <span style="font-weight:700; min-width:24px;">${qty}x</span>
          <span>${name}</span>
        </div>
        <div style="font-size:12px; color:#6b7280; margin-top:3px; margin-left:30px;">${formatInlineVariantLabel(variant)}</div>
        <div style="display:flex; justify-content:space-between; margin-top:4px; margin-left:30px; font-size:13px;">
          <span>${formatMoney(unitPrice)} c/u</span>
          <strong>${formatMoney(unitPrice * qty)}</strong>
        </div>
      </div>
    `
  }).join('')

  const paymentsHTML = (payments || []).length > 0
    ? (payments || []).map(p => `
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
          <span>${PAYMENT_METHODS_INLINE[p.method] || p.method}</span>
          <strong>${formatMoney(p.amount)}</strong>
        </div>
        ${p.reference ? `<div style="font-size:11px; color:#6b7280; margin-bottom:6px;">Ref: ${p.reference}</div>` : ''}
      `).join('') + `
        <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px solid #f0f0f0; font-size:13px;">
          <span>Total pagado</span>
          <strong>${formatMoney(totalPaid)}</strong>
        </div>
        ${change > 0 ? `
          <div style="display:flex; justify-content:space-between; margin-top:6px; color:#166534; font-size:13px; background:#dcfce7; padding:6px 8px; border-radius:6px;">
            <span>Vuelto</span>
            <strong>${formatMoney(change)}</strong>
          </div>
        ` : ''}
      `
    : ''

  const customerHTML = customerName
    ? `
      <div style="border-top:1px dashed #d1d5db; padding-top:12px; margin-top:12px;">
        <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Cliente</div>
        <div style="font-weight:600; color:#1f2937;">${customerName}</div>
        ${customerId ? `<div style="font-size:12px; color:#6b7280; margin-top:2px;">Cédula: ${customerId}</div>` : ''}
        ${customerPhone ? `<div style="font-size:12px; color:#6b7280; margin-top:2px;">Teléfono: ${customerPhone}</div>` : ''}
      </div>
    `
    : ''

  const notesHTML = movement?.notes
    ? `
      <div style="border-top:1px dashed #d1d5db; padding-top:12px; margin-top:12px;">
        <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Notas</div>
        <div style="font-size:12px; color:#6b7280; white-space:pre-wrap;">${movement.notes}</div>
      </div>
    `
    : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Recibo ${invoiceId}</title>
        <style>
          @page { size: portrait; margin: 10mm; }
          @media print {
            body { margin: 0; padding: 0; }
            .receipt { border: none; border-radius: 0; padding: 0; max-width: none; width: 100%; }
          }
          body {
            margin: 0;
            padding: 0;
            font-family: ui-monospace, Consolas, monospace;
            font-size: 14px;
            color: #1f2937;
            background: white;
          }
          .receipt {
            width: 100%;
            max-width: 100%;
            padding: 16px;
            box-sizing: border-box;
            border: 1px dashed #d1d5db;
            border-radius: 8px;
            background: white;
          }
          .brand { text-align: center; border-bottom: 1px dashed #d1d5db; padding-bottom: 12px; margin-bottom: 14px; }
          .brand-name { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
          .brand-sub { font-size: 12px; color: #6b7280; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
          .meta-row span { color: #6b7280; }
          .section-title { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
          .total-box { display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; border-top: 2px dashed #d1d5db; padding-top: 14px; margin-top: 14px; }
          .footer { text-align: center; margin-top: 18px; padding-top: 14px; border-top: 1px dashed #d1d5db; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="brand">
            <div class="brand-name">Elite Store</div>
            <div class="brand-sub">Recibo de venta</div>
          </div>
          <div>
            <div class="meta-row"><span>Recibo</span><strong>#${invoiceId}</strong></div>
            <div class="meta-row"><span>Fecha</span><strong>${date.toLocaleString()}</strong></div>
            ${movement?.movement_type ? `<div class="meta-row"><span>Tipo</span><strong>${movement.movement_type.toUpperCase()}</strong></div>` : ''}
            ${movement?.status ? `<div class="meta-row"><span>Estado</span><strong>${movement.status.toUpperCase()}</strong></div>` : ''}
          </div>
          ${customerHTML}
          <div style="border-top:1px dashed #d1d5db; padding-top:14px; margin-top:14px;">
            <div class="section-title">Productos</div>
            ${productsHTML}
          </div>
          <div>
            <div class="total-row" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
              <span>Subtotal</span>
              <span>${formatMoney(subtotal || total)}</span>
            </div>
            ${discountAmount > 0 ? `
              <div class="total-row" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; color:#16a34a;">
                <span>Descuento ${couponName ? `(${couponName})` : ''}</span>
                <span>-${formatMoney(discountAmount)}</span>
              </div>
            ` : ''}
            <div class="total-box">
              <span>Total</span>
              <span>${formatMoney(total)}</span>
            </div>
          </div>
          ${payments ? `<div style="border-top:1px dashed #d1d5db; padding-top:14px; margin-top:14px;"><div class="section-title">Pagos</div>${paymentsHTML}</div>` : ''}
          ${notesHTML}
          <div class="footer">¡Gracias por su compra!</div>
        </div>
      </body>
    </html>
  `
}

export function printReceipt(data) {
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
