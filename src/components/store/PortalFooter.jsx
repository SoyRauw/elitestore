import { STOREFRONTS } from '../../lib/storefronts'
import { WHATSAPP_NUMBER } from '../../lib/whatsapp'
import { InstagramIcon, WhatsAppIcon } from './SocialIcons'
import styles from './PortalFooter.module.css'

const STORES = [STOREFRONTS.elite, STOREFRONTS.men, STOREFRONTS.usa]

export default function PortalFooter() {
  const waText = encodeURIComponent('Hola Elite Store 👋, quiero información de las tiendas')

  return (
    <footer className={styles.footer}>
      <span className={styles.copy}>© 2026 Elite Store</span>

      <div className={styles.socials}>
        {STORES.map((store) => (
          <a
            key={store.id}
            href={store.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialLink}
            aria-label={`Instagram de ${store.fullName}: ${store.instagramHandle}`}
            title={store.instagramHandle}
          >
            <InstagramIcon />
            <span>{store.shortName}</span>
          </a>
        ))}

        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.socialLink}
          aria-label="WhatsApp de Elite Store"
        >
          <WhatsAppIcon />
          <span>WhatsApp</span>
        </a>
      </div>
    </footer>
  )
}
