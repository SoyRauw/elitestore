import { ShoppingBag, Trash2, Minus, Plus, Ticket } from 'lucide-react'
import { formatVariantLabel, getVariantImage } from '../../lib/sku'
import POSPaymentPanel from './POSPaymentPanel'
import CouponSelector from './CouponSelector'
import styles from './POSCart.module.css'

export default function POSCart({
  items,
  subtotal,
  discount,
  total,
  customer,
  onCustomerChange,
  payments,
  onPaymentsChange,
  onUpdateQty,
  onRemove,
  onClear,
  onPay,
  disabled,
  error,
  totalPaid,
  difference,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  onRedeemCoupon,
  wholesaleMode = false,
  onToggleWholesale,
}) {
  const handleApplyCustomer = (coupon) => onApplyCoupon({ type: 'customer', coupon })
  const handleRedeemReward = (coupon) => onRedeemCoupon(coupon)
  const isComplete = totalPaid >= total && items.length > 0
  const isMissing = totalPaid < total && items.length > 0
  const customerDraft = customer || { id: '', id_number: '', name: '', phone: '' }

  const handleIdNumberChange = (value) => {
    onCustomerChange({ ...customerDraft, id_number: value })
  }

  return (
    <div className={styles.cart}>
      <div className={styles.header}>
        <h3 className={styles.title}><ShoppingBag size={18} /> Venta actual</h3>
        <button
          type="button"
          className={`${styles.modeBtn} ${wholesaleMode ? styles.modeWholesale : styles.modeRetail}`}
          onClick={onToggleWholesale}
        >
          {wholesaleMode ? 'Venta al mayor' : 'Venta al detal'}
        </button>
      </div>

      <div className={styles.body}>
        {/* Columna izquierda: Cliente + Pagos */}
        <div className={styles.leftCol}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Cliente</div>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Cédula / RIF</label>
                <input
                  className={styles.input}
                  value={customerDraft.id_number || ''}
                  onChange={(e) => handleIdNumberChange(e.target.value)}
                  placeholder="V-12345678"
                  disabled={disabled}
                />
              </div>
              <div className={styles.field}>
                <label>Teléfono</label>
                <input
                  className={styles.input}
                  value={customerDraft.phone || ''}
                  onChange={(e) => onCustomerChange({ ...customerDraft, phone: e.target.value })}
                  placeholder="0414-0000000"
                  disabled={disabled}
                />
              </div>
            </div>
            <div className={styles.field} style={{ marginTop: '0.5rem' }}>
              <label>Nombre</label>
              <input
                className={styles.input}
                value={customerDraft.name || ''}
                onChange={(e) => onCustomerChange({ ...customerDraft, name: e.target.value })}
                placeholder="Nombre del cliente"
                disabled={disabled}
              />
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Cupones</div>
            <CouponSelector
              customer={customer}
              subtotal={subtotal}
              appliedCoupon={appliedCoupon}
              onApplyCustomerCoupon={handleApplyCustomer}
              onRedeemRewardCoupon={handleRedeemReward}
              onRemoveCoupon={onRemoveCoupon}
              disabled={disabled}
            />
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Pagos</div>
            <POSPaymentPanel totalAmount={total} payments={payments} onChange={onPaymentsChange} />
          </div>
        </div>

        {/* Columna derecha: Productos agregados + Resumen */}
        <div className={styles.rightCol}>
          <div className={`${styles.section} ${styles.itemsSection}`}>
            <div className={styles.sectionTitle}>Productos agregados</div>
            <div className={styles.itemsList}>
              {items.length === 0 ? (
                <div className={styles.emptySmall}>
                  <ShoppingBag size={28} />
                  <p>El carrito está vacío</p>
                </div>
              ) : (
                items.map((item, index) => (
                  <div key={item.variant.id} className={styles.item}>
                    <div className={styles.itemThumb}>
                      {getVariantImage(item.product, item.variant) ? (
                        <img src={getVariantImage(item.product, item.variant)} alt={item.product.name} />
                      ) : (
                        <ShoppingBag size={18} />
                      )}
                    </div>
                    <div className={styles.itemInfo}>
                      <p className={styles.itemName}>{item.product.name}</p>
                      <p className={styles.itemVariant}>{formatVariantLabel(item.variant, item.product?.categories?.size_label)}</p>
                      <p className={styles.itemPrice}>${item.price.toFixed(2)} c/u</p>
                      <div className={styles.qtyRow}>
                        <button
                          className={styles.qtyBtn}
                          onClick={() => onUpdateQty(index, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={12} />
                        </button>
                        <span className={styles.qtyValue}>{item.quantity}</span>
                        <button
                          className={styles.qtyBtn}
                          onClick={() => onUpdateQty(index, item.quantity + 1)}
                          disabled={item.quantity >= item.variant.stock}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <button className={styles.removeBtn} onClick={() => onRemove(index)} aria-label="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={`${styles.section} ${styles.summarySection}`}>
            <div className={styles.sectionTitle}>Resumen</div>
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <strong>${subtotal.toFixed(2)}</strong>
            </div>
            {discount > 0 && (
              <div className={`${styles.summaryRow} ${styles.discountRow}`}>
                <span><Ticket size={12} /> Descuento</span>
                <strong>-${discount.toFixed(2)}</strong>
              </div>
            )}
            <div className={styles.totalBox}>
              <span className={styles.totalLabel}>Total a pagar</span>
              <strong className={styles.totalValue}>${total.toFixed(2)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Total pagado</span>
              <strong>${totalPaid.toFixed(2)}</strong>
            </div>
            {difference > 0 && (
              <div className={styles.summaryHighlight} style={{ background: '#dcfce7', color: '#166534' }}>
                <span>Vuelto</span>
                <strong>${difference.toFixed(2)}</strong>
              </div>
            )}
            {isMissing && (
              <div className={styles.summaryHighlight} style={{ background: '#fee2e2', color: '#991b1b' }}>
                <span>Faltante</span>
                <strong>${(total - totalPaid).toFixed(2)}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actionsRow}>
          <button
            className={`btn btn-primary ${styles.payBtn}`}
            onClick={onPay}
            disabled={disabled || !isComplete}
          >
            {disabled ? 'Procesando...' : isComplete ? 'Finalizar venta' : `Faltan $${Math.max(0, total - totalPaid).toFixed(2)}`}
          </button>

          {items.length > 0 && (
            <button className={styles.clearBtn} onClick={onClear}>
              Vaciar carrito
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
