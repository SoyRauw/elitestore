import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, BarChart2, FolderTree, Package, Tag, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import styles from './AdminLayout.module.css'

export default function AdminLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin')
  }

  return (
    <div className={styles.page}>
      <div className={styles.mobileHeader}>
        <div className={styles.mobileLogo}>
          <ShoppingBag size={20} /><span>Elite Store</span>
        </div>
        <button className={styles.hamburger} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {menuOpen && <div className={styles.overlay} onClick={() => setMenuOpen(false)} />}

      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarLogo}>
          <ShoppingBag size={20} /><span>Elite Store</span>
        </div>
        <nav className={styles.sidebarNav}>
          <Link onClick={() => setMenuOpen(false)} to="/admin/dashboard" className={`${styles.navItem} ${location.pathname==='/admin/dashboard'?styles.navActive:''}`}><BarChart2 size={18} /> Dashboard</Link>
          <Link onClick={() => setMenuOpen(false)} to="/admin/categories" className={`${styles.navItem} ${location.pathname==='/admin/categories'?styles.navActive:''}`}><FolderTree size={18} /> Categorías</Link>
          <Link onClick={() => setMenuOpen(false)} to="/admin/products" className={`${styles.navItem} ${location.pathname==='/admin/products'?styles.navActive:''}`}><Package size={18} /> Productos</Link>
          <Link onClick={() => setMenuOpen(false)} to="/admin/inventory" className={`${styles.navItem} ${location.pathname==='/admin/inventory'?styles.navActive:''}`}><Tag size={18} /> Inventario</Link>
          <Link onClick={() => setMenuOpen(false)} to="/admin/movements" className={`${styles.navItem} ${location.pathname==='/admin/movements'?styles.navActive:''}`}><ShoppingBag size={18} /> Movimientos</Link>
        </nav>
        <button className={styles.logoutBtn} onClick={handleSignOut}>
          <LogOut size={16} /> Salir
        </button>
      </aside>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
