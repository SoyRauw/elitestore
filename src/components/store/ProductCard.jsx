import { useState, useEffect, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import {
  getVariantModels,
  getProductPriceRange,
} from '../../lib/sku'
import styles from './ProductCard.module.css'

function ProductCard({ product, onAdd, index = 0, justAdded }) {
  const navigate = useNavigate()
  const models = useMemo(() => getVariantModels(product), [product])
  const priceRange = useMemo(() => getProductPriceRange(product), [product])

  const [selectedModel, setSelectedModel] = useState(models[0] || null)

  useEffect(() => {
    if (models.length > 0 && (!selectedModel || !models.find((m) => m.key === selectedModel.key))) {
      setSelectedModel(models[0])
    }
  }, [models, selectedModel])

  const isOutOfStock = models.length === 0
  const selectedVariant = selectedModel?.firstVariant || null
  const hasMultipleSizes = (selectedModel?.sizes?.length || 0) > 1

  const displayPrice = useMemo(() => {
    if (!selectedModel) return priceRange.min || 0
    return selectedModel.minPrice || 0
  }, [selectedModel, priceRange])

  const displayPriceLabel = hasMultipleSizes ? 'Desde ' : ''

  const visibleModels = models.slice(0, 4)
  const remainingModels = models.length - visibleModels.length

  const handleModelClick = (e, model) => {
    e.stopPropagation()
    setSelectedModel(model)
  }

  const handleMoreClick = (e) => {
    e.stopPropagation()
    navigate(`/product/${product.id}`)
  }

  const handleAdd = (e) => {
    e.stopPropagation()
    if (selectedVariant) onAdd(product, selectedVariant)
  }

  const handleCardClick = () => {
    navigate(`/product/${product.id}`)
  }

  return (
    <article
      className={styles.card}
      style={{ '--delay': `${index * 0.04}s` }}
      onClick={handleCardClick}
    >
      <div className={styles.imageWrap}>
        {selectedModel?.image ? (
          <img
            src={selectedModel.image}
            alt={product.name}
            className={styles.image}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className={styles.placeholder}>
            <ShoppingBag size={32} />
          </div>
        )}

        {product.featured && <span className={styles.featuredBadge}>Destacado</span>}
        {isOutOfStock && <span className={styles.outOfStockBadge}>Agotado</span>}

        <div className={styles.viewOverlay}>
          <span>Ver detalles</span>
        </div>
      </div>

      <div className={styles.body}>
        <span className={styles.category}>{product.categories?.name}</span>
        <h3 className={styles.name}>{product.name}</h3>
        {product.description && <p className={styles.description}>{product.description}</p>}

        {models.length > 0 && (
          <div className={styles.models}>
            {visibleModels.map((model) => {
              const isActive = selectedModel?.key === model.key
              return (
                <button
                  key={model.key}
                  type="button"
                  className={`${styles.modelBtn} ${isActive ? styles.modelBtnActive : ''}`}
                  onClick={(e) => handleModelClick(e, model)}
                  title={model.key}
                >
                  {model.image ? (
                    <img
                      src={model.image}
                      alt={model.key}
                      className={styles.modelThumb}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className={styles.modelLabel}>{model.key}</span>
                  )}
                </button>
              )
            })}
            {remainingModels > 0 && (
              <button
                type="button"
                className={styles.moreBtn}
                onClick={handleMoreClick}
                title={`${remainingModels} modelos más`}
              >
                +{remainingModels}
              </button>
            )}
          </div>
        )}

        <div className={styles.footer}>
          <span className={styles.price}>
            {displayPriceLabel}${displayPrice.toFixed(2)}
          </span>
          <button
            type="button"
            className={`${styles.addBtn} ${justAdded === selectedVariant?.id ? styles.added : ''}`}
            onClick={handleAdd}
            disabled={isOutOfStock || !selectedVariant}
          >
            {justAdded === selectedVariant?.id ? (
              '✓ Agregado'
            ) : (
              <>
                <ShoppingBag size={14} /> Agregar
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  )
}

export default memo(ProductCard)
