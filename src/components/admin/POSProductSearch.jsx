import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, ShoppingBag, Package, Tag } from 'lucide-react'
import { formatVariantLabel, getVariantImage } from '../../lib/sku'
import styles from './POSProductSearch.module.css'

export default function POSProductSearch({ onAdd }) {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!query.trim()) {
      setProducts([])
      return
    }

    const timeout = setTimeout(async () => {
      setLoading(true)
      const search = query.trim().toLowerCase()
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(*), product_variants(*)')
        .eq('active', true)
        .or(`name.ilike.%${search}%,id.ilike.%${search}%`)
        .limit(20)

      if (error) {
        console.error('Error buscando productos:', error)
        setProducts([])
      } else {
        const filtered = (data || []).map(product => {
          const variants = (product.product_variants || [])
            .filter(v => v.stock > 0)
            .filter(v => {
              const matchesSku = v.sku?.toLowerCase().includes(search)
              const matchesBarcode = v.barcode?.toLowerCase().includes(search)
              return matchesSku || matchesBarcode || true
            })
          return { ...product, product_variants: variants }
        }).filter(p => p.product_variants.length > 0)

        setProducts(filtered)
      }
      setLoading(false)
    }, 250)

    return () => clearTimeout(timeout)
  }, [query])

  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      const search = query.trim().toUpperCase()
      for (const product of products) {
        const variant = product.product_variants.find(
          v => v.id?.toUpperCase() === search || v.sku?.toUpperCase() === search || v.barcode?.toUpperCase() === search
        )
        if (variant) {
          onAdd(product, variant)
          setQuery('')
          return
        }
      }
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchWrap}>
        <Search size={20} className={styles.searchIcon} />
        <input
          ref={inputRef}
          className={styles.searchInput}
          type="text"
          placeholder="Buscar por nombre, SKU o escanear código..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleBarcodeScan}
          autoFocus
        />
      </div>

      {!query.trim() ? (
        <div className={styles.emptyState}>
          <Package size={48} />
          <p>Escribe el nombre de un producto o escanea un código</p>
        </div>
      ) : loading ? (
        <div className={styles.emptyState}><p>Buscando...</p></div>
      ) : products.length === 0 ? (
        <div className={styles.noResults}>No se encontraron productos con stock</div>
      ) : (
        <div className={styles.results}>
          {products.map((product) => (
            <div key={product.id} className={styles.productCard}>
              <div className={styles.productHeader}>
                <div className={styles.productInfo}>
                  <div className={styles.productCategory}>
                    <Tag size={12} />
                    {product.categories?.name || 'Sin categoría'}
                  </div>
                  <h4 className={styles.productName}>{product.name}</h4>
                  <span className={styles.productSku}>SKU: {product.id}</span>
                </div>
              </div>
              <div className={styles.variantsBlock}>
                <div className={styles.variantsGrid}>
                  {product.product_variants.map((variant) => (
                    <button
                      key={variant.id}
                      className={styles.variantCard}
                      onClick={() => { onAdd(product, variant); setQuery('') }}
                      title={formatVariantLabel(variant, product.categories?.size_label)}
                    >
                      <div className={styles.variantThumb}>
                        {getVariantImage(product, variant) ? (
                          <img src={getVariantImage(product, variant)} alt={formatVariantLabel(variant, product.categories?.size_label)} />
                        ) : (
                          <ShoppingBag size={20} />
                        )}
                      </div>
                      <div className={styles.variantCardInfo}>
                        <span className={styles.variantLabel}>{formatVariantLabel(variant, product.categories?.size_label)}</span>
                        <span className={styles.variantPrice}>${variant.price || product.price || 0}</span>
                        <span className={styles.variantStock}>Stock {variant.stock}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
