import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import GlassHeader from '../../components/store/GlassHeader'
import PortalFooter from '../../components/store/PortalFooter'
import CartDrawer from '../../components/store/CartDrawer'
import { useCartStore } from '../../store/cartStore'
import { usePageMeta } from '../../lib/seo'
import { PORTAL_STORES } from '../../lib/storefronts'
import fondoImg from '../../assets/fondo.webp'
import womenLogo from '../../assets/logo.png'
import menMarkLight from '../../assets/portal/men-mark-light.png'
import usaLogo from '../../assets/portal/usa-logo.webp'
import styles from './StorePortal.module.css'

const MotionLink = motion.create(Link)

const DEFAULT_ACCENT = '#C4788A'

export default function StorePortal() {
  const [cartOpen, setCartOpen] = useState(false)
  const [hovered, setHovered] = useState(null)
  const count = useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0))

  usePageMeta({
    title: "Elite Store | Women, Men's y USA Super Store",
    description:
      "Descubre las tres tiendas de Elite Store: Women, Men's y USA Super Store. Moda, tendencias y la manera más fácil y económica de comprar.",
    path: '/',
  })

  const hoveredStore = PORTAL_STORES.find((store) => store.id === hovered)
  const accent = hoveredStore?.accent || DEFAULT_ACCENT

  return (
    <main className={styles.page} style={{ '--portal-accent': accent }}>
      <h1 className="sr-only">Elite Store | Women, Men&apos;s y USA Super Store</h1>

      <GlassHeader
        logoSrc={womenLogo}
        logoAlt="Elite Store"
        title="ELITE STORE"
        accent={accent}
        homePath="/"
        onCartOpen={() => setCartOpen(true)}
        cartCount={count}
      />

      <section className={styles.cards} aria-label="Tiendas de Elite Store">
        {PORTAL_STORES.map((store, index) => {
          const isDimmed = hovered && hovered !== store.id
          return (
            <MotionLink
              key={store.id}
              to={store.homePath}
              className={[
                styles.card,
                styles[store.id],
                isDimmed ? styles.dimmed : '',
              ].filter(Boolean).join(' ')}
              aria-label={`Entrar a ${store.fullName}`}
              onMouseEnter={() => setHovered(store.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(store.id)}
              onBlur={() => setHovered(null)}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.15 + index * 0.09,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className={styles.bgLayer} aria-hidden="true">
                {store.id === 'elite' ? (
                  <img src={fondoImg} alt="" className={styles.bgImage} fetchPriority="high" />
                ) : (
                  <>
                    <span className={styles.bgPattern} />
                    <img
                      src={store.id === 'men' ? menMarkLight : usaLogo}
                      alt=""
                      className={styles.watermark}
                    />
                  </>
                )}
              </div>
              <span className={styles.overlay} aria-hidden="true" />
              <span className={styles.grain} aria-hidden="true" />

              <div className={styles.content}>
                <div className={styles.topRow}>
                  <span className={styles.index}>{store.portalIndex}</span>
                  {store.portalBadge && (
                    <span className={styles.badge}>{store.portalBadge}</span>
                  )}
                </div>

                <div className={styles.logoWrap}>
                  <img
                    src={store.portalLogo}
                    alt={store.fullName}
                    className={styles.logo}
                    loading="eager"
                    decoding="async"
                  />
                </div>

                <div className={styles.bottom}>
                  <span className={styles.label}>{store.portalLabel}</span>
                  <span className={styles.tagline}>{store.portalTagline}</span>
                  <span className={styles.cta}>
                    {store.portalCta} <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </MotionLink>
          )
        })}
      </section>

      <PortalFooter />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        browseLabel="Ver tiendas"
        onBrowse={() => setCartOpen(false)}
      />
    </main>
  )
}
