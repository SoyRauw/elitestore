import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useCashSession } from '../../hooks/useCashSession'
import { formatWhatsAppReceipt } from '../../lib/whatsapp'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import POSProductSearch from '../../components/admin/POSProductSearch'
import POSCart from '../../components/admin/POSCart'
import ReceiptView, { printReceipt } from '../../components/admin/ReceiptView'
import { formatVariantLabel } from '../../lib/sku'
import { Lock, CheckCircle, Printer, MessageCircle, X, LockOpen } from 'lucide-react'
import styles from './AdminPOS.module.css'

const PAYMENT_METHODS = {
  efectivo: 'Efectivo',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  zinli: 'Zinli',
  binance: 'Binance',
  transferencia: 'Transferencia',
  punto: 'Punto de Venta',
}

function calculateItemPrice(product, variant, isWholesale) {
  if (isWholesale) {
    return variant.wholesale_price || product.wholesale_price || variant.price || product.price || 0
  }
  return variant.price || product.price || 0
}

export default function AdminPOS() {
  const { user } = useAuth()
  const { session, loading: sessionLoading } = useCashSession(user?.id)

  const [items, setItems] = useState([])
  const [wholesaleMode, setWholesaleMode] = useState(false)
  const [customer, setCustomer] = useState({ id: '', id_number: '', name: '', phone: '', points: 0 })
  const [payments, setPayments] = useState([])
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [completedSale, setCompletedSale] = useState(null)
  const [confirmPayOpen, setConfirmPayOpen] = useState(false)
  const [barcodeBuffer, setBarcodeBuffer] = useState('')
  const barcodeInputRef = useRef(null)
  const lastScanRef = useRef({ code: '', time: 0 })

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [items])

  const getCouponFromApplied = useCallback(() => {
    if (!appliedCoupon) return null
    if (appliedCoupon.type === 'reward') return appliedCoupon.coupon
    if (appliedCoupon.type === 'customer') return appliedCoupon.coupon?.reward_coupons
    return null
  }, [appliedCoupon])

  const discount = useMemo(() => {
    if (!appliedCoupon || items.length === 0) return 0
    const coupon = getCouponFromApplied()
    if (!coupon) return 0
    if (coupon.discount_type === 'percentage') {
      const base = coupon.applies_to === 'product' && coupon.product_id
        ? items
            .filter((i) => i.product.id === coupon.product_id)
            .reduce((sum, i) => sum + i.price * i.quantity, 0)
        : subtotal
      return Math.min(base * (coupon.discount_value / 100), base)
    }
    const base = coupon.applies_to === 'product' && coupon.product_id
      ? items
          .filter((i) => i.product.id === coupon.product_id)
          .reduce((sum, i) => sum + i.price * i.quantity, 0)
      : subtotal
    return Math.min(coupon.discount_value, base)
  }, [appliedCoupon, getCouponFromApplied, items, subtotal])

  const total = subtotal - discount

  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
  }, [payments])

  const difference = totalPaid - total

  useEffect(() => {
    const id = customer.id_number?.trim()
    if (!id || id.length < 3) return

    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .ilike('id_number', id)
        .limit(2)

      if (data && data.length === 1) {
        setCustomer(prev => ({
          ...prev,
          id: data[0].id,
          name: data[0].name || '',
          phone: data[0].phone || '',
          points: data[0].points || 0,
        }))
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [customer.id_number])

  useEffect(() => {
    if (!appliedCoupon) return
    const coupon = getCouponFromApplied()
    if (!coupon) return
    const min = parseFloat(coupon.min_purchase_amount) || 0
    if (subtotal < min) {
      setAppliedCoupon(null)
      setError(`El cupón requiere compra mínima de $${min.toFixed(2)}. Se quitó del carrito.`)
    }
  }, [subtotal, appliedCoupon, getCouponFromApplied])

  const addItem = useCallback((product, variant) => {
    if (wholesaleMode && !(variant.wholesale_price || product.wholesale_price)) {
      setError(`El producto ${product.name} no tiene precio al mayor`)
      return
    }
    setError('')
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (i) => i.product.id === product.id && i.variant.id === variant.id
      )

      if (existingIndex >= 0) {
        const item = prev[existingIndex]
        if (item.quantity >= variant.stock) return prev
        return prev.map((i, idx) =>
          idx === existingIndex
            ? { ...i, quantity: i.quantity + 1, price: calculateItemPrice(i.product, i.variant, wholesaleMode) }
            : i
        )
      }

      return [...prev, { product, variant, quantity: 1, price: calculateItemPrice(product, variant, wholesaleMode) }]
    })
  }, [wholesaleMode])

  const updateQuantity = useCallback((index, quantity) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((_, i) => i !== index)
      }
      const item = prev[index]
      if (quantity > item.variant.stock) return prev
      return prev.map((i, idx) =>
        idx === index
          ? { ...i, quantity, price: calculateItemPrice(i.product, i.variant, wholesaleMode) }
          : i
      )
    })
  }, [wholesaleMode])

  const removeItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setCustomer({ id: '', id_number: '', name: '', phone: '', points: 0 })
    setPayments([])
    setAppliedCoupon(null)
    setError('')
  }, [])

  const toggleWholesaleMode = useCallback(() => {
    if (items.length > 0) {
      clearCart()
    }
    setWholesaleMode((prev) => !prev)
    setError('')
  }, [items.length, clearCart])

  const applyCoupon = useCallback((coupon) => {
    setAppliedCoupon(coupon)
  }, [])

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null)
  }, [])

  const redeemCoupon = useCallback(async (coupon) => {
    if (!customer?.id) throw new Error('Selecciona un cliente')
    if ((customer.points || 0) < coupon.points_cost) throw new Error('Puntos insuficientes')
    const min = parseFloat(coupon.min_purchase_amount) || 0
    if (subtotal < min) throw new Error(`Requiere compra mínima de $${min.toFixed(2)}`)

    setAppliedCoupon({ type: 'reward', coupon })
  }, [customer, subtotal])

  const handleBarcodeScan = async (code) => {
    if (!code || !session) return
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9\-.]/g, '')
    if (!cleanCode) return

    const now = Date.now()
    const last = lastScanRef.current
    if (cleanCode === last.code && now - last.time < 500) return
    lastScanRef.current = { code: cleanCode, time: now }

    setError('')

    try {
      let matching = []

      // 1. Si parece UUID, buscar por id de variante
      const isUUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(cleanCode)
      if (isUUID) {
        const { data: byId, error: idError } = await supabase
          .from('product_variants')
          .select('*, products(*, categories(*))')
          .eq('id', cleanCode)
          .limit(1)
        if (idError) throw idError
        if (byId?.[0]) matching.push(byId[0])
      }

      // 2. Buscar por barcode o sku
      if (matching.length === 0) {
        const { data: variants, error: variantError } = await supabase
          .from('product_variants')
          .select('*, products(*, categories(*))')
          .or(`barcode.eq.${cleanCode},sku.eq.${cleanCode}`)
          .limit(10)

        if (variantError) throw variantError

        matching = (variants || []).filter(v =>
          v.barcode?.toUpperCase().replace(/[^A-Z0-9\-.]/g, '') === cleanCode ||
          v.sku?.toUpperCase().replace(/[^A-Z0-9\-.]/g, '') === cleanCode
        )
      }

      // 3. Si no hay coincidencia, buscar por id de producto padre
      if (matching.length === 0) {
        const { data: products, error: productError } = await supabase
          .from('products')
          .select('*, categories(*), product_variants(*)')
          .eq('id', cleanCode)
          .eq('active', true)
          .limit(1)

        if (productError) throw productError

        if (products && products.length > 0) {
          const product = products[0]
          const variant = (product.product_variants || []).find(v => v.stock > 0)
          if (variant) {
            addItem(product, variant)
            return
          } else {
            setError(`Sin stock para: ${product.name}`)
            return
          }
        }
      }

      if (matching.length === 0) {
        setError(`No se encontró producto con código: ${cleanCode}`)
        return
      }

      if (matching.length > 1) {
        setError(`Múltiples variantes encontradas para: ${cleanCode}. Selecciona manualmente.`)
        return
      }

      const variant = matching[0]
      const product = variant.products
      if (variant.stock <= 0) {
        setError(`Sin stock para: ${product.name} ${formatVariantLabel(variant, product.categories?.size_label)}`)
        return
      }

      addItem(product, variant)
    } catch (e) {
      console.error('Error escaneando:', e)
      setError('Error al buscar producto escaneado')
    }
  }

  useEffect(() => {
    if (barcodeInputRef.current && session) {
      barcodeInputRef.current.focus()
    }
  }, [session])

  const handlePay = () => {
    if (!session) {
      setError('No hay caja abierta. Abre una caja primero.')
      return
    }
    if (items.length === 0) {
      setError('Agrega al menos un producto al carrito')
      return
    }
    if (totalPaid < total) {
      setError(`Faltan $${(total - totalPaid).toFixed(2)} para completar el pago`)
      return
    }
    setError('')
    setConfirmPayOpen(true)
  }

  const executePay = async () => {
    setSubmitting(true)
    setError('')

    try {
      let customerId = customer?.id || null
      let customerName = customer?.name?.trim() || null
      let customerPhone = customer?.phone?.trim() || null

      if (customerName || customer?.id_number?.trim()) {
        const idNumber = customer?.id_number?.trim() || null
        if (idNumber && !customerId) {
          const { data: existing } = await supabase
            .from('customers')
            .select('id')
            .ilike('id_number', idNumber)
            .single()
          if (existing?.id) customerId = existing.id
        }

        if (!customerId) {
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert([{
              name: customerName || 'Cliente',
              id_number: idNumber,
              phone: customerPhone,
            }])
            .select()
            .single()
          if (customerError) throw customerError
          customerId = newCustomer.id
        }
      }

      const notes = payments
        .filter((p) => p.reference)
        .map((p) => `${PAYMENT_METHODS[p.method]}: ${p.reference}`)
        .join(' | ')

      const earned = Math.floor(total)

      let customerCouponId = null

      if (appliedCoupon) {
        if (appliedCoupon.type === 'reward') {
          const reward = appliedCoupon.coupon
          if (!customerId) throw new Error('Se requiere un cliente para canjear puntos')

          const { data: current } = await supabase
            .from('customers')
            .select('points')
            .eq('id', customerId)
            .single()
          if ((current?.points || 0) < reward.points_cost) throw new Error('Puntos insuficientes')

          const code = `EL-${Date.now().toString(36).toUpperCase()}`
          const { data: customerCoupon, error: ccError } = await supabase
            .from('customer_coupons')
            .insert([{
              customer_id: customerId,
              reward_coupon_id: reward.id,
              code,
              status: 'used',
              used_at: new Date().toISOString(),
            }])
            .select()
            .single()
          if (ccError) throw ccError

          customerCouponId = customerCoupon.id

          const newPoints = (current?.points || 0) - reward.points_cost
          const { error: pointsError } = await supabase
            .from('customers')
            .update({ points: newPoints })
            .eq('id', customerId)
          if (pointsError) throw pointsError

          const { error: historyError } = await supabase
            .from('customer_points_history')
            .insert([{
              customer_id: customerId,
              movement_id: null,
              change: -reward.points_cost,
              reason: `Canje de cupón: ${reward.name}`,
            }])
          if (historyError) throw historyError

          setCustomer(prev => ({ ...prev, points: newPoints }))
        } else if (appliedCoupon.type === 'customer') {
          const coupon = appliedCoupon.coupon
          const { error: usedError } = await supabase
            .from('customer_coupons')
            .update({ status: 'used', used_at: new Date().toISOString() })
            .eq('id', coupon.id)
          if (usedError) throw usedError
          customerCouponId = coupon.id
        }
      }

      const { data: movement, error: movError } = await supabase
        .from('movements')
        .insert([{
          movement_type: 'venta',
          status: 'pagado',
          user_id: user.id,
          cash_session_id: session.id,
          customer_id: customerId,
          customer_name: customerName,
          customer_phone: customerPhone,
          payment_method: payments.length === 1 ? payments[0].method : 'multiple',
          total_amount: total,
          discount_amount: discount,
          customer_coupon_id: customerCouponId,
          points_earned: earned,
          notes: notes || null,
        }])
        .select()
        .single()

      if (movError) throw movError

      const movementItems = items.map((item) => ({
        movement_id: movement.id,
        product_id: item.product.id,
        variant_id: item.variant.id,
        size: item.variant.size || '',
        quantity: item.quantity,
        unit_price: item.price,
      }))

      const { error: itemsError } = await supabase
        .from('movement_items')
        .insert(movementItems)

      if (itemsError) throw itemsError

      const movementPayments = payments
        .filter((p) => parseFloat(p.amount) > 0)
        .map((p) => ({
          movement_id: movement.id,
          method: p.method,
          amount: parseFloat(p.amount),
          reference: p.reference?.trim() || null,
        }))

      if (movementPayments.length > 0) {
        const { error: paymentsError } = await supabase
          .from('movement_payments')
          .insert(movementPayments)
        if (paymentsError) throw paymentsError
      }

      for (const item of items) {
        const newStock = Math.max(0, item.variant.stock - item.quantity)
        const { error: stockError } = await supabase
          .from('product_variants')
          .update({ stock: newStock })
          .eq('id', item.variant.id)
        if (stockError) throw stockError
      }

      if (customerId && earned > 0) {
        const { data: current } = await supabase
          .from('customers')
          .select('points')
          .eq('id', customerId)
          .single()
        const newPoints = (current?.points || 0) + earned
        const { error: pointsUpdateError } = await supabase
          .from('customers')
          .update({ points: newPoints })
          .eq('id', customerId)
        if (pointsUpdateError) throw pointsUpdateError

        const { error: historyError } = await supabase
          .from('customer_points_history')
          .insert([{
            customer_id: customerId,
            movement_id: movement.id,
            change: earned,
            reason: 'Puntos ganados por compra',
          }])
        if (historyError) throw historyError
      }

      setCompletedSale({
        movement,
        items,
        subtotal,
        discount,
        total,
        payments,
        customer,
        appliedCoupon,
        createdAt: new Date().toISOString(),
      })
      clearCart()
    } catch (e) {
      console.error('Error en venta:', e)
      setError(e.message || 'Error al procesar la venta')
    } finally {
      setSubmitting(false)
      setConfirmPayOpen(false)
    }
  }

  const sendWhatsApp = () => {
    if (!completedSale) return
    const message = formatWhatsAppReceipt(completedSale.items, completedSale.total, completedSale.movement.id)
    const encoded = encodeURIComponent(message)
    window.open(`https://wa.me/${completedSale.customer?.phone || '584246594559'}?text=${encoded}`, '_blank')
  }

  if (sessionLoading) {
    return (
      <AdminLayout>
        <div className={styles.page}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p>Cargando caja...</p>
          </div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <h1 className={styles.pageTitle}>Punto de Venta</h1>
          <div className={`${styles.sessionBadge} ${session ? styles.sessionOpen : styles.sessionClosed}`}>
            {session ? <><LockOpen size={14} /> Caja abierta</> : <><Lock size={14} /> Caja cerrada</>}
          </div>
        </div>

        {!session ? (
          <div className={styles.noSession}>
            <Lock size={64} className={styles.noSessionIcon} />
            <h2 className={styles.noSessionTitle}>No hay caja abierta</h2>
            <p>Ve a Caja y abre un turno para poder vender.</p>
          </div>
        ) : (
          <>
          <div className={styles.barcodeRow}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const code = barcodeBuffer.trim()
                setBarcodeBuffer('')
                if (code) handleBarcodeScan(code)
              }}
              style={{ width: '100%', margin: 0 }}
            >
              <input
                ref={barcodeInputRef}
                type="text"
                className={styles.barcodeInput}
                value={barcodeBuffer}
                onChange={(e) => setBarcodeBuffer(e.target.value)}
                placeholder="Escanea el código de barras..."
                disabled={submitting}
              />
            </form>
          </div>

          <div className={styles.layout}>
            <div className={styles.leftPanel}>
              <POSProductSearch onAdd={addItem} wholesaleMode={wholesaleMode} />
            </div>
            <div className={styles.rightPanel}>
              <POSCart
                items={items}
                subtotal={subtotal}
                discount={discount}
                total={total}
                customer={customer}
                onCustomerChange={setCustomer}
                payments={payments}
                onPaymentsChange={setPayments}
                onUpdateQty={updateQuantity}
                onRemove={removeItem}
                onClear={clearCart}
                onPay={handlePay}
                disabled={submitting}
                error={error}
                totalPaid={totalPaid}
                difference={difference}
                appliedCoupon={appliedCoupon}
                onApplyCoupon={applyCoupon}
                onRemoveCoupon={removeCoupon}
                onRedeemCoupon={redeemCoupon}
                wholesaleMode={wholesaleMode}
                onToggleWholesale={toggleWholesaleMode}
              />
            </div>
          </div>
          </>
        )}

        <AnimatePresence>
          {completedSale && (
            <motion.div
              className={styles.modalOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={styles.modal}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 className={styles.modalTitle}>
                    <CheckCircle size={22} color="#16a34a" /> Venta completada
                  </h2>
                  <button className="btn btn-ghost" onClick={() => setCompletedSale(null)}>
                    <X size={20} />
                  </button>
                </div>

                <ReceiptView
                  movement={completedSale.movement}
                  items={completedSale.items}
                  payments={completedSale.payments.filter((p) => parseFloat(p.amount) > 0)}
                  customer={completedSale.customer}
                  subtotal={completedSale.subtotal}
                  discount={completedSale.discount}
                  appliedCoupon={completedSale.appliedCoupon}
                  total={completedSale.total}
                  createdAt={completedSale.createdAt}
                />

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => printReceipt({
                      movement: completedSale.movement,
                      items: completedSale.items,
                      payments: completedSale.payments.filter((p) => parseFloat(p.amount) > 0),
                      customer: completedSale.customer,
                      subtotal: completedSale.subtotal,
                      discount: completedSale.discount,
                      appliedCoupon: completedSale.appliedCoupon,
                      total: completedSale.total,
                      createdAt: completedSale.createdAt,
                    })}
                    style={{ flex: 1 }}
                  >
                    <Printer size={16} /> Imprimir / Guardar PDF
                  </button>
                  <button className="btn btn-outline" onClick={sendWhatsApp} style={{ flex: 1 }}>
                    <MessageCircle size={16} /> Enviar WhatsApp
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <ConfirmModal
          isOpen={confirmPayOpen}
          title="¿Completar venta?"
          onCancel={() => setConfirmPayOpen(false)}
          onConfirm={executePay}
          confirmText="Confirmar venta"
          disabled={submitting}
        >
          <ul className={styles.summaryList}>
            <li><span className={styles.summaryLabel}>Productos</span><span className={styles.summaryValue}>{items.reduce((s, i) => s + i.quantity, 0)} uds</span></li>
            <li><span className={styles.summaryLabel}>Subtotal</span><span className={styles.summaryValue}>${subtotal.toFixed(2)}</span></li>
            {discount > 0 && <li><span className={styles.summaryLabel}>Descuento</span><span className={styles.summaryValue}>-${discount.toFixed(2)}</span></li>}
            <li><span className={styles.summaryLabel}>Total</span><span className={styles.summaryValue}>${total.toFixed(2)}</span></li>
            <li><span className={styles.summaryLabel}>Recibido</span><span className={styles.summaryValue}>${totalPaid.toFixed(2)}</span></li>
            <li><span className={styles.summaryLabel}>Cambio</span><span className={styles.summaryValue}>${Math.max(0, difference).toFixed(2)}</span></li>
          </ul>
        </ConfirmModal>
      </div>
    </AdminLayout>
  )
}
