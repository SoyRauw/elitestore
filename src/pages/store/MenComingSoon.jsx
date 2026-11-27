import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import GlassHeader from '../../components/store/GlassHeader'
import CartDrawer from '../../components/store/CartDrawer'
import { InstagramIcon } from '../../components/store/SocialIcons'
import { useCartStore } from '../../store/cartStore'
import { usePageMeta } from '../../lib/seo'
import { STOREFRONTS } from '../../lib/storefronts'
import { WHATSAPP_NUMBER } from '../../lib/whatsapp'
import menLogoLight from '../../assets/portal/men-logo-light.png'
import menMarkDark from '../../assets/portal/men-mark-dark.png'
import styles from './MenComingSoon.module.css'

const store = STOREFRONTS.men
const waText = encodeURIComponent("Hola Elite Store Men's 👔, quiero saber cuándo abren")

export default function MenComingSoon() {
  const [cartOpen, setCartOpen] = useState(false)
  const count = useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0))

  usePageMeta({
    title: "Elite Store Men's | Muy pronto",
    description:
      "Elite Store Men's está por abrir. Moda masculina, estilo y tendencias. Síguenos en Instagram y escríbenos por WhatsApp.",
    path: '/men',
  })

  return (
    <main className={styles.page}>
      <GlassHeader
        logoSrc={menMarkDark}
        logoAlt="Elite Store Men's"
        title="ELITE STORE MEN'S"
        accent={store.accent}
        homePath="/men"
        onCartOpen={() => setCartOpen(true)}
        cartCount={count}
      />

      <span className={styles.bgPattern} aria-hidden="true" />
      <img src={menLogoLight} alt="" className={styles.watermark} aria-hidden="true" />
      <span className={styles.glow} aria-hidden="true" />

      <section className={styles.hero}>
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        >
          <img src={menLogoLight} alt="Elite Store Men's" className={styles.logo} />
          <span className={styles.badge}>PRÓXIMAMENTE</span>
          <h1 className={styles.title}>Muy pronto</h1>
          <p className={styles.subtitle}>
            Una nueva forma de vestir tu estilo. Estamos preparando la tienda
            masculina de Elite Store.
          </p>

          <div className={styles.actions}>
            <a
              href={store.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.igBtn}
            >
              <InstagramIcon /> {store.instagramHandle}
            </a>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.waBtn}
            >
              <MessageCircle size={17} /> WhatsApp
            </a>
          </div>

          <Link to="/" className={styles.backLink}>
            <ArrowLeft size={15} /> Volver a las tiendas
          </Link>
        </motion.div>
      </section>

      <footer className={styles.footer}>
        <span>© 2026 Elite Store Men&apos;s</span>
        <div className={styles.footerLinks}>
          <a href={store.instagram} target="_blank" rel="noopener noreferrer">
            <InstagramIcon /> Instagram
          </a>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={14} /> WhatsApp
          </a>
        </div>
      </footer>

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        browseLabel="Ver tiendas"
        browsePath="/"
        theme="men"
      />
    </main>
  )
}
