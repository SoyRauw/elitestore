import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Filter, Search } from 'lucide-react'
import { useProducts, useCategories } from '../../hooks/useProducts'
import { useCartStore } from '../../store/cartStore'
import ProductDetailModal from '../../components/store/ProductDetailModal'
import styles from './Catalog.module.css'

export default function Catalog() {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [cartNotif, setCartNotif] = useState(null)
  const [detailProduct, setDetailProduct] = useState(null)

  const { categories } = useCategories()
  const { products, loading } = useProducts({ category_id: selectedCategory })

  const addItem = useCartStore((s) => s.addItem)

  const filtered = products.filter((p) => {
    return !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const handleAdd = (product, size) => {
    addItem(product, size)
    setCartNotif(product.id)
    setTimeout(() => setCartNotif(null), 2000)
  }

  const handleOpenDetail = (product) => {
    setDetailProduct(product)
  }

  const handleCloseDetail = () => {
    setDetailProduct(null)
  }

  return (
    <motion.main className={styles.page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Colección</h1>
        <p className={styles.pageSubtitle}>Elegancia que te abraza</p>
      </div>

      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            className={`input ${styles.searchInput}`}
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="catalog-search"
          />
        </div>

        <div className={styles.sizeFilter} style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '4px' }}>
          <Filter size={16} />
          <button
            className={`${styles.sizeChip} ${!selectedCategory ? styles.sizeActive : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`${styles.sizeChip} ${selectedCategory === c.id ? styles.sizeActive : ''}`}
              onClick={() => setSelectedCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`skeleton ${styles.skeletonCard}`} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div className={styles.empty} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <ShoppingBag size={48} style={{ color: 'var(--color-secondary)' }} />
          <p>No hay productos disponibles aún</p>
          <span>Próximamente nuevas colecciones 🌙</span>
        </motion.div>
      ) : (
        <motion.div className={styles.grid} layout>
          <AnimatePresence>
            {filtered.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={handleAdd}
                onOpenDetail={handleOpenDetail}
                justAdded={cartNotif === product.id}
                index={i}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Product Detail Modal */}
      <AnimatePresence>
        {detailProduct && (
          <ProductDetailModal
            product={detailProduct}
            onClose={handleCloseDetail}
            onAdd={handleAdd}
            justAdded={cartNotif === detailProduct?.id}
          />
        )}
      </AnimatePresence>
    </motion.main>
  )
}

function ProductCard({ product, onAdd, onOpenDetail, justAdded, index }) {
  const hasImages = product.images && product.images.length > 0
  const imageCount = product.images?.length || 0

  const availableSizes = product.product_sizes
    ? product.product_sizes.filter(ps => ps.stock > 0).map(ps => ps.size)
    : []

  const [selectedSize, setSelectedSize] = useState(availableSizes.length > 0 ? availableSizes[0] : null)
  const isOutOfStock = availableSizes.length === 0

  return (
    <motion.article
      className={styles.card}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      whileHover={{ y: -6 }}
      layout
    >
      {/* Image area — click opens modal */}
      <div
        className={styles.imageWrap}
        onClick={() => onOpenDetail(product)}
        style={{ cursor: 'pointer' }}
      >
        {hasImages ? (
          <img src={product.images[0]} alt={product.name} className={styles.image} />
        ) : (
          <div className={styles.placeholder}><ShoppingBag size={32} /></div>
        )}

        {product.featured && <span className={styles.featuredBadge}>Destacado</span>}
        {isOutOfStock && (
          <span className={styles.featuredBadge} style={{ background: '#dc2626', top: 'auto', bottom: '10px', right: '10px', left: 'auto' }}>
            Agotado
          </span>
        )}

        {/* Multi-image indicator */}
        {imageCount > 1 && (
          <span className={styles.imgCountBadge}>
            📷 {imageCount}
          </span>
        )}

        {/* "Ver detalles" hover overlay */}
        <div className={styles.viewOverlay}>
          <span>Ver detalles</span>
        </div>
      </div>

      <div className={styles.cardBody}>
        <span style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
          {product.categories?.name}
        </span>
        <h3
          className={styles.cardName}
          onClick={() => onOpenDetail(product)}
          style={{ cursor: 'pointer' }}
        >
          {product.name}
        </h3>
        {product.description && <p className={styles.cardDesc}>{product.description}</p>}

        <div className={styles.sizes}>
          {availableSizes.map((s) => (
            <button
              key={s}
              className={`${styles.sizeBtn} ${selectedSize === s ? styles.sizeBtnActive : ''}`}
              onClick={() => setSelectedSize(s)}
            >
              {s}
            </button>
          ))}
          {isOutOfStock && <span style={{ fontSize: '13px', color: 'var(--color-dark-soft)' }}>Sin stock</span>}
        </div>

        <div className={styles.cardFooter}>
          <span className={styles.price}>${product.price.toFixed(2)}</span>
          <motion.button
            className={`${styles.addToCart} ${justAdded ? styles.added : ''}`}
            onClick={() => onAdd(product, selectedSize)}
            whileTap={{ scale: 0.9 }}
            disabled={isOutOfStock || !selectedSize}
          >
            {justAdded ? '✓ Agregado' : <><ShoppingBag size={15} /> Agregar</>}
          </motion.button>
        </div>
      </div>
    </motion.article>
  )
}
