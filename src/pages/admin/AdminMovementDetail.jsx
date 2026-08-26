import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle, RotateCcw, Copy, XCircle, Printer, MessageCircle, FileText, X, Calendar, User, Phone, CreditCard, Banknote, Store, ShoppingBag } from 'lucide-react'
import { formatVariantLabel, getVariantImage } from '../../lib/sku'
import ReceiptView, { printReceipt } from '../../components/admin/ReceiptView'
import styles from './AdminMovementDetail.module.css'

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

const SALE_TYPE_LABELS = {
  retail: 'Venta al detal',
  wholesale: 'Venta al mayor',
}

const STATUS_COLORS = {
  pagado: 'success',
  vendido: 'success',
  activo: 'secondary',
  devuelto: 'danger',
  anulado: 'danger',
}

export default function AdminMovementDetail() {
  const { id } = useParams()
  const [movement, setMovement] = useState(null)
  const [items, setItems] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showReceipt, setShowReceipt] = useState(false)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    const [movRes, itemsRes, paymentsRes] = await Promise.all([
      supabase.from('movements').select('*, cash_sessions(opened_at, opening_amount), customer_coupons(*, reward_coupons(*))').eq('id', id).single(),
      supabase.from('movement_items').select('*, products(name, categories(*)), product_variants(*)').eq('movement_id', id),
      supabase.from('movement_payments').select('*').eq('movement_id', id)
    ])
    setMovement(movRes.data)
    setItems(itemsRes.data || [])
    setPayments(paymentsRes.data || [])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const markAsSold = async () => {
    if(!confirm('¿Marcar esta consignación como VENDIDA?')) return
    await supabase.from('movements').update({ status: 'vendido', updated_at: new Date().toISOString() }).eq('id', id)
    fetchDetail()
  }

  const markAsReturned = async () => {
    if(!confirm('¿Marcar esta consignación como DEVUELTA? El stock se sumará de nuevo al inventario.')) return

    await supabase.from('movements').update({ status: 'devuelto', updated_at: new Date().toISOString() }).eq('id', id)

    for (const item of items) {
      const variantId = item.variant_id
      if (!variantId) continue
      const { data: variantData } = await supabase.from('product_variants').select('stock').eq('id', variantId).single()
      if (variantData) {
        await supabase.from('product_variants').update({ stock: variantData.stock + item.quantity }).eq('id', variantId)
      }
    }
    fetchDetail()
  }

  const copyForWhatsApp = () => {
    const isVenta = movement.movement_type === 'venta'
    let text = `*Resumen de ${isVenta ? 'Venta' : 'Consignación'} - Elite Store*\n`
    text += `Recibo: #${movement.id.slice(0, 8)}\n`
    if (movement.customer_name) text += `Cliente: ${movement.customer_name}\n`
    if (movement.customer_phone) text += `Teléfono: ${movement.customer_phone}\n`
    text += `Fecha: ${new Date(movement.created_at).toLocaleDateString()}\n`
    text += `Estado: ${movement.status.toUpperCase()}\n\n`

    if (payments.length > 0) {
      text += `*Pagos:*\n`
      payments.forEach(p => {
        text += `- ${PAYMENT_METHODS[p.method] || p.method}: $${p.amount}\n`
      })
    } else {
      text += `Método: ${PAYMENT_METHODS[movement.payment_method] || movement.payment_method}\n`
    }
    text += `\n`

    text += `*Productos:*\n`
    items.forEach(item => {
      text += `- ${item.quantity}x ${item.products?.name} (${formatVariantLabel(item.product_variants, item.products?.categories?.size_label)}) - $${(item.quantity * item.unit_price).toFixed(2)}\n`
    })

    if (movement.discount_amount) {
      text += `\nDescuento: -$${movement.discount_amount}\n`
    }
    text += `\n*Total: $${movement.total_amount}*\n`
    if (movement.notes) text += `\nNotas: ${movement.notes}\n`
    text += `\n¡Gracias por preferirnos!`

    navigator.clipboard.writeText(text)
      .then(() => alert('¡Texto copiado al portapapeles!'))
      .catch(() => alert('Error al copiar el texto.'))
  }

  const cancelMovement = async () => {
    if(!confirm('¿Estás seguro de que deseas ANULAR este recibo? Los productos volverán al inventario y el estado cambiará a "anulado".')) return

    await supabase.from('movements').update({ status: 'anulado', updated_at: new Date().toISOString() }).eq('id', id)

    if (movement.status !== 'devuelto' && movement.status !== 'anulado') {
      for (const item of items) {
        const variantId = item.variant_id
        if (!variantId) continue
        const { data: variantData } = await supabase.from('product_variants').select('stock').eq('id', variantId).single()
        if (variantData) {
          await supabase.from('product_variants').update({ stock: variantData.stock + item.quantity }).eq('id', variantId)
        }
      }
    }

    fetchDetail()
  }

  if (loading) return <div className={styles.page}>Cargando...</div>
  if (!movement) return <div className={styles.page}>Movimiento no encontrado</div>

  const invoiceId = movement.id.slice(0, 8)
  const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  const change = Math.max(0, totalPaid - movement.total_amount)
  const status = movement.status
  const statusColor = STATUS_COLORS[status] || 'secondary'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link to="/admin/movements" className={styles.backBtn}><ArrowLeft size={20}/></Link>
        <div className={styles.headerText}>
          <h1>Recibo #{invoiceId}</h1>
          <p>{new Date(movement.created_at).toLocaleString()}</p>
        </div>
        <div className={styles.badges}>
          <span className={`badge ${movement.movement_type === 'venta' ? 'badge-primary' : 'badge-secondary'}`}>
            {movement.movement_type.toUpperCase()}
          </span>
          {movement.sale_type && (
            <span className={`badge ${movement.sale_type === 'wholesale' ? 'badge-success' : 'badge-info'}`}>
              {SALE_TYPE_LABELS[movement.sale_type] || movement.sale_type}
            </span>
          )}
          <span className={`badge badge-${statusColor}`}>
            {status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Columna izquierda: datos */}
        <div className={styles.leftCol}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}><User size={18} /> Cliente</h3>
            {movement.customer_name ? (
              <>
                <p className={styles.customerName}>{movement.customer_name}</p>
                {movement.customer_phone && (
                  <p className={styles.customerMeta}><Phone size={14} /> {movement.customer_phone}</p>
                )}
              </>
            ) : (
              <p className={styles.emptyText}>Cliente general</p>
            )}
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}><CreditCard size={18} /> Pagos</h3>
            {payments.length > 0 ? (
              <div className={styles.paymentsList}>
                {payments.map(p => (
                  <div key={p.id} className={styles.paymentItem}>
                    <div className={styles.paymentInfo}>
                      <strong>{PAYMENT_METHODS[p.method] || p.method}</strong>
                      {p.reference && <span className={styles.paymentRef}>Ref: {p.reference}</span>}
                    </div>
                    <span className={styles.paymentAmount}>${p.amount}</span>
                  </div>
                ))}
                <div className={styles.totalPaid}>
                  <span>Total pagado</span>
                  <strong>${totalPaid.toFixed(2)}</strong>
                </div>
                {change > 0 && (
                  <div className={styles.change}>
                    <span>Vuelto</span>
                    <strong>${change.toFixed(2)}</strong>
                  </div>
                )}
              </div>
            ) : (
              <p className={styles.emptyText}>
                {PAYMENT_METHODS[movement.payment_method] || movement.payment_method || 'Sin método definido'}
              </p>
            )}
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}><Banknote size={18} /> Totales</h3>
            <div className={styles.totalBreakdown}>
              <div className={styles.breakdownRow}>
                <span>Subtotal</span>
                <strong>${(parseFloat(movement.total_amount) + parseFloat(movement.discount_amount || 0)).toFixed(2)}</strong>
              </div>
              {(movement.discount_amount || 0) > 0 && (
                <div className={`${styles.breakdownRow} ${styles.discountRow}`}>
                  <span>Descuento</span>
                  <strong>-${parseFloat(movement.discount_amount).toFixed(2)}</strong>
                </div>
              )}
              {movement.customer_coupons && (
                <div className={styles.couponInfo}>
                  <span>Cupón:</span>
                  <strong>{movement.customer_coupons.reward_coupons?.name}</strong>
                </div>
              )}
            </div>
            <div className={styles.totalBox}>
              <span>Total del recibo</span>
              <strong>${movement.total_amount}</strong>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}><Store size={18} /> Turno</h3>
            {movement.cash_sessions ? (
              <p className={styles.sessionText}>
                <Calendar size={14} /> {new Date(movement.cash_sessions.opened_at).toLocaleString()}
              </p>
            ) : (
              <p className={styles.emptyText}>Sin turno asociado</p>
            )}
            {movement.notes && (
              <div className={styles.notes}>
                <strong>Notas:</strong> {movement.notes}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: productos */}
        <div className={styles.rightCol}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Productos</h3>
            <div className={styles.itemsList}>
              {items.map(item => (
                <div key={item.id} className={styles.productItem}>
                  <div className={styles.productInfo}>
                    <div className={styles.productItemThumb}>
                      {getVariantImage(item.products, item.product_variants) ? (
                        <img src={getVariantImage(item.products, item.product_variants)} alt={item.products?.name} />
                      ) : (
                        <ShoppingBag size={18} />
                      )}
                    </div>
                    <span className={styles.productQty}>{item.quantity}x</span>
                    <div>
                      <p className={styles.productName}>{item.products?.name}</p>
                      <p className={styles.productVariant}>{formatVariantLabel(item.product_variants, item.products?.categories?.size_label)}</p>
                    </div>
                  </div>
                  <div className={styles.productPrices}>
                    <span className={styles.productUnit}>${item.unit_price} c/u</span>
                    <strong className={styles.productSubtotal}>${(item.quantity * item.unit_price).toFixed(2)}</strong>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.itemsTotal}>
              <span>Total</span>
              <strong>${movement.total_amount}</strong>
            </div>
            {(movement.discount_amount || 0) > 0 && (
              <div className={styles.itemsDiscount}>
                <span>Descuento aplicado</span>
                <strong>-${parseFloat(movement.discount_amount).toFixed(2)}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className={styles.actionsBar}>
        <button className="btn btn-primary" onClick={() => setShowReceipt(true)}>
          <FileText size={16} /> Ver recibo
        </button>
        <button className="btn btn-outline" onClick={copyForWhatsApp}>
          <Copy size={16} /> Copiar para WhatsApp
        </button>
        {movement.movement_type === 'consignacion' && status === 'activo' && (
          <>
            <button className="btn btn-outline" onClick={markAsSold}>
              <CheckCircle size={16} /> Marcar como Vendido
            </button>
            <button className="btn btn-outline" onClick={markAsReturned} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
              <RotateCcw size={16} /> Marcar como Devuelto
            </button>
          </>
        )}
            {status !== 'anulado' && status !== 'devuelto' && (
              <button className="btn btn-outline" onClick={cancelMovement} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
                <XCircle size={16} /> Anular recibo
              </button>
            )}
          </div>

      {/* Modal de recibo */}
      <AnimatePresence>
        {showReceipt && (
          <motion.div className={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={styles.modal} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className={styles.modalHeader}>
                <h2>Recibo #{invoiceId}</h2>
                <button className={styles.closeBtn} onClick={() => setShowReceipt(false)}>
                  <X size={20} />
                </button>
              </div>
              <ReceiptView
                movement={movement}
                items={items}
                payments={payments}
                subtotal={parseFloat(movement.total_amount) + parseFloat(movement.discount_amount || 0)}
                discount={movement.discount_amount}
                appliedCoupon={movement.customer_coupons}
                total={movement.total_amount}
                createdAt={movement.created_at}
              />
              <div className={styles.modalActions}>
                <button
                  className="btn btn-primary"
                  onClick={() => printReceipt({
                    movement,
                    items,
                    payments,
                    subtotal: parseFloat(movement.total_amount) + parseFloat(movement.discount_amount || 0),
                    discount: movement.discount_amount,
                    appliedCoupon: movement.customer_coupons,
                    total: movement.total_amount,
                    createdAt: movement.created_at,
                  })}
                  style={{ flex: 1 }}
                >
                  <Printer size={16} /> Imprimir / Guardar PDF
                </button>
                <button className="btn btn-outline" onClick={copyForWhatsApp} style={{ flex: 1 }}>
                  <MessageCircle size={16} /> WhatsApp
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
