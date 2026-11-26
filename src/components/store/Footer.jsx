import { Link } from 'react-router-dom'
import { useStorefront } from '../../context/StorefrontContext'
import { WHATSAPP_NUMBER } from '../../lib/whatsapp'
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from './SocialIcons'
import styles from './Footer.module.css'

export default function Footer() {
  const storefront = useStorefront()
  const waText = encodeURIComponent(`Hola ${storefront.fullName} 👋, quiero más información`)

  return (
    <footer className={`${styles.footer} ${styles[storefront.theme] || ''}`}>
      <div className={styles.inner}>
        <div className={styles.col}>
          <h3 className={styles.logoText}>{storefront.footerTitle}</h3>
          <p className={styles.description}>{storefront.footerDescription}</p>
        </div>

        <div className={styles.col}>
          <h4>Accesos rápidos</h4>
          <nav className={styles.nav}>
            {storefront.footerLinks.map((link) => (
              <Link key={link.to} to={link.to}>{link.label}</Link>
            ))}
          </nav>
        </div>

        <div className={styles.col}>
          <h4>Redes Sociales</h4>
          <div className={styles.socialLinks}>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
            >
              <WhatsAppIcon /> WhatsApp
            </a>
            <a
              href={storefront.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <InstagramIcon /> {storefront.instagramHandle}
            </a>
            {storefront.tiktok && (
              <a
                href={storefront.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok"
              >
                <TikTokIcon /> {storefront.tiktokHandle}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className={styles.bottom}>
        <p>&copy; Elite Store 2026. Todos los derechos reservados.</p>
      </div>
    </footer>
  )
}
