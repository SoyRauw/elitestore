import { useState, useEffect, useMemo, memo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import {
  getVariantModels,
  getProductPriceRange,
} from '../../lib/sku'
import { useStorefront } from '../../context/StorefrontContext'
import { useDayDiscounts } from '../../context/DayDiscountsContext'
import CategoryArtwork from './CategoryArtwork'
import styles from './ProductCard.module.css'

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100

function ProductCard({ product, index = 0 }) {
  const navigate = useNavigate()
  const storefront = useStorefront()
  const { discountFor } = useDayDiscounts()
  const models = useMemo(() => getVariantModels(product), [product])
  const priceRange = useMemo(() => getProductPriceRange(product), [product])
  const discount = discountFor(
    storefront.id,
    product.category_id || product.categories?.id,
    product.id
  )
  const productPath = storefront.productPath
    ? storefront.productPath(product.id)
    : `/product/${product.id}`

  const [selectedModel, setSelectedModel] = useState(models[0] || null)

  useEffect(() => {
    if (models.length > 0 && (!selectedModel || !models.find((model) => model.key === selectedModel.key))) {
      setSelectedModel(models[0])
    }
  }, [models, selectedModel])

  const isOutOfStock = models.length === 0

  const basePrice = useMemo(() => {
    if (!selectedModel) return priceRange.min || 0
    return selectedModel.minPrice || 0
  }, [selectedModel, priceRange])

  const discountPercentage = discount?.percentage || 0

  const displayPrice = useMemo(() => {
    if (discountPercentage <= 0) return basePrice
    return round2(basePrice * (1 - discountPercentage / 100))
  }, [basePrice, discountPercentage])

  const visibleModels = models.slice(0, 4)
  const remainingModels = models.length - visibleModels.length

  const handleModelClick = (event, model) => {
    event.stopPropagation()
    setSelectedModel(model)
  }

  const handleMoreClick = (event) => {
    event.stopPropagation()
    navigate(productPath)
  }

  const handleCardClick = () => {
    navigate(productPath)
  }

  const isUsa = storefront.id === 'usa'

  return (
    <article
      className={`${styles.card} ${isUsa ? styles.usa : ''}`}
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
        ) : isUsa ? (
          <CategoryArtwork category={product.categories?.name} />
        ) : (
          <div className={styles.placeholder}>
            <ShoppingBag size={32} />
          </div>
        )}

        {product.featured && <span className={styles.featuredBadge}>Destacado</span>}
        {isOutOfStock && <span className={styles.outOfStockBadge}>Agotado</span>}
        {discountPercentage > 0 && (
          <span className={styles.discountBadge}>-{Number(discountPercentage.toFixed(2))}%</span>
        )}

        <div className={styles.viewOverlay}>
          <span>Ver detalles</span>
        </div>
      </div>

      <div className={styles.body}>
        <span className={styles.category}>{product.categories?.name}</span>
        <h3 className={styles.name}>
          <Link to={productPath} onClick={(event) => event.stopPropagation()}>
            {product.name}
          </Link>
        </h3>
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
                  onClick={(event) => handleModelClick(event, model)}
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
          <span className={`${styles.price} ${discountPercentage > 0 ? styles.priceDiscounted : ''}`}>
            {discountPercentage > 0 && (
              <span className={styles.oldPrice}>${basePrice.toFixed(2)}</span>
            )}
            ${displayPrice.toFixed(2)}
          </span>
          <button
            type="button"
            className={styles.addBtn}
            onClick={(event) => { event.stopPropagation(); handleCardClick() }}
            disabled={isOutOfStock}
          >
            {isOutOfStock ? (
              'Agotado'
            ) : (
              <>
                <ShoppingBag size={14} /> {isUsa ? 'Ver producto' : 'Elegir talla'}
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  )
}

export default memo(ProductCard)
