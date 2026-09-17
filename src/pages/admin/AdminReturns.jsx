import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import ReturnInvoicePicker from '../../components/admin/ReturnInvoicePicker'
import ReturnReceiptView, { printReturnReceipt } from '../../components/admin/ReturnReceiptView'
import { formatVariantLabel } from '../../lib/sku'
import { revertReturnMovement } from '../../lib/returns'
import { Search, RotateCcw, X, CheckCircle, Printer, Plus, Minus, Trash2, Calendar, History, Wallet, Package, Undo2, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './AdminReturns.module.css'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function formatMoney(value) {
  return `$${(parseFloat(value) || 0).toFixed(2)}`
}

function buildCartKey(itemId, invoiceId) {
  return `${invoiceId}-${itemId}`
}

export default function AdminReturns() {
  const { user } = useAuth()

  const [idNumber, setIdNumber] = useState('')
  const [customer, setCustomer] = useState(null)
  const [loadingCustomer, setLoadingCustomer] = useState(false)
  const [customerError, setCustomerError] = useState('')

  const [sku, setSku] = useState('')
  const skuInputRef = useRef(null)

  const [recentInvoices, setRecentInvoices] = useState([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  const [cart, setCart] = useState([])
  const [pickerOptions, setPickerOptions] = useState(null)

  const [returnHistory, setReturnHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [completedReturn, setCompletedReturn] = useState(null)
  const [returnToRevert, setReturnToRevert] = useState(null)
  const [revertConfirmOpen, setRevertConfirmOpen] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [revertError, setRevertError] = useState('')

  const focusSku = useCallback(() => {
    if (skuInputRef.current) skuInputRef.current.focus()
  }, [])

  const fetchReturnHistory = useCallback(async () => {
    setLoadingHistory(true)
    const { data, error } = await supabase
      .from('movements')
      .select('*, movement_items(*, product_variants(*, products(*)))')
      .eq('movement_type', 'devolucion')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) console.error('Error cargando devoluciones:', error)
    setReturnHistory(data || [])
    setLoadingHistory(false)
  }, [])

  useEffect(() => {
    if (showHistory) fetchReturnHistory()
  }, [showHistory, fetchReturnHistory])

  const loadRecentInvoices = useCallback(async (customerId) => {
    setLoadingInvoices(true)
    const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
    const { data, error } = await supabase
      .from('movements')
      .select(`
        id, created_at, customer_id, customer_name, total_amount,
        movement_items(*, product_variants(id, sku, barcode, stock, size, color, variant_name, price, products(id, name, categories(size_label))))
      `)
      .eq('customer_id', customerId)
      .eq('movement_type', 'venta')
      .eq('status', 'pagado')
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (error) console.error('Error cargando facturas:', error)
    setRecentInvoices(data || [])
    setLoadingInvoices(false)
  }, [])

  const searchCustomer = async (e) => {
    e?.preventDefault()
    const clean = idNumber.trim()
    if (!clean) return
    setLoadingCustomer(true)
    setCustomerError('')
    setCustomer(null)
    setCart([])
    setRecentInvoices([])

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .ilike('id_number', clean)
      .limit(2)

    setLoadingCustomer(false)

    if (error) {
      setCustomerError('Error buscando cliente')
      return
    }
    if (!data || data.length === 0) {
      setCustomerError('No se encontró cliente con esa cédula')
      return
    }
    if (data.length > 1) {
      setCustomerError('Hay varios clientes con cédula similar. Sé más específico.')
      return
    }
    setCustomer(data[0])
    loadRecentInvoices(data[0].id)
    setTimeout(focusSku, 50)
  }

  const findReturnableOptions = useCallback((cleanSku) => {
    const options = []
    for (const invoice of recentInvoices) {
      for (const item of invoice.movement_items || []) {
        const variant = item.product_variants
        const matches = variant?.sku?.toUpperCase() === cleanSku || variant?.barcode?.toUpperCase() === cleanSku
        const remaining = item.quantity - (item.returned_quantity || 0)
        if (matches && remaining > 0) {
          options.push({ invoice, item, remaining })
        }
      }
    }
    return options.sort((a, b) => new Date(b.invoice.created_at) - new Date(a.invoice.created_at))
  }, [recentInvoices])

  const addToCart = useCallback((option, qty = 1) => {
    const { invoice, item, remaining } = option
    const key = buildCartKey(item.id, invoice.id)

    setCart((prev) => {
      const existing = prev.find((c) => c.key === key)
      if (existing) {
        return prev.map((c) =>
          c.key === key
            ? { ...c, returnQty: Math.min(c.maxReturn, c.returnQty + qty) }
            : c
        )
      }
      return [...prev, {
        key,
        invoice,
        item,
        variant: item.product_variants,
        product: item.product_variants?.products,
        unitPrice: item.unit_price,
        maxReturn: remaining,
        returnQty: Math.min(remaining, qty),
      }]
    })
    setSku('')
    setTimeout(focusSku, 50)
  }, [focusSku])

  const handleSkuSubmit = (e) => {
    e?.preventDefault()
    const clean = sku.trim().toUpperCase()
    if (!clean || !customer) return

    const options = findReturnableOptions(clean)
    if (options.length === 0) {
      setSubmitError('No se encontró ese producto disponible para devolver en las facturas recientes')
      return
    }
    if (options.length === 1) {
      addToCart(options[0], 1)
      return
    }
    setPickerOptions(options)
  }

  const handlePickInvoice = (option) => {
    addToCart(option, 1)
    setPickerOptions(null)
  }

  const updateQty = (key, delta) => {
    setCart((prev) =>
      prev.map((c) =>
        c.key === key
          ? { ...c, returnQty: Math.max(0, Math.min(c.maxReturn, c.returnQty + delta)) }
          : c
      ).filter((c) => c.returnQty > 0)
    )
  }

  const setQty = (key, value) => {
    const qty = parseInt(value, 10) || 0
    setCart((prev) =>
      prev.map((c) =>
        c.key === key
          ? { ...c, returnQty: Math.max(0, Math.min(c.maxReturn, qty)) }
          : c
      ).filter((c) => c.returnQty > 0)
    )
  }

  const removeFromCart = (key) => {
    setCart((prev) => prev.filter((c) => c.key !== key))
  }

  const addInvoiceItems = (invoice) => {
    const newItems = (invoice.movement_items || [])
      .filter((it) => it.quantity - (it.returned_quantity || 0) > 0)
      .map((it) => ({
        key: buildCartKey(it.id, invoice.id),
        invoice,
        item: it,
        variant: it.product_variants,
        product: it.product_variants?.products,
        unitPrice: it.unit_price,
        maxReturn: it.quantity - (it.returned_quantity || 0),
        returnQty: 0,
      }))

    setCart((prev) => {
      const existingKeys = new Set(prev.map((c) => c.key))
      const merged = [...prev]
      for (const newItem of newItems) {
        if (!existingKeys.has(newItem.key)) merged.push(newItem)
      }
      return merged
    })
  }

  const totalCredit = useMemo(
    () => cart.reduce((sum, c) => sum + c.unitPrice * c.returnQty, 0),
    [cart]
  )

  const handleConfirm = () => {
    if (cart.length === 0) {
      setSubmitError('Agrega al menos un producto al carrito de devolución')
      return
    }
    const invalid = cart.some((c) => c.returnQty <= 0 || c.returnQty > c.maxReturn)
    if (invalid) {
      setSubmitError('Revisa las cantidades a devolver')
      return
    }
    setSubmitError('')
    setConfirmOpen(true)
  }

  const executeReturn = async () => {
    setSubmitting(true)
    setSubmitError('')

    try {
      let creditTotal = 0
      const returnItems = []

      for (const cartItem of cart) {
        const { item, variant, returnQty, unitPrice } = cartItem
        const credit = unitPrice * returnQty
        creditTotal += credit

        const newStock = (variant.stock || 0) + returnQty
        const { error: stockError } = await supabase
          .from('product_variants')
          .update({ stock: newStock })
          .eq('id', variant.id)
        if (stockError) throw stockError

        const { error: lineError } = await supabase
          .from('movement_items')
          .update({ returned_quantity: (item.returned_quantity || 0) + returnQty })
          .eq('id', item.id)
        if (lineError) throw lineError

        returnItems.push({
          ...cartItem,
          credit,
          unit_price: unitPrice,
        })
      }

      // Associate the return with the user's open cash session (if any)
      const { data: openSession } = await supabase
        .from('cash_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .limit(1)
        .maybeSingle()

      const { data: movement, error: movError } = await supabase
        .from('movements')
        .insert([{
          movement_type: 'devolucion',
          status: 'completada',
          user_id: user.id,
          cash_session_id: openSession?.id || null,
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          payment_method: 'credito',
          total_amount: creditTotal,
          discount_amount: 0,
          credit_amount: 0,
          reference_movement_id: cart[0]?.invoice?.id || null,
        }])
        .select()
        .single()
      if (movError) throw movError

      const returnMovementItems = returnItems.map((c) => ({
        movement_id: movement.id,
        product_id: c.item.product_id,
        variant_id: c.item.variant_id,
        size: c.item.size || '',
        quantity: c.returnQty,
        unit_price: c.unitPrice,
        discount_amount: 0,
        original_item_id: c.item.id,
      }))
      const { error: itemsError } = await supabase
        .from('movement_items')
        .insert(returnMovementItems)
      if (itemsError) throw itemsError

      const newBalance = (customer.balance || 0) + creditTotal
      const { error: balanceError } = await supabase
        .from('customers')
        .update({ balance: newBalance })
        .eq('id', customer.id)
      if (balanceError) throw balanceError

      const { error: historyError } = await supabase
        .from('customer_credit_history')
        .insert([{
          customer_id: customer.id,
          movement_id: movement.id,
          amount: creditTotal,
          reason: 'Crédito por devolución',
        }])
      if (historyError) throw historyError

      // Deduct points for the returned amount (allows negative)
      const pointsDeducted = Math.floor(creditTotal)
      if (pointsDeducted !== 0) {
        const { data: currentCustomer } = await supabase
          .from('customers')
          .select('points')
          .eq('id', customer.id)
          .single()
        const newPoints = (currentCustomer?.points || 0) - pointsDeducted
        const { error: pointsError } = await supabase
          .from('customers')
          .update({ points: newPoints })
          .eq('id', customer.id)
        if (pointsError) throw pointsError

        const { error: pointsHistoryError } = await supabase
          .from('customer_points_history')
          .insert([{
            customer_id: customer.id,
            movement_id: movement.id,
            change: -pointsDeducted,
            reason: 'Devolución',
          }])
        if (pointsHistoryError) throw pointsHistoryError
      }

      setCompletedReturn({
        movement,
        items: returnItems,
        totalCredit,
        newBalance,
        customer,
        createdAt: new Date().toISOString(),
      })

      // Reset for next return
      setIdNumber('')
      setCustomer(null)
      setCart([])
      setRecentInvoices([])
      if (showHistory) fetchReturnHistory()
    } catch (e) {
      console.error(e)
      setSubmitError(e.message || 'Error procesando la devolución')
    } finally {
      setSubmitting(false)
      setConfirmOpen(false)
    }
  }

  const clearAll = () => {
    setIdNumber('')
    setCustomer(null)
    setCart([])
    setRecentInvoices([])
    setCustomerError('')
    setSubmitError('')
  }

  const handleRevertConfirm = (returnMovement) => {
    setReturnToRevert(returnMovement)
    setRevertConfirmOpen(true)
  }

  const executeRevert = async () => {
    setReverting(true)
    try {
      await revertReturnMovement(returnToRevert)
      setReturnToRevert(null)
      fetchReturnHistory()
    } catch (e) {
      console.error(e)
      setRevertError(e.message || 'Error revirtiendo la devolución')
    } finally {
      setReverting(false)
      setRevertConfirmOpen(false)
    }
  }

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}><RotateCcw size={22} /> Devoluciones</h1>
            <p className={styles.pageSubtitle}>Escanea la cédula y los productos como en el POS</p>
          </div>
          <button
            className={`btn btn-outline ${styles.historyBtn}`}
            onClick={() => setShowHistory((s) => !s)}
          >
            <History size={16} /> {showHistory ? 'Ocultar historial' : 'Historial'}
          </button>
        </div>

        <div className={styles.layout}>
          {/* Left panel: search + recent invoices */}
          <div className={styles.leftPanel}>
            <div className={styles.card}>
              <form onSubmit={searchCustomer} className={styles.formRow}>
                <div className={styles.field}>
                  <label>Cédula / RIF del cliente</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="V-12345678"
                    disabled={loadingCustomer || submitting}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loadingCustomer || !idNumber.trim()}>
                  {loadingCustomer ? '...' : <Search size={16} />}
                </button>
              </form>

              {customerError && <p className={styles.error}>{customerError}</p>}

              {customer && (
                <div className={styles.customerBox}>
                  <div>
                    <strong>{customer.name}</strong>
                    <span className={styles.customerMeta}>{customer.id_number}</span>
                  </div>
                  <span className={styles.balanceBadge}>
                    <Wallet size={14} /> {formatMoney(customer.balance)}
                  </span>
                </div>
              )}

              {customer && (
                <form onSubmit={handleSkuSubmit} className={styles.formRow}>
                  <div className={styles.field}>
                    <label>SKU / Código de barras</label>
                    <input
                      ref={skuInputRef}
                      type="text"
                      className={styles.barcodeInput}
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="Escanea el producto..."
                      disabled={submitting}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submitting || !sku.trim()}>
                    <Plus size={16} />
                  </button>
                </form>
              )}

              {submitError && <p className={styles.error}>{submitError}</p>}
            </div>

            {customer && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}><Calendar size={16} /> Facturas recientes</h3>
                {loadingInvoices ? (
                  <p className={styles.empty}>Cargando...</p>
                ) : recentInvoices.length === 0 ? (
                  <p className={styles.empty}>No hay facturas en los últimos 7 días</p>
                ) : (
                  <div className={styles.invoiceList}>
                    {recentInvoices.map((inv) => {
                      const returnableCount = (inv.movement_items || []).filter(
                        (it) => it.quantity - (it.returned_quantity || 0) > 0
                      ).length
                      return (
                        <div key={inv.id} className={styles.invoiceItem}>
                          <div className={styles.invoiceInfo}>
                            <strong>#{inv.id.slice(0, 8)}</strong>
                            <span>{new Date(inv.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className={styles.invoiceActions}>
                            <span className={styles.invoiceMeta}>{returnableCount} ítems</span>
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => addInvoiceItems(inv)}
                              disabled={returnableCount === 0}
                            >
                              Agregar
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right panel: return cart */}
          <div className={styles.rightPanel}>
            <div className={styles.cart}>
              <div className={styles.cartHeader}>
                <h3><Package size={18} /> Carrito de devolución</h3>
                {cart.length > 0 && (
                  <button className={styles.clearCartBtn} onClick={() => setCart([])}>
                    <Trash2 size={14} /> Vaciar
                  </button>
                )}
              </div>

              <div className={styles.cartBody}>
                {cart.length === 0 ? (
                  <div className={styles.emptyCart}>
                    <Package size={40} />
                    <p>Escanea o selecciona productos para devolver</p>
                  </div>
                ) : (
                  cart.map((c) => (
                    <div key={c.key} className={styles.cartItem}>
                      <div className={styles.cartItemInfo}>
                        <strong>{c.product?.name}</strong>
                        <span>{formatVariantLabel(c.variant, c.product?.categories?.size_label)}</span>
                        <span className={styles.cartItemInvoice}>
                          Factura #{c.invoice.id.slice(0, 8)} · {formatMoney(c.unitPrice)} c/u
                        </span>
                      </div>
                      <div className={styles.cartItemActions}>
                        <div className={styles.qtyControl}>
                          <button onClick={() => updateQty(c.key, -1)} disabled={c.returnQty <= 1}>
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={c.maxReturn}
                            value={c.returnQty}
                            onChange={(e) => setQty(c.key, e.target.value)}
                          />
                          <button onClick={() => updateQty(c.key, 1)} disabled={c.returnQty >= c.maxReturn}>
                            <Plus size={12} />
                          </button>
                        </div>
                        <div className={styles.cartItemCredit}>
                          {formatMoney(c.unitPrice * c.returnQty)}
                        </div>
                        <button className={styles.removeBtn} onClick={() => removeFromCart(c.key)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className={styles.cartFooter}>
                {customer && (
                  <div className={styles.cartCustomer}>
                    <span>{customer.name}</span>
                    <span className={styles.cartBalance}>
                      Saldo: {formatMoney(customer.balance)}
                    </span>
                  </div>
                )}
                <div className={styles.cartTotal}>
                  <span>Crédito total</span>
                  <strong>{formatMoney(totalCredit)}</strong>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleConfirm}
                  disabled={submitting || cart.length === 0}
                >
                  {submitting ? 'Procesando...' : 'Confirmar devolución'}
                </button>
                {customer && (
                  <button className={styles.newReturnBtn} onClick={clearAll}>
                    <X size={14} /> Nueva devolución
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* History section */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              className={styles.historyWrap}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className={styles.card}>
                <h3 className={styles.cardTitle}><History size={16} /> Historial de devoluciones</h3>
                {loadingHistory ? (
                  <p className={styles.empty}>Cargando...</p>
                ) : returnHistory.length === 0 ? (
                  <p className={styles.empty}>No hay devoluciones registradas</p>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.historyTable}>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Cliente</th>
                          <th>Crédito</th>
                          <th>Productos</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnHistory.map((r) => (
                          <tr key={r.id}>
                            <td>{new Date(r.created_at).toLocaleString()}</td>
                            <td>{r.customer_name || '—'}</td>
                            <td>{formatMoney(r.total_amount)}</td>
                            <td>{(r.movement_items || []).length}</td>
                            <td>
                              <span className={r.status === 'completada' ? styles.statusCompleted : styles.statusReverted}>
                                {r.status === 'completada' ? 'Completada' : 'Revertida'}
                              </span>
                            </td>
                            <td>
                              <div className={styles.actionsCell}>
                                <Link
                                  to={`/admin/movements/${r.id}`}
                                  className={styles.viewBtn}
                                  title="Ver detalle"
                                >
                                  <Eye size={14} />
                                </Link>
                                {r.status === 'completada' && (
                                  <button
                                    className={styles.revertBtn}
                                    onClick={() => handleRevertConfirm(r)}
                                    disabled={reverting}
                                    title="Revertir devolución"
                                  >
                                    <Undo2 size={14} /> Revertir
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        title="¿Confirmar devolución?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeReturn}
        confirmText="Sí, generar crédito"
        disabled={submitting}
      >
        <p>Se generará un crédito de <strong>{formatMoney(totalCredit)}</strong> para <strong>{customer?.name}</strong>.</p>
        <ul className={styles.confirmList}>
          {cart.map((c) => (
            <li key={c.key}>
              {c.returnQty}x {c.product?.name} (Factura #{c.invoice.id.slice(0, 8)}) — {formatMoney(c.unitPrice * c.returnQty)}
            </li>
          ))}
        </ul>
      </ConfirmModal>

      <ConfirmModal
        isOpen={revertConfirmOpen}
        title="¿Revertir devolución?"
        onCancel={() => { setRevertConfirmOpen(false); setRevertError('') }}
        onConfirm={executeRevert}
        confirmText="Sí, revertir"
        disabled={reverting}
      >
        <p>Se deshará la devolución de <strong>{returnToRevert?.customer_name}</strong> de <strong>{formatMoney(returnToRevert?.total_amount)}</strong>:</p>
        <ul className={styles.confirmList}>
          <li>El stock de los productos volverá a quitarse</li>
          <li>La factura original volverá a permitir devolverlas</li>
          <li>El saldo del cliente bajará (puede quedar negativo)</li>
          <li>Los puntos deducidos serán devueltos</li>
        </ul>
        {revertError && <p className={styles.error}>{revertError}</p>}
      </ConfirmModal>

      <AnimatePresence>
        {pickerOptions && (
          <ReturnInvoicePicker
            options={pickerOptions}
            onSelect={handlePickInvoice}
            onClose={() => { setPickerOptions(null); setTimeout(focusSku, 50) }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {completedReturn && (
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
              <div className={styles.modalHeader}>
                <h2><CheckCircle size={20} color="#16a34a" /> Devolución completada</h2>
                <button className={styles.closeBtn} onClick={() => setCompletedReturn(null)}>
                  <X size={20} />
                </button>
              </div>
              <ReturnReceiptView
                movement={completedReturn.movement}
                items={completedReturn.items}
                customer={completedReturn.customer}
                totalCredit={completedReturn.totalCredit}
                newBalance={completedReturn.newBalance}
                createdAt={completedReturn.createdAt}
              />
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => printReturnReceipt(completedReturn)}
                >
                  <Printer size={16} /> Imprimir / Guardar PDF
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}
