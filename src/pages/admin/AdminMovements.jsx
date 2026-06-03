import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Plus, LogOut, BarChart2, Package, Tag, ShoppingBag, FolderTree, Eye } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import styles from './AdminMovements.module.css'

export default function AdminMovements() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchMovements = async () => {
    setLoading(true)
    const { data } = await supabase.from('movements').select('*').order('created_at', { ascending: false })
    setMovements(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchMovements() }, [])

  return (
    <AdminLayout>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Historial de Movimientos</h1>
            <p className={styles.pageSubtitle}>Ventas, facturas y consignaciones</p>
          </div>
          <div style={{display:'flex', gap:'1rem'}}>
            <Link to="/admin/movements/new?type=consignacion" className="btn btn-outline">
              <Plus size={16} /> Consignar
            </Link>
            <Link to="/admin/movements/new?type=venta" className="btn btn-primary">
              <Plus size={16} /> Nueva Venta
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
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <motion.tr key={m.id} className={styles.tableRow} initial={{opacity:0}} animate={{opacity:1}}>
                    <td data-label="Fecha">{new Date(m.created_at).toLocaleDateString()}</td>
                    <td data-label="Tipo">
                      <span className={`badge ${m.movement_type === 'venta' ? 'badge-primary' : 'badge-secondary'}`}>
                        {m.movement_type}
                      </span>
                    </td>
                    <td data-label="Cliente">{m.customer_name || 'Sin nombre'}</td>
                    <td data-label="Estado">
                      <span className={`badge ${
                        m.status === 'pagado' || m.status === 'vendido' ? 'badge-success' : 
                        m.status === 'devuelto' || m.status === 'anulado' ? 'badge-danger' : 
                        'badge-secondary'
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td data-label="Total" style={{fontWeight:600, color:'var(--color-gold)'}}>${m.total_amount}</td>
                    <td data-label="Acciones">
                      <Link to={`/admin/movements/${m.id}`} className={styles.editBtn}>
                        <Eye size={15}/>
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {movements.length === 0 && (
               <div style={{padding:'3rem', textAlign:'center', color:'var(--color-dark-soft)'}}>
                 No hay movimientos registrados. Crea una venta o consignación.
               </div>
  )
}
          </div>
  )
}
      
    </AdminLayout>
  )
}
