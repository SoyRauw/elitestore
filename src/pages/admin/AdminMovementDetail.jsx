import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, RotateCcw } from 'lucide-react'
import styles from './AdminMovementDetail.module.css'

export default function AdminMovementDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [movement, setMovement] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDetail = async () => {
    setLoading(true)
    const [movRes, itemsRes] = await Promise.all([
      supabase.from('movements').select('*').eq('id', id).single(),
      supabase.from('movement_items').select('*, products(name)').eq('movement_id', id)
    ])
    setMovement(movRes.data)
    setItems(itemsRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchDetail() }, [id])

  const markAsSold = async () => {
    if(!confirm('¿Marcar esta consignación como VENDIDA?')) return
    await supabase.from('movements').update({ status: 'vendido', updated_at: new Date().toISOString() }).eq('id', id)
    fetchDetail()
  }

  const markAsReturned = async () => {
    if(!confirm('¿Marcar esta consignación como DEVUELTA? El stock se sumará de nuevo al inventario.')) return
    
    // 1. Update movement status
    await supabase.from('movements').update({ status: 'devuelto', updated_at: new Date().toISOString() }).eq('id', id)
    
    // 2. Return stock
    for (const item of items) {
      const { data: sizeData } = await supabase.from('product_sizes').select('stock').eq('product_id', item.product_id).eq('size', item.size).single()
      if (sizeData) {
        await supabase.from('product_sizes').update({ stock: sizeData.stock + item.quantity }).eq('product_id', item.product_id).eq('size', item.size)
      }
    }
    fetchDetail()
  }

  if (loading) return <div className={styles.page}>Cargando...</div>
  if (!movement) return <div className={styles.page}>Movimiento no encontrado</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Link to="/admin/movements" className={styles.backBtn}><ArrowLeft size={20}/></Link>
        <h1>Detalle de Factura #{movement.id.split('-')[0]}</h1>
        <span className={`badge ${movement.movement_type === 'venta' ? 'badge-primary' : 'badge-secondary'}`}>
          {movement.movement_type.toUpperCase()}
        </span>
        <span className={`badge ${movement.status === 'pagado' || movement.status === 'vendido' ? 'badge-success' : movement.status === 'devuelto' ? 'badge-danger' : 'badge-secondary'}`}>
          {movement.status.toUpperCase()}
        </span>
      </div>

      <div className={styles.content}>
        <div className={styles.infoCard}>
          <h3>Datos del Cliente</h3>
          <p><strong>Nombre:</strong> {movement.customer_name || 'N/A'}</p>
          <p><strong>Teléfono:</strong> {movement.customer_phone || 'N/A'}</p>
          <p><strong>Fecha:</strong> {new Date(movement.created_at).toLocaleString()}</p>
          <p><strong>Método de Pago:</strong> {movement.payment_method}</p>
        </div>

        <div className={styles.itemsCard}>
          <h3>Productos</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Talla</th>
                <th>Cant.</th>
                <th>Precio Un.</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.products?.name} (#{item.product_id})</td>
                  <td>{item.size}</td>
                  <td>{item.quantity}</td>
                  <td>${item.unit_price}</td>
                  <td>${item.quantity * item.unit_price}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="4" style={{textAlign:'right', fontWeight:700}}>TOTAL:</td>
                <td style={{fontWeight:700, color:'var(--color-gold)'}}>${movement.total_amount}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {movement.movement_type === 'consignacion' && movement.status === 'activo' && (
          <div className={styles.actionsCard}>
            <h3>Acciones de Consignación</h3>
            <div style={{display:'flex', gap:'1rem', marginTop:'1rem'}}>
              <button className="btn btn-primary" onClick={markAsSold}>
                <CheckCircle size={16}/> Marcar como Vendido
              </button>
              <button className="btn btn-outline" onClick={markAsReturned} style={{color:'#dc2626', borderColor:'#dc2626'}}>
                <RotateCcw size={16}/> Marcar como Devuelto
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
