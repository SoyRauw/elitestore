import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { ShoppingBag, Search, SlidersHorizontal, X } from 'lucide-react'
import { useProducts, useCategories } from '../../hooks/useProducts'
import { formatVariantLabel, getVariantModels } from '../../lib/sku'
import ProductCard from '../../components/store/ProductCard'
import CatalogFilters from '../../components/store/CatalogFilters'
import { usePageMeta } from '../../lib/seo'
import styles from './Catalog.module.css'

const PRODUCTS_PER_PAGE = 24

export default function Catalog() {
  usePageMeta({
    title: 'Catálogo | Elite Store',
    description: 'Explora el catálogo de Elite Store: pijamas, conjuntos, blusas, calzado y accesorios elegantes para damas.',
    path: '/catalog',
  })

  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSize, setSelectedSize] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [visibleCount, setVisibleCount] = useState(PRODUCTS_PER_PAGE)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const { categories } = useCategories()
  const { products, loading } = useProducts()
  const sentinelRef = useRef(null)

  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const availableProducts = useMemo(
    () => products.filter((product) => getVariantModels(product).length > 0),
    [products]
  )

  const sizesByCategory = useMemo(() => {
    const disabled = new Set(
      categories.filter((category) => category.sizes_enabled === false).map((category) => category.id)
    )
    const map = {}
    availableProducts.forEach((product) => {
      if (disabled.has(product.category_id)) return
      const set = map[product.category_id] || (map[product.category_id] = new Set())
      ;(product.product_variants || []).forEach((variant) => {
        if (variant.size && (variant.stock || 0) > 0) set.add(variant.size)
      })
    })
    const result = {}
    Object.entries(map).forEach(([categoryId, set]) => {
      result[categoryId] = [...set].sort((a, b) =>
        String(a).localeCompare(String(b), 'es', { numeric: true })
      )
    })
    return result
  }, [availableProducts, categories])

  const selectedCategoryData = categories.find((category) => category.id === selectedCategory)
  const selectedCategorySizes = useMemo(
    () => (selectedCategory ? (sizesByCategory[selectedCategory] || []) : []),
    [selectedCategory, sizesByCategory]
  )
  const selectedSizeLabel = selectedCategoryData?.size_label || 'Talla'

  useEffect(() => {
    if (!selectedCategory) {
      if (selectedSize) setSelectedSize('')
      return
    }
    if (selectedCategoryData?.sizes_enabled === false) {
      if (selectedSize) setSelectedSize('')
      return
    }
    if (selectedSize && !selectedCategorySizes.includes(selectedSize)) {
      setSelectedSize('')
    }
  }, [selectedCategory, selectedSize, selectedCategoryData, selectedCategorySizes])

  const filtered = useMemo(() => {
    let list = [...availableProducts]

    if (selectedCategory) {
      list = list.filter((product) => product.category_id === selectedCategory)
    }

    if (selectedSize) {
      list = list.filter((product) =>
        (product.product_variants || []).some(
          (variant) => variant.size === selectedSize && (variant.stock || 0) > 0
        )
      )
    }

    const query = debouncedSearch.trim().toLowerCase()
    if (query) {
      list = list.filter((product) => {
        const matchesName = product.name?.toLowerCase().includes(query)
        const matchesSku = product.sku?.toLowerCase().includes(query)
        const matchesVariant = (product.product_variants || []).some((variant) => {
          const label = formatVariantLabel(variant, product.categories?.size_label).toLowerCase()
          return label.includes(query) || variant.sku?.toLowerCase().includes(query)
        })
        return matchesName || matchesSku || matchesVariant
      })
    }

    const min = parseFloat(minPrice)
    const max = parseFloat(maxPrice)
    if (!Number.isNaN(min) || !Number.isNaN(max)) {
      list = list.filter((product) => {
        const variants = product.product_variants || []
        const prices = variants.length > 0
          ? variants.map((variant) => variant.price).filter(Boolean)
          : [product.price].filter(Boolean)
        return prices.some((price) => {
          if (!Number.isNaN(min) && price < min) return false
          if (!Number.isNaN(max) && price > max) return false
          return true
        })
      })
    }

    list.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0)
      }
      const minPriceOf = (product) => {
        const variants = product.product_variants || []
        const prices = variants.length > 0
          ? variants.map((variant) => variant.price).filter(Boolean)
          : [product.price].filter(Boolean)
        return prices.length ? Math.min(...prices) : 0
      }
      const priceA = minPriceOf(a)
      const priceB = minPriceOf(b)
      if (sortBy === 'price_asc') return priceA - priceB
      if (sortBy === 'price_desc') return priceB - priceA
      return 0
    })

    return list
  }, [
    availableProducts,
    selectedCategory,
    selectedSize,
    debouncedSearch,
    minPrice,
    maxPrice,
    sortBy,
  ])

  useEffect(() => {
    setVisibleCount(PRODUCTS_PER_PAGE)
  }, [selectedCategory, selectedSize, debouncedSearch, minPrice, maxPrice, sortBy])

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

  const categoryName = categories.find((category) => category.id === selectedCategory)?.name
  const activeFilterCount = [selectedCategory, selectedSize, minPrice, maxPrice].filter(Boolean).length
  const hasActiveFilters = activeFilterCount > 0 || sortBy !== 'newest'

  const clearFilters = () => {
    setSelectedCategory('')
    setSelectedSize('')
    setSortBy('newest')
    setMinPrice('')
    setMaxPrice('')
    setSearchQuery('')
  }

  const applyFilters = (draft) => {
    const nextCategory = draft.category || ''
    const nextSizes = nextCategory ? (sizesByCategory[nextCategory] || []) : []
    const nextSize = nextCategory && nextSizes.includes(draft.size) ? draft.size : ''
    setSelectedCategory(nextCategory)
    setSelectedSize(nextSize)
    setMinPrice(draft.minPrice ?? '')
    setMaxPrice(draft.maxPrice ?? '')
    setSortBy(draft.sort || 'newest')
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
        <div className={styles.topBar}>
          <div className={styles.searchWrap}>
            <Search size={16} className={styles.searchIcon} />
            <input
              className={`input ${styles.searchInput}`}
              placeholder="Buscar por nombre, SKU o variante..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              id="catalog-search"
            />
          </div>
          <button
            type="button"
            className={styles.filterBtn}
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal size={16} />
            Filtros
            {activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}
          </button>
        </div>

        {hasActiveFilters && (
          <div className={styles.activeFilters}>
            {selectedCategory && (
              <button
                type="button"
                className={styles.activeChip}
                onClick={() => { setSelectedCategory(''); setSelectedSize('') }}
              >
                {categoryName || 'Categoría'} <X size={12} />
              </button>
            )}
            {selectedSize && (
              <button type="button" className={styles.activeChip} onClick={() => setSelectedSize('')}>
                {selectedSizeLabel} {selectedSize} <X size={12} />
              </button>
            )}
            {(minPrice || maxPrice) && (
              <button
                type="button"
                className={styles.activeChip}
                onClick={() => { setMinPrice(''); setMaxPrice('') }}
              >
                ${minPrice || '0'} – ${maxPrice || '∞'} <X size={12} />
              </button>
            )}
            <button type="button" className={styles.clearAll} onClick={clearFilters}>
              Limpiar todo
            </button>
          </div>
        )}

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
            {visibleProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className={styles.sentinel}>
              <span>Cargando más productos...</span>
            </div>
          )}
        </>
      )}

      <CatalogFilters
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        categories={categories}
        sizesByCategory={sizesByCategory}
        value={{
          category: selectedCategory,
          size: selectedSize,
          minPrice,
          maxPrice,
          sort: sortBy,
        }}
        onApply={applyFilters}
      />
    </motion.main>
  )
}
