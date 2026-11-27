import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import GlassHeader from '../../components/store/GlassHeader'
import PortalFooter from '../../components/store/PortalFooter'
import CartDrawer from '../../components/store/CartDrawer'
import { useCartStore } from '../../store/cartStore'
import { usePageMeta } from '../../lib/seo'
import { PORTAL_STORES } from '../../lib/storefronts'
import fondoImg from '../../assets/fondo.webp'
import menMarkLight from '../../assets/portal/men-mark-light.png'
import usaLogo from '../../assets/portal/usa-logo.webp'
import styles from './StorePortal.module.css'

const DEFAULT_ACCENT = '#C4788A'

const GLASS_BLUR = {
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

export default function StorePortal() {
  const [cartOpen, setCartOpen] = useState(false)
  const count = useCartStore((s) => s.items.reduce((sum, item) => sum + item.quantity, 0))

  usePageMeta({
    title: "Elite Store | Women, Men's y USA Super Store",
    description:
      "Descubre las tres tiendas de Elite Store: Women, Men's y USA Super Store. Moda, tendencias y la manera más fácil y económica de comprar.",
    path: '/',
  })

  return (
    <main className={styles.page} style={{ '--portal-accent': DEFAULT_ACCENT }}>
      <h1 className="sr-only">Elite Store | Women, Men&apos;s y USA Super Store</h1>

      <GlassHeader
        variant="dark"
        eyebrow="ELITE STORE"
        title="NUESTRAS TIENDAS"
        accent={DEFAULT_ACCENT}
        homePath="/"
        onCartOpen={() => setCartOpen(true)}
        cartCount={count}
      />

      <section className={styles.cards} aria-label="Tiendas de Elite Store">
        {PORTAL_STORES.map((store) => (
          <Link
            key={store.id}
            to={store.homePath}
            className={[styles.card, styles[store.id]].filter(Boolean).join(' ')}
            aria-label={`Entrar a ${store.fullName}`}
          >
            <div className={styles.bgLayer} aria-hidden="true">
              {store.id === 'elite' ? (
                <img
                  src={fondoImg}
                  alt=""
                  className={styles.bgImage}
                  fetchPriority="high"
                  draggable={false}
                />
              ) : (
                <>
                  <span className={styles.bgPattern} />
                  <img
                    src={store.id === 'men' ? menMarkLight : usaLogo}
                    alt=""
                    className={styles.watermark}
                    draggable={false}
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
                  <span className={styles.badge} style={GLASS_BLUR}>{store.portalBadge}</span>
                )}
              </div>

              <div className={styles.logoWrap}>
                <img
                  src={store.portalLogo}
                  alt={store.fullName}
                  className={styles.logo}
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
              </div>

              <div className={styles.bottom}>
                <span className={styles.label}>{store.portalLabel}</span>
                <span className={styles.tagline}>{store.portalTagline}</span>
                <span className={styles.cta} style={GLASS_BLUR}>
                  {store.portalCta} <ArrowRight size={14} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <PortalFooter />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        browseLabel="Ver tiendas"
        onBrowse={() => setCartOpen(false)}
        theme="glass"
      />
    </main>
  )
}
