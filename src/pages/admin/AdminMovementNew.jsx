import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import styles from './AdminMovementNew.module.css'

export default function AdminMovementNew() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type') === 'consignacion' ? 'consignacion' : 'venta'

  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([]) // { product, size, quantity, price }
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    payment_method: type === 'venta' ? 'efectivo' : 'pendiente',
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from('products').select('*, product_sizes(size, stock)').eq('active', true)
      setProducts(data || [])
    }
    fetchProducts()
  }, [])

  const addToCart = (product, size) => {
    // Check available stock
    const sizeData = product.product_sizes?.find(ps => ps.size === size)
    const available = sizeData ? sizeData.stock : 0
    
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id && item.size === size)
      if (existing) {
        if (existing.quantity >= available) return prev // Can't add more than stock
        return prev.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item)
      }
      if (available <= 0) return prev
      return [...prev, { product, size, quantity: 1, price: product.price }]
    })
  }

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  const handleSave = async (e) => {
    e.preventDefault()
    if (cart.length === 0) {
      setError('Debes agregar al menos un producto')
      return
    }
    setSaving(true)
    setError('')

    try {
      // 1. Create movement
      const { data: movement, error: movError } = await supabase.from('movements').insert([{
        movement_type: type,
        status: type === 'venta' ? 'pagado' : 'activo',
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        payment_method: form.payment_method,
        total_amount: totalAmount,
        notes: form.notes
      }]).select().single()

      if (movError) throw movError

      // 2. Create items and update stock
      const items = cart.map(item => ({
        movement_id: movement.id,
        product_id: item.product.id,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.price
      }))

      const { error: itemsError } = await supabase.from('movement_items').insert(items)
      if (itemsError) throw itemsError

      // 3. Update stock manually (looping since RPC is not setup)
      for (const item of cart) {
        const sizeData = item.product.product_sizes.find(ps => ps.size === item.size)
        const newStock = Math.max(0, sizeData.stock - item.quantity)
        
        await supabase.from('product_sizes').update({ stock: newStock })
          .eq('product_id', item.product.id).eq('size', item.size)
      }

      navigate('/admin/movements')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link to="/admin/movements" className={styles.backBtn}><ArrowLeft size={20}/></Link>
        <h1>Nueva {type === 'venta' ? 'Venta' : 'Consignación'}</h1>
      </div>

      <div className={styles.content}>
        <div className={styles.productsSection}>
          <h2>Productos Disponibles</h2>
          <div className={styles.grid}>
            {products.map(p => (
              <div key={p.id} className={styles.productCard}>
                <div style={{fontWeight:600}}>{p.name}</div>
                <div style={{color:'var(--color-primary)'}}>${p.price}</div>
                <div className={styles.sizes}>
                  {p.product_sizes?.filter(ps => ps.stock > 0).map(ps => (
                    <button key={ps.size} className={styles.sizeBtn} onClick={() => addToCart(p, ps.size)}>
                      {ps.size} <span className={styles.stockBadge}>{ps.stock}</span>
                    </button>
                  ))}
                  {(!p.product_sizes || p.product_sizes.every(ps => ps.stock <= 0)) && (
                    <span style={{fontSize:'12px', color:'red'}}>Sin stock</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form className={styles.formSection} onSubmit={handleSave}>
          <h2>Detalles del Movimiento</h2>
          
          <div className={styles.cartList}>
            {cart.length === 0 && <p className={styles.emptyCart}>No hay productos</p>}
            {cart.map((item, i) => (
              <div key={i} className={styles.cartItem}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600}}>{item.product.name} (Talla: {item.size})</div>
                  <div style={{fontSize:'14px'}}>{item.quantity} x ${item.price}</div>
                </div>
                <div style={{fontWeight:700}}>${item.quantity * item.price}</div>
                <button type="button" className={styles.removeBtn} onClick={() => removeFromCart(i)}><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
          
          <div className={styles.totalRow}>
            <span>Total:</span>
            <span>${totalAmount}</span>
          </div>

          <div className={styles.field}>
            <label>Cliente (opcional)</label>
            <input className="input" value={form.customer_name} onChange={e=>setForm({...form,customer_name:e.target.value})} placeholder="Nombre" />
          </div>

          <div className={styles.field}>
            <label>Teléfono (opcional)</label>
            <input className="input" value={form.customer_phone} onChange={e=>setForm({...form,customer_phone:e.target.value})} placeholder="0414-0000000" />
          </div>

          <div className={styles.field}>
            <label>Método de Pago</label>
            <select className="input" value={form.payment_method} onChange={e=>setForm({...form,payment_method:e.target.value})}>
              <option value="efectivo">Efectivo</option>
              <option value="pago_movil">Pago Móvil</option>
              <option value="zelle">Zelle</option>
              <option value="transferencia">Transferencia</option>
              <option value="pendiente">Pendiente (Por pagar)</option>
            </select>
          </div>

          {error && <div style={{color:'red', fontSize:'14px'}}>{error}</div>}

          <button type="submit" className="btn btn-primary" style={{width:'100%', marginTop:'1rem'}} disabled={saving}>
            {saving ? 'Guardando...' : 'Confirmar Movimiento'}
          </button>
        </form>
      </div>
    </div>
  )
}
