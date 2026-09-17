import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { revertReturnMovement } from '../../lib/returns'
import { Eye, Store, Undo2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import styles from './AdminMovements.module.css'

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
  credito: 'Crédito en cuenta',
}

export default function AdminMovements() {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [includeReturns, setIncludeReturns] = useState(false)
  const [returnToRevert, setReturnToRevert] = useState(null)
  const [reverting, setReverting] = useState(false)
  const [revertError, setRevertError] = useState('')

  const fetchMovements = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('movements')
      .select('*, cash_sessions(opened_at), movement_payments(method, amount), customer_coupons(*, reward_coupons(*))')
      .order('created_at', { ascending: false })

    if (!includeReturns) {
      query = query.eq('movement_type', 'venta')
    }

    const { data, error } = await query

    if (error) {
      console.error('Error cargando movimientos:', error)
    }
    setMovements(data || [])
    setLoading(false)
  }, [includeReturns])

  useEffect(() => { fetchMovements() }, [fetchMovements])

  const executeRevert = async () => {
    setReverting(true)
    try {
      await revertReturnMovement(returnToRevert)
      setReturnToRevert(null)
      fetchMovements()
    } catch (e) {
      console.error(e)
      setRevertError(e.message || 'Error revirtiendo la devolución')
      alert(e.message || 'Error revirtiendo la devolución')
    } finally {
      setReverting(false)
    }
  }

  return (
    <AdminLayout>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Historial de Movimientos</h1>
            <p className={styles.pageSubtitle}>Ventas y recibos</p>
          </div>
          <div style={{display:'flex', gap:'1rem', alignItems:'center'}}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={includeReturns}
                onChange={(e) => setIncludeReturns(e.target.checked)}
              />
              Incluir devoluciones
            </label>
            <Link to="/admin/pos" className="btn btn-primary">
              <Store size={16} /> Ir al POS
            </Link>
          </div>
        </div>

        {loading ? (
          <div className={styles.skeletonList}>
            {[1,2,3].map(i => <div key={i} className={`skeleton ${styles.skeletonRow}`} />)}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Método</th>
                  <th>Turno</th>
                  <th>Estado</th>
                  <th>Descuento</th>
                  <th>Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <motion.tr key={m.id} className={styles.tableRow} initial={{opacity:0}} animate={{opacity:1}}>
                    <td data-label="Fecha">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td data-label="Tipo">
                      <span className={`badge ${m.movement_type === 'venta' ? 'badge-primary' : m.movement_type === 'devolucion' ? 'badge-warning' : 'badge-secondary'}`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td data-label="Cliente">{m.customer_name || 'Sin nombre'}</td>
                    <td data-label="Método">
                      {m.movement_payments && m.movement_payments.length > 0 || (parseFloat(m.credit_amount) || 0) > 0 ? (
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.85rem' }}>
                          {(parseFloat(m.credit_amount) || 0) > 0 && (
                            <li key="credit" style={{ color: '#166534', fontWeight: 500 }}>
                              Crédito en cuenta (${(parseFloat(m.credit_amount)).toFixed(2)})
                            </li>
                          )}
                          {(m.movement_payments || []).map((p, idx) => (
                            <li key={idx}>{PAYMENT_METHODS[p.method] || p.method} (${p.amount})</li>
                          ))}
                        </ul>
                      ) : (
                        PAYMENT_METHODS[m.payment_method] || m.payment_method || '—'
                      )}
                    </td>
                    <td data-label="Turno">{m.cash_sessions ? new Date(m.cash_sessions.opened_at).toLocaleDateString() : <span style={{color:'var(--color-dark-soft)'}}>Sin turno</span>}</td>
                    <td data-label="Estado">
                      <span className={`badge ${
                        m.status === 'pagado' || m.status === 'vendido' || m.status === 'completada' ? 'badge-success' :
                        m.status === 'devuelto' || m.status === 'anulado' ? 'badge-danger' :
                        'badge-secondary'
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td data-label="Descuento">
                      {(m.discount_amount || 0) > 0 ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>
                          -${m.discount_amount}
                          {m.customer_coupons?.reward_coupons?.name && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-dark-soft)', fontWeight: 400 }}>
                              {m.customer_coupons.reward_coupons.name}
                            </span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td data-label="Total" style={{fontWeight:600, color:'var(--color-gold)'}}>${m.total_amount}</td>
                    <td data-label="Acciones">
                      <div style={{display:'flex', gap:'0.4rem'}}>
                        <Link to={`/admin/movements/${m.id}`} className={styles.editBtn}>
                          <Eye size={15}/>
                        </Link>
                        {m.movement_type === 'devolucion' && m.status === 'completada' && (
                          <button
                            className={styles.revertBtn}
                            onClick={() => setReturnToRevert(m)}
                            disabled={reverting}
                            title="Revertir devolución"
                          >
                            <Undo2 size={15}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {movements.length === 0 && (
               <div style={{padding:'3rem', textAlign:'center', color:'var(--color-dark-soft)'}}>
                 No hay movimientos registrados. Crea una venta desde el POS.
               </div>
  )
}
          </div>
  )
}

      <ConfirmModal
        isOpen={!!returnToRevert}
        title="¿Revertir devolución?"
        onCancel={() => { setReturnToRevert(null); setRevertError('') }}
        onConfirm={executeRevert}
        confirmText="Sí, revertir"
        disabled={reverting}
      >
        <p>Se deshará la devolución de <strong>{returnToRevert?.customer_name}</strong> de <strong>${(parseFloat(returnToRevert?.total_amount) || 0).toFixed(2)}</strong>:</p>
        <ul style={{margin:'0.75rem 0 0', paddingLeft:'1.2rem', fontSize:'0.9rem'}}>
          <li>El stock de los productos volverá a quitarse</li>
          <li>La factura original volverá a permitir devolverlas</li>
          <li>El saldo del cliente bajará (puede quedar negativo)</li>
          <li>Los puntos deducidos serán devueltos</li>
        </ul>
        {revertError && <p style={{color:'#b91c1c', marginTop:'0.75rem'}}>{revertError}</p>}
      </ConfirmModal>

    </AdminLayout>
  )
}
