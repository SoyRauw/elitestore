import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ShoppingBag, Filter, Search, SlidersHorizontal, X } from 'lucide-react'
import { useProducts, useCategories } from '../../hooks/useProducts'
import { useCartStore } from '../../store/cartStore'
import { formatVariantLabel, getVariantModels } from '../../lib/sku'
import ProductCard from '../../components/store/ProductCard'
import styles from './Catalog.module.css'

const PRODUCTS_PER_PAGE = 24

export default function Catalog() {
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [cartNotif, setCartNotif] = useState(null)
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE)

  const { categories } = useCategories()
  const { products, loading } = useProducts({ category_id: selectedCategory })
  const addItem = useCartStore((s) => s.addItem)
  const sentinelRef = useRef(null)

  // Debounce filters
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [debouncedMinPrice, setDebouncedMinPrice] = useState('')
  const [debouncedMaxPrice, setDebouncedMaxPrice] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setDebouncedMinPrice(minPrice)
      setDebouncedMaxPrice(maxPrice)
    }, 250)
    return () => clearTimeout(timer)
  }, [searchQuery, minPrice, maxPrice])

  const hasActiveFilters = debouncedSearch || debouncedMinPrice || debouncedMaxPrice || sortBy !== 'newest'

  const availableProducts = useMemo(() => {
    return products.filter((p) => getVariantModels(p).length > 0)
  }, [products])

  const filtered = useMemo(() => {
    let list = [...availableProducts]
    const q = debouncedSearch.trim().toLowerCase()

    if (q) {
      list = list.filter((p) => {
        const matchesName = p.name?.toLowerCase().includes(q)
        const matchesSku = p.sku?.toLowerCase().includes(q)
        const matchesVariant = p.product_variants?.some((v) => {
          const label = formatVariantLabel(v, p.categories?.size_label).toLowerCase()
          return label.includes(q) || v.sku?.toLowerCase().includes(q)
        })
        return matchesName || matchesSku || matchesVariant
      })
    }

    const min = parseFloat(debouncedMinPrice)
    const max = parseFloat(debouncedMaxPrice)
    if (!isNaN(min) || !isNaN(max)) {
      list = list.filter((p) => {
        const variants = p.product_variants || []
        const prices = variants.length > 0
          ? variants.map((v) => v.price).filter(Boolean)
          : [p.price].filter(Boolean)
        return prices.some((price) => {
          if (!isNaN(min) && price < min) return false
          if (!isNaN(max) && price > max) return false
          return true
        })
      })
    }

    list.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0)
      }
      const getMinPrice = (product) => {
        const variants = product.product_variants || []
        const prices = variants.length > 0
          ? variants.map((v) => v.price).filter(Boolean)
          : [product.price].filter(Boolean)
        return prices.length ? Math.min(...prices) : 0
      }
      const priceA = getMinPrice(a)
      const priceB = getMinPrice(b)
      if (sortBy === 'price_asc') return priceA - priceB
      if (sortBy === 'price_desc') return priceB - priceA
      return 0
    })

    return list
  }, [availableProducts, debouncedSearch, debouncedMinPrice, debouncedMaxPrice, sortBy])

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(PRODUCTS_PER_PAGE)
  }, [selectedCategory, debouncedSearch, debouncedMinPrice, debouncedMaxPrice, sortBy])

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || visibleCount >= filtered.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PRODUCTS_PER_PAGE, filtered.length))
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [filtered.length, visibleCount])

  const handleAdd = useCallback((product, variant) => {
    addItem(product, variant)
    setCartNotif(variant.id)
    setTimeout(() => setCartNotif(null), 2000)
  }, [addItem])

  const clearFilters = () => {
    setSearchQuery('')
    setSortBy('newest')
    setMinPrice('')
    setMaxPrice('')
  }

  const visibleProducts = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  return (
    <motion.main className={styles.page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Colección</h1>
        <p className={styles.pageSubtitle}>Elegancia que te abraza</p>
      </div>

      <div className={styles.filters}>
        {/* Search */}
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            className={`input ${styles.searchInput}`}
            placeholder="Buscar por nombre, SKU o variante..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="catalog-search"
          />
        </div>

        {/* Categories */}
        <div className={styles.sizeFilter}>
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

        {/* Sort & price */}
        <div className={styles.filterRow}>
          <div className={styles.sortWrap}>
            <SlidersHorizontal size={14} />
            <select
              className={`input ${styles.sortSelect}`}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Más recientes</option>
              <option value="price_asc">Precio: menor a mayor</option>
              <option value="price_desc">Precio: mayor a menor</option>
            </select>
          </div>

          <div className={styles.priceWrap}>
            <span>Precio:</span>
            <input
              type="number"
              className={`input ${styles.priceInput}`}
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              min="0"
            />
            <span>-</span>
            <input
              type="number"
              className={`input ${styles.priceInput}`}
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              min="0"
            />
          </div>

          {hasActiveFilters && (
            <button className={styles.clearBtn} onClick={clearFilters}>
              <X size={14} /> Limpiar
            </button>
          )}
        </div>

        <p className={styles.resultsCount}>
          {loading ? 'Cargando...' : `${filtered.length} producto${filtered.length !== 1 ? 's' : ''}`}
        </p>
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
          <p>No hay productos para los filtros seleccionados</p>
          <button className={styles.emptyCta} onClick={clearFilters}>Limpiar filtros</button>
        </motion.div>
      ) : (
        <>
          <div className={styles.grid}>
            {visibleProducts.map((product, i) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={handleAdd}
                justAdded={cartNotif}
                index={i}
              />
            ))}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className={styles.sentinel}>
              <span>Cargando más productos...</span>
            </div>
          )}
        </>
      )}
    </motion.main>
  )
}
