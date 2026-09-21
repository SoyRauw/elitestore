import styles from './AbonoReceiptView.module.css'

const PAYMENT_METHODS = {
  efectivo: 'Efectivo $',
  efectivo_bs: 'Efectivo Bs',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  zinli: 'Zinli',
  rapikom: 'Rapikom',
  binance: 'Binance',
  transferencia: 'Transferencia',
  punto: 'Punto de Venta',
  credito: 'Crédito en cuenta',
  pendiente: 'Pendiente',
  multiple: 'Múltiple',
}

function formatMoney(value) {
  return `$${(parseFloat(value) || 0).toFixed(2)}`
}

export default function AbonoReceiptView({ data }) {
  const d = data || {}
  const payments = d.payments || []
  const abonoId = d.abonoId ? d.abonoId.slice(0, 8) : '—'
  const apartadoId = d.apartadoId ? d.apartadoId.slice(0, 8) : '—'

  return (
    <div className={styles.receipt}>
      <div className={styles.brand}>
        <div className={styles.brandName}>Elite Store</div>
        <div className={styles.brandSubtitle}>Comprobante de abono</div>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span>Abono</span>
          <strong>#{abonoId}</strong>
        </div>
        <div className={styles.metaRow}>
          <span>Apartado</span>
          <strong>#{apartadoId}</strong>
        </div>
        <div className={styles.metaRow}>
          <span>Fecha</span>
          <strong>{d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}</strong>
        </div>
        {d.sessionOpenedAt && (
          <div className={styles.metaRow}>
            <span>Turno</span>
            <strong>{new Date(d.sessionOpenedAt).toLocaleString()}</strong>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Cliente</div>
        <div className={styles.customerName}>{d.customer?.name || '—'}</div>
        {d.customer?.id_number && <div className={styles.customerMeta}>Cédula: {d.customer.id_number}</div>}
        {d.customer?.phone && <div className={styles.customerMeta}>Teléfono: {d.customer.phone}</div>}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Pagos</div>
        {payments.length === 0 ? (
          <div className={styles.customerMeta}>Sin desglose</div>
        ) : (
          payments.map((p, i) => (
            <div key={i} className={styles.payRow}>
              <span>
                {PAYMENT_METHODS[p.method] || p.method}
                {p.reference ? <span className={styles.payRef}> (Ref: {p.reference})</span> : null}
              </span>
              <strong>{formatMoney(p.amount)}</strong>
            </div>
          ))
        )}
      </div>

      <div className={styles.totals}>
        <div className={styles.totalFinal}>
          <span>Monto abonado</span>
          <strong>{formatMoney(d.amount)}</strong>
        </div>
        <div className={styles.totalRow}>
          <span>Abonado acumulado</span>
          <strong>{formatMoney(d.paidTotal)}</strong>
        </div>
        <div className={styles.totalRow}>
          <span>Pendiente</span>
          <strong>{formatMoney(d.pending)}</strong>
        </div>
      </div>

      <div className={styles.footer}>
        ⚠️ Si el apartado no se cancela en la fecha indicada se pierde la reserva.
      </div>
    </div>
  )
}

function getAbonoHTML(data) {
  const d = data || {}
  const payments = d.payments || []
  const abonoId = d.abonoId ? d.abonoId.slice(0, 8) : '—'
  const apartadoId = d.apartadoId ? d.apartadoId.slice(0, 8) : '—'

  const paymentsHTML = payments.length === 0
    ? '<div style="font-size:12px; color:#6b7280;">Sin desglose</div>'
    : payments.map((p) => `
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
          <span>${PAYMENT_METHODS[p.method] || p.method}${p.reference ? ` (Ref: ${p.reference})` : ''}</span>
          <strong>${formatMoney(p.amount)}</strong>
        </div>
      `).join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Abono ${abonoId}</title>
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
            <div class="brand-sub">Comprobante de abono</div>
          </div>
          <div>
            <div class="meta-row"><span>Abono</span><strong>#${abonoId}</strong></div>
            <div class="meta-row"><span>Apartado</span><strong>#${apartadoId}</strong></div>
            <div class="meta-row"><span>Fecha</span><strong>${d.createdAt ? new Date(d.createdAt).toLocaleString() : '—'}</strong></div>
            ${d.sessionOpenedAt ? `<div class="meta-row"><span>Turno</span><strong>${new Date(d.sessionOpenedAt).toLocaleString()}</strong></div>` : ''}
          </div>
          <div style="border-top:1px dashed #d1d5db; padding-top:12px; margin-top:12px;">
            <div class="section-title">Cliente</div>
            <div style="font-weight:600; color:#1f2937;">${d.customer?.name || '—'}</div>
            ${d.customer?.id_number ? `<div style="font-size:12px; color:#6b7280; margin-top:2px;">Cédula: ${d.customer.id_number}</div>` : ''}
            ${d.customer?.phone ? `<div style="font-size:12px; color:#6b7280; margin-top:2px;">Teléfono: ${d.customer.phone}</div>` : ''}
          </div>
          <div style="border-top:1px dashed #d1d5db; padding-top:14px; margin-top:14px;">
            <div class="section-title">Pagos</div>
            ${paymentsHTML}
          </div>
          <div>
            <div class="total-box"><span>Monto abonado</span><span>${formatMoney(d.amount)}</span></div>
            <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:13px;">
              <span>Abonado acumulado</span><strong>${formatMoney(d.paidTotal)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:13px;">
              <span>Pendiente</span><strong>${formatMoney(d.pending)}</strong>
            </div>
          </div>
          <div class="footer">⚠️ Si el apartado no se cancela en la fecha indicada, se pierde la reserva.</div>
        </div>
      </body>
    </html>
  `
}

export function printAbonoReceipt(data) {
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
  doc.write(getAbonoHTML(data))
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
