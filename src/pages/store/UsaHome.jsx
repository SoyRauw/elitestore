import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Search,
  MessageCircle,
  Store,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useProducts, useCategories } from '../../hooks/useProducts'
import { getVariantModels } from '../../lib/sku'
import { getCategoryVisual } from '../../lib/categoryVisuals'
import { usePageMeta } from '../../lib/seo'
import ProductCard from '../../components/store/ProductCard'
import DayDiscountsBanner from '../../components/store/DayDiscountsBanner'
import usaLogo from '../../assets/portal/usa-logo.webp'
import styles from './UsaHome.module.css'

const FEATURED_COUNT = 8

export default function UsaHome() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { products, loading } = useProducts({ storeId: 'usa' })
  const { categories } = useCategories('usa')

  usePageMeta({
    title: 'USA Super Store | La manera más fácil y económica',
    description:
      'Compra comida, medicamentos, belleza, hogar y más en USA Super Store. Productos importados, pedidos por WhatsApp y atención personalizada.',
    path: '/usa',
  })

  const availableProducts = useMemo(
    () => products.filter((product) => getVariantModels(product).length > 0),
    [products]
  )

  const categoriesWithProducts = useMemo(() => {
    const counts = new Map()
    availableProducts.forEach((product) => {
      if (!product.category_id) return
      counts.set(product.category_id, (counts.get(product.category_id) || 0) + 1)
    })
    return categories
      .filter((category) => counts.has(category.id))
      .map((category) => ({
        ...category,
        count: counts.get(category.id) || 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [availableProducts, categories])

  const featuredProducts = useMemo(() => {
    return [...availableProducts]
      .sort((a, b) => (b.images?.length || 0) - (a.images?.length || 0))
      .slice(0, FEATURED_COUNT)
  }, [availableProducts])

  const handleSearch = (event) => {
    event.preventDefault()
    const term = query.trim()
    navigate(term ? `/usa/catalog?q=${encodeURIComponent(term)}` : '/usa/catalog')
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.heroPattern} aria-hidden="true" />
        <span className={styles.heroGlow} aria-hidden="true" />

        <div className={styles.heroInner}>
          <motion.div
            className={styles.heroCopy}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={styles.eyebrow}>
              <Sparkles size={14} /> USA SUPER STORE
            </span>
            <h1 className={styles.title}>
              La manera más <span className={styles.titleAccent}>fácil y económica</span>
            </h1>
            <p className={styles.subtitle}>
              Comida, medicamentos, belleza y hogar. Compra online, pide por
              WhatsApp y recibe con la atención que mereces.
            </p>

            <form className={styles.search} onSubmit={handleSearch} role="search">
              <Search size={18} className={styles.searchIcon} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="¿Qué estás buscando?"
                aria-label="Buscar productos en USA Super Store"
              />
              <button type="submit">Buscar</button>
            </form>

            <div className={styles.heroActions}>
              <Link to="/usa/catalog" className={styles.primaryBtn}>
                Ver catálogo <ArrowRight size={16} />
              </Link>
              <a
                href="#categorias"
                className={styles.secondaryBtn}
              >
                Explorar categorías
              </a>
            </div>
          </motion.div>

          <motion.div
            className={styles.logoStage}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={styles.logoHalo} aria-hidden="true" />
            <img src={usaLogo} alt="USA Super Store" className={styles.heroLogo} />
            <span className={styles.onlineBadge}>TIENDA ONLINE · NUEVA</span>
          </motion.div>
        </div>
      </section>

      <DayDiscountsBanner />

      <section className={styles.categoriesSection} id="categorias">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>Compra por categoría</span>
            <h2 className={styles.sectionTitle}>Todo lo que necesitas</h2>
          </div>
          <Link to="/usa/catalog" className={styles.sectionLink}>
            Ver todo <ArrowRight size={15} />
          </Link>
        </div>

        <div className={styles.categoryGrid}>
          {categoriesWithProducts.slice(0, 8).map((category, index) => {
            const visual = getCategoryVisual(category.name)
            const Icon = visual.icon
            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: index * 0.04 }}
              >
                <Link
                  to={`/usa/catalog?category=${encodeURIComponent(category.id)}`}
                  className={styles.categoryCard}
                  style={{
                    '--cat-from': visual.from,
                    '--cat-to': visual.to,
                    '--cat-accent': visual.accent,
                  }}
                >
                  <span className={styles.categoryTop}>
                    <Icon size={24} />
                    <ArrowRight size={16} className={styles.categoryArrow} />
                  </span>
                  <span className={styles.categoryBottom}>
                    <strong>{visual.label}</strong>
                    <small>{category.count} productos</small>
                  </span>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </section>

      <section className={styles.featuredSection}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>Selección USA</span>
            <h2 className={styles.sectionTitle}>Productos destacados</h2>
          </div>
          <Link to="/usa/catalog" className={styles.sectionLink}>
            Ver catálogo <ArrowRight size={15} />
          </Link>
        </div>

        {loading ? (
          <div className={styles.productGrid}>
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className={`skeleton ${styles.skeletonCard}`} />
            ))}
          </div>
        ) : featuredProducts.length > 0 ? (
          <div className={styles.productGrid}>
            {featuredProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>Estamos cargando el catálogo. Vuelve pronto.</p>
        )}

        <div className={styles.catalogCta}>
          <Link to="/usa/catalog" className={styles.primaryBtn}>
            Ver catálogo completo <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className={styles.trust}>
        <div className={styles.trustGrid}>
          <div className={styles.trustItem}>
            <span className={styles.trustIcon}><MessageCircle size={20} /></span>
            <strong>Pedidos por WhatsApp</strong>
            <p>Te atendemos directo, sin complicaciones.</p>
          </div>
          <div className={styles.trustItem}>
            <span className={styles.trustIcon}><Store size={20} /></span>
            <strong>Retiro en tienda</strong>
            <p>Compra online y retira cuando esté listo.</p>
          </div>
          <div className={styles.trustItem}>
            <span className={styles.trustIcon}><ShieldCheck size={20} /></span>
            <strong>Compra confiable</strong>
            <p>Productos seleccionados y atención personalizada.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
