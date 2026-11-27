import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
import styles from './GlassHeader.module.css'

export default function GlassHeader({
  logoSrc,
  logoAlt = null,
  eyebrow = null,
  title = 'ELITE STORE',
  accent = '#C4788A',
  homePath = '/',
  variant = 'light',
  onCartOpen = null,
  cartCount = 0,
}) {
  return (
    <motion.header
      className={`${styles.header} ${variant === 'dark' ? styles.dark : ''}`}
      style={{
        '--glass-accent': accent,
        backdropFilter:
          variant === 'dark'
            ? 'blur(20px) saturate(160%)'
            : 'blur(22px) saturate(160%)',
        WebkitBackdropFilter:
          variant === 'dark'
            ? 'blur(20px) saturate(160%)'
            : 'blur(22px) saturate(160%)',
      }}
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={homePath} className={styles.brand} aria-label={`${logoAlt || title} — inicio`}>
        {logoSrc && <img src={logoSrc} alt="" className={styles.logo} />}
        <span className={styles.brandText}>
          {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
          <span className={styles.title}>{title}</span>
        </span>
      </Link>

      {onCartOpen && (
        <button
          type="button"
          className={styles.cartBtn}
          onClick={onCartOpen}
          aria-label="Abrir carrito"
          style={{
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <ShoppingBag size={20} />
          {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
        </button>
      )}

      <span className={styles.triLine} aria-hidden="true" />
    </motion.header>
  )
}
