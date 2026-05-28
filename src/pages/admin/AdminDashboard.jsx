import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import {
  Package, AlertTriangle, TrendingUp, Tag, LogOut, Plus,
  ShoppingBag, BarChart2, FolderTree
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import styles from './AdminDashboard.module.css'

export default function AdminDashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [recentProducts, setRecentProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const { data: products } = await supabase.from('products').select('*, product_sizes(stock)')
      if (!products) { setLoading(false); return }

      const totalProducts = products.length
      const totalStock = products.reduce((sum, p) => {
        if (!p.product_sizes) return sum
        return sum + p.product_sizes.reduce((s, ps) => s + (ps.stock || 0), 0)
      }, 0)
      
      const lowStock = products.filter((p) => {
        if (!p.product_sizes) return false
        const total = p.product_sizes.reduce((s, ps) => s + (ps.stock || 0), 0)
        return total < 5 && total > 0
      }).length
      
      const outOfStock = products.filter((p) => {
        if (!p.product_sizes) return true
        return p.product_sizes.reduce((s, ps) => s + (ps.stock || 0), 0) === 0
      }).length

      setStats({ totalProducts, totalStock, lowStock, outOfStock })
      setRecentProducts(products.slice(0, 5))
      setLoading(false)
    }
    fetchStats()
  }, [])

  const handleLogout = async () => {
    await signOut()
    navigate('/admin')
  }

  const statCards = stats ? [
    { icon: Package,      label: 'Productos',      value: stats.totalProducts, color: 'primary' },
    { icon: BarChart2,    label: 'Unidades en stock', value: stats.totalStock,    color: 'gold'    },
    { icon: AlertTriangle,label: 'Stock bajo',      value: stats.lowStock,      color: 'warning' },
    { icon: TrendingUp,   label: 'Sin stock',       value: stats.outOfStock,    color: 'danger'  },
  ] : []

  return (
    <AdminLayout>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            <p className={styles.pageSubtitle}>Bienvenida, {user?.email}</p>
          </div>
          <Link to="/admin/products" className="btn btn-primary">
            <Plus size={16} /> Ir a productos
          </Link>
        </div>

        {loading ? (
          <div className={styles.statsGrid}>
            {[1,2,3,4].map(i => <div key={i} className={`skeleton ${styles.statSkeleton}`} />)}
          </div>
        ) : (
          <div className={styles.statsGrid}>
            {statCards.map((s, i) => (
              <motion.div
                key={s.label}
                className={`${styles.statCard} ${styles[`stat_${s.color}`]}`}
                initial={{ opacity:0, y:20 }}
                animate={{ opacity:1, y:0 }}
                transition={{ delay: i*0.08 }}
              >
                <div className={styles.statIcon}><s.icon size={22} /></div>
                <div>
                  <div className={styles.statValue}>{s.value}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              </motion.div>
            ))}
          </div>
  )
}

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Productos recientes</h2>
            <Link to="/admin/products" className="btn btn-outline" style={{fontSize:'0.8rem',padding:'0.5rem 1rem'}}>
              Ver todos
            </Link>
          </div>
          <div className={styles.productList}>
            {recentProducts.map((p, i) => (
              <motion.div
                key={p.id}
                className={styles.productRow}
                initial={{ opacity:0, x:-20 }}
                animate={{ opacity:1, x:0 }}
                transition={{ delay: i*0.06 }}
              >
                <div className={styles.productInfo}>
                  <div className={styles.productImageThumb}>
                    {p.images?.[0] ? (
                      <img src={p.images[0]} alt={p.name} />
                    ) : <ShoppingBag size={16} />}
                  </div>
                  <div>
                    <div className={styles.productName}>{p.name}</div>
                    <div className={styles.productId}>#{p.id}</div>
                  </div>
                </div>
                <span className={styles.productPrice}>${p.price}</span>
                <span className={`badge ${p.active ? 'badge-success' : 'badge-danger'}`}>
                  {p.active ? 'Activo' : 'Inactivo'}
                </span>
              </motion.div>
            ))}
            {recentProducts.length === 0 && !loading && (
              <p style={{color:'var(--color-dark-soft)',padding:'1rem',textAlign:'center'}}>
                No hay productos aún. <Link to="/admin/products" style={{color:'var(--color-primary)'}}>Agrega el primero</Link>
              </p>
            )}
          </div>
        </div>
      
    </AdminLayout>
  )
}
