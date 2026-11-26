import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
import styles from './GlassHeader.module.css'

export default function GlassHeader({
  logoSrc,
  logoAlt = 'Elite Store',
  title = 'ELITE STORE',
  accent = '#C4788A',
  homePath = '/',
  onCartOpen = null,
  cartCount = 0,
}) {
  return (
    <motion.header
      className={styles.header}
      style={{ '--glass-accent': accent }}
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={homePath} className={styles.brand} aria-label={`${logoAlt} — inicio`}>
        {logoSrc && <img src={logoSrc} alt="" className={styles.logo} />}
        <span className={styles.title}>{title}</span>
      </Link>

      {onCartOpen && (
        <button
          type="button"
          className={styles.cartBtn}
          onClick={onCartOpen}
          aria-label="Abrir carrito"
        >
          <ShoppingBag size={20} />
          {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
        </button>
      )}

      <span className={styles.triLine} aria-hidden="true" />
    </motion.header>
  )
}
