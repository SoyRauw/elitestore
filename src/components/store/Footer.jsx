import { Link } from 'react-router-dom'

import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.col}>
          <h3 className={styles.logoText}>Elite Store</h3>
          <p className={styles.description}>
            Elegancia en tu día a día. Moda exclusiva, tendencias y accesorios diseñados para ti.
          </p>
        </div>

        <div className={styles.col}>
          <h4>Accesos rápidos</h4>
          <nav className={styles.nav}>
            <Link to="/">Inicio</Link>
            <Link to="/catalog">Catálogo</Link>
            <Link to="/nosotros">Nosotros</Link>
          </nav>
        </div>

        <div className={styles.col}>
          <h4>Redes Sociales</h4>
          <div className={styles.socialLinks}>
            <a href="#" aria-label="Instagram">@elitestore</a>
            <a href="#" aria-label="Facebook">Elite Store</a>
          </div>
        </div>
      </div>
      
      <div className={styles.bottom}>
        <p>&copy; Elite Store 2026. Todos los derechos reservados.</p>
      </div>
    </footer>
  )
}
