import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Trash2, ShoppingBag, ChevronDown, ChevronUp, AlertCircle, Search, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCashSession } from '../../hooks/useCashSession'
import { formatVariantLabel, getVariantImage } from '../../lib/sku'
import ConfirmModal from '../../components/admin/ConfirmModal'
import styles from './AdminMovementNew.module.css'

function getTotalQuantityByProduct(items, productId) {
  return items
    .filter((i) => i.product.id === productId)
    .reduce((sum, i) => sum + i.quantity, 0)
}

function calculateItemPrice(product, variant, quantity, totalProductQty) {
  const minQty = product.min_wholesale_qty || 0
  if (minQty > 0 && totalProductQty >= minQty) {
    return variant.wholesale_price || product.wholesale_price || variant.price || product.price || 0
  }
  return variant.price || product.price || 0
}

export default function AdminMovementNew() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type') === 'consignacion' ? 'consignacion' : 'venta'
  const { user } = useAuth()
  const { session, loading: sessionLoading } = useCashSession(user?.id)

  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [form, setForm] = useState({
    customer_id: '',
    customer_name: '',
    customer_phone: '',
    payment_method: type === 'venta' ? 'efectivo' : 'pendiente',
    notes: ''
  })
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isFormExpanded, setIsFormExpanded] = useState(true)

  useEffect(() => {
    if (type === 'venta') {
      navigate('/admin/pos')
    }
  }, [type, navigate])

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from('products').select('*, categories(*), product_variants(*)').eq('active', true)
      setProducts(data || [])
    }
    fetchProducts()
  }, [])

  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([])
      return
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%,id_number.ilike.%${customerSearch}%`)
        .limit(10)
      setCustomerResults(data || [])
    }, 200)
    return () => clearTimeout(timer)
  }, [customerSearch])

  const selectCustomer = (customer) => {
    setForm(prev => ({
      ...prev,
      customer_id: customer?.id || '',
      customer_name: customer?.name || '',
      customer_phone: customer?.phone || ''
    }))
    setShowCustomerSearch(false)
    setCustomerSearch('')
    setCustomerResults([])
  }

  const addToCart = (product, variant) => {
    const available = variant?.stock || 0
    if (available <= 0) return

    setCart(prev => {
      let updated = [...prev]
      const existingIndex = updated.findIndex(item => item.variant.id === variant.id)

      if (existingIndex >= 0) {
        const item = updated[existingIndex]
        if (item.quantity >= available) return prev
        item.quantity += 1
      } else {
        updated.push({ product, variant, quantity: 1, price: 0 })
      }

      const totalQty = getTotalQuantityByProduct(updated, product.id)
      updated = updated.map(item =>
        item.product.id === product.id
          ? { ...item, price: calculateItemPrice(item.product, item.variant, item.quantity, totalQty) }
          : item
      )

      return updated
    })
  }

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  const handleSave = (e) => {
    e.preventDefault()
    if (cart.length === 0) {
      setError('Debes agregar al menos un producto')
      return
    }
    if (!session) {
      setError('No hay caja abierta. Abre un turno en Caja.')
      return
    }
    setError('')
    setConfirmOpen(true)
  }

  const executeSave = async () => {
    setSaving(true)
    setError('')

    try {
      const { data: movement, error: movError } = await supabase.from('movements').insert([{
        movement_type: type,
        status: type === 'venta' ? 'pagado' : 'activo',
        user_id: user.id,
        cash_session_id: session.id,
        customer_id: form.customer_id || null,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        payment_method: form.payment_method,
        total_amount: totalAmount,
        notes: form.notes
      }]).select().single()

      if (movError) throw movError

      const items = cart.map(item => ({
        movement_id: movement.id,
        product_id: item.product.id,
        variant_id: item.variant.id,
        size: item.variant.size || '',
        quantity: item.quantity,
        unit_price: item.price
      }))

      const { error: itemsError } = await supabase.from('movement_items').insert(items)
      if (itemsError) throw itemsError

      if (form.payment_method && form.payment_method !== 'pendiente') {
        const { error: paymentError } = await supabase.from('movement_payments').insert([{
          movement_id: movement.id,
          method: form.payment_method,
          amount: totalAmount,
          reference: ''
        }])
        if (paymentError) throw paymentError
      }

      for (const item of cart) {
        const newStock = Math.max(0, item.variant.stock - item.quantity)
        const { error: stockError } = await supabase.from('product_variants').update({ stock: newStock }).eq('id', item.variant.id)
        if (stockError) throw stockError
      }

      navigate('/admin/movements')
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  if (type === 'venta') {
    return null // Redirigiendo al POS
  }

  if (sessionLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Cargando caja...</h1>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link to="/admin/movements" className={styles.backBtn}><ArrowLeft size={20}/></Link>
        <h1>Nueva {type === 'venta' ? 'Venta' : 'Consignación'}</h1>
      </div>

      {!session && (
        <div className={styles.page} style={{ padding: '1.5rem', background: '#fef3c7', borderRadius: '0.75rem', margin: '1rem', color: '#92400e' }}>
          <AlertCircle size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
          No hay caja abierta. Ve a <strong>Caja</strong> y abre un turno para continuar.
        </div>
      )}

      <div className={styles.content}>
        <div className={styles.productsSection}>
          <h2>Productos Disponibles</h2>
          <div className={styles.grid}>
            {products.map(p => {
              const variants = (p.product_variants || []).filter(v => v.stock > 0)
              return (
                <div key={p.id} className={styles.productCard}>
                  <div style={{fontWeight:600, marginBottom: '0.25rem'}}>{p.name}</div>
                  <div className={styles.sizes}>
                    {variants.map(v => (
                      <button key={v.id} className={styles.variantThumbBtn} onClick={() => addToCart(p, v)} title={formatVariantLabel(v, p.categories?.size_label)}>
                        <div className={styles.variantThumbSmall}>
                          {getVariantImage(p, v) ? (
                            <img src={getVariantImage(p, v)} alt={formatVariantLabel(v, p.categories?.size_label)} />
                          ) : (
                            <ShoppingBag size={16} />
                          )}
                        </div>
                        <span>{formatVariantLabel(v, p.categories?.size_label)}</span>
                        <span className={styles.stockBadge}>{v.stock}</span>
                      </button>
                    ))}
                    {variants.length === 0 && <span style={{fontSize:'12px', color:'red'}}>Sin stock</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <form className={styles.formSection} onSubmit={handleSave} noValidate onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: isFormExpanded ? '1rem' : '0', cursor: 'pointer'}} onClick={() => setIsFormExpanded(!isFormExpanded)}>
            <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
              <h2 style={{margin:0, fontSize: '1.1rem'}}>Detalles</h2>
              {isFormExpanded ? <ChevronUp size={20} className={styles.expandIcon}/> : <ChevronDown size={20} className={styles.expandIcon}/>}
            </div>
            <span className="badge badge-secondary">
              {type === 'venta' ? 'Venta' : 'Consignación'}
            </span>
          </div>
          
          {isFormExpanded && (
            <div className={styles.formExpandedContent}>
              <div className={styles.cartList}>
                {cart.length === 0 && <p className={styles.emptyCart}>No hay productos</p>}
                {cart.map((item, i) => (
                  <div key={i} className={styles.cartItem}>
                    <div className={styles.cartItemThumb}>
                      {getVariantImage(item.product, item.variant) ? (
                        <img src={getVariantImage(item.product, item.variant)} alt={item.product.name} />
                      ) : (
                        <ShoppingBag size={18} />
                      )}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600}}>{item.product.name}</div>
                      <div style={{fontSize:'13px', color:'var(--color-dark-soft)'}}>{formatVariantLabel(item.variant, item.product?.categories?.size_label)}</div>
                      <div style={{fontSize:'14px'}}>{item.quantity} x ${item.price}</div>
                    </div>
                    <div style={{fontWeight:700}}>${item.quantity * item.price}</div>
                    <button type="button" className={styles.removeBtn} onClick={() => removeFromCart(i)}><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>

              <div className={styles.field}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Cliente</span>
                  <button type="button" className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '12px' }} onClick={() => setShowCustomerSearch(!showCustomerSearch)}>
                    {showCustomerSearch ? <><X size={12} /> Cerrar</> : <><Search size={12} /> Buscar</>}
                  </button>
                </label>
                {form.customer_name ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                    <div>
                      <strong>{form.customer_name}</strong>
                      {form.customer_phone && <div style={{ fontSize: '0.8rem', color: 'var(--color-dark-soft)' }}>{form.customer_phone}</div>}
                    </div>
                    <button type="button" className={styles.removeBtn} onClick={() => selectCustomer(null)}>
                      <X size={16} />
                    </button>
                  </div>
                ) : showCustomerSearch ? (
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="Nombre, teléfono o cédula..."
                      autoFocus
                    />
                    {customerResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '0.5rem', marginTop: '0.25rem', maxHeight: '200px', overflowY: 'auto', zIndex: 10 }}>
                        {customerResults.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.8rem', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.05)' }}
                            onClick={() => selectCustomer(c)}
                          >
                            <strong>{c.name}</strong>
                            {c.phone && <span style={{ fontSize: '0.8rem', color: 'var(--color-dark-soft)', marginLeft: '0.5rem' }}>{c.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: 'var(--color-dark-soft)', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                    Cliente general (opcional)
                  </div>
                )}
              </div>

              <div className={styles.field}>
                <label>Método de Pago</label>
                <select className="input" value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}>
                  <option value="efectivo">Efectivo</option>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="zelle">Zelle</option>
                  <option value="zinli">Zinli</option>
                  <option value="binance">Binance</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="punto">Punto de Venta</option>
                  <option value="pendiente">Pendiente (Por pagar)</option>
                </select>
              </div>

              <div className={styles.field}>
                <label>Notas</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Observaciones..." />
              </div>
            </div>
          )}

          <div className={styles.totalRow} style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
            <span>Total:</span>
            <span>${totalAmount}</span>
          </div>

          {error && <div style={{color:'red', fontSize: '14px'}}>{error}</div>}

          <button type="submit" className="btn btn-primary" style={{width:'100%', marginTop:'1rem'}} disabled={saving || !session}>
            {saving ? 'Guardando...' : 'Confirmar Movimiento'}
          </button>
        </form>

        <ConfirmModal
          isOpen={confirmOpen}
          title={`Confirmar ${type === 'venta' ? 'venta' : 'consignación'}`}
          message={`Se registrará ${type === 'venta' ? 'una venta' : 'una consignación'} por $${totalAmount.toFixed(2)} con ${cart.reduce((s, i) => s + i.quantity, 0)} unidades.`}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={executeSave}
          confirmText="Confirmar"
          disabled={saving}
        />
      </div>
    </div>
  )
}
