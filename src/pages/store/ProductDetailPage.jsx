import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, ShoppingBag, Home, ChevronRight as ChevronRightIcon, ArrowLeft, Maximize2 } from 'lucide-react'
import { useProduct } from '../../hooks/useProducts'
import { useCartStore } from '../../store/cartStore'
import { useStorefront } from '../../context/StorefrontContext'
import { useDayDiscounts } from '../../context/DayDiscountsContext'
import CategoryArtwork from '../../components/store/CategoryArtwork'
import ImageLightbox from '../../components/store/ImageLightbox'
import {
  getVariantModels,
  getProductPriceRange,
  findVariantByModelAndSize,
} from '../../lib/sku'
import { absoluteUrl, cleanText, usePageMeta } from '../../lib/seo'
import styles from './ProductDetailPage.module.css'

export default function ProductDetailPage() {
  const { id } = useParams()
  const storefront = useStorefront()
  const pageClass = `${styles.page} ${storefront.id === 'usa' ? styles.usa : ''}`
  const { product, loading, error } = useProduct(id, storefront.id)
  const { discountFor } = useDayDiscounts()
  const addItem = useCartStore((s) => s.addItem)

  const discountPercentage = product
    ? discountFor(storefront.id, product.category_id || product.categories?.id)?.percentage || 0
    : 0

  const models = useMemo(() => getVariantModels(product || {}), [product])
  const priceRange = useMemo(() => getProductPriceRange(product || {}), [product])

  const [selectedModel, setSelectedModel] = useState(null)
  const [selectedSize, setSelectedSize] = useState(null)
  const [activeImg, setActiveImg] = useState(0)
  const [added, setAdded] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [id])

  useEffect(() => {
    if (models.length > 0 && (!selectedModel || !models.find((m) => m.key === selectedModel.key))) {
      const first = models[0]
      setSelectedModel(first)
      setSelectedSize(first.sizes.length === 1 ? first.sizes[0] : null)
    }
  }, [models, selectedModel])

  useEffect(() => {
    if (selectedModel) {
      setSelectedSize(selectedModel.sizes.length === 1 ? selectedModel.sizes[0] : null)
    }
  }, [selectedModel])

  const selectedVariant = useMemo(() => {
    if (!selectedModel || !selectedSize) return null
    return findVariantByModelAndSize(product || {}, selectedModel.key, selectedSize)
  }, [product, selectedModel, selectedSize])

  useEffect(() => {
    setActiveImg(0)
  }, [selectedModel, selectedVariant])

  const galleryImages = useMemo(() => {
    const list = []
    const push = (img) => {
      if (img && !list.includes(img)) list.push(img)
    }

    const source = Array.isArray(selectedVariant?.images) && selectedVariant.images.length
      ? selectedVariant.images
      : Array.isArray(selectedModel?.images) && selectedModel.images.length
        ? selectedModel.images
        : selectedVariant?.image
          ? [selectedVariant.image]
          : selectedModel?.image
            ? [selectedModel.image]
            : []

    source.forEach(push)
    if (list.length === 0 && product?.images?.length) product.images.forEach(push)
    return list
  }, [product, selectedModel, selectedVariant])

  useEffect(() => {
    if (activeImg >= galleryImages.length) setActiveImg(0)
  }, [galleryImages.length, activeImg])

  const isOutOfStock = models.length === 0
  const productMissing = !loading && !product

  const seoImage = product?.images?.[0] || selectedVariant?.image || selectedModel?.image || null

  const seoJsonLd = useMemo(() => {
    if (!product) return null
    const basePrice = Number(priceRange.min || product.price) || 0
    const price = discountPercentage > 0
      ? basePrice * (1 - discountPercentage / 100)
      : basePrice
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      image: product.images?.length ? product.images : seoImage ? [seoImage] : undefined,
      description: cleanText(product.description || `Compra ${product.name} en ${storefront.fullName}.`, 300),
      sku: product.id,
      brand: {
        '@type': 'Brand',
        name: storefront.footerTitle,
      },
      offers: {
        '@type': 'Offer',
        priceCurrency: 'USD',
        price: price.toFixed(2),
        availability: isOutOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        url: absoluteUrl(storefront.productPath(product.id)),
      },
    }
  }, [product, priceRange.min, isOutOfStock, seoImage, storefront, discountPercentage])

  usePageMeta({
    title: product
      ? `${product.name} | ${storefront.footerTitle}`
      : productMissing
        ? `Producto no encontrado | ${storefront.footerTitle}`
        : `Producto | ${storefront.footerTitle}`,
    description: product
      ? cleanText(product.description || `Compra ${product.name} en ${storefront.fullName}.`)
      : productMissing
        ? 'El producto que buscas no está disponible.'
        : `Cargando producto de ${storefront.fullName}.`,
    image: seoImage,
    path: product ? storefront.productPath(product.id) : storefront.productPath(id),
    type: 'product',
    noindex: productMissing,
    jsonLd: seoJsonLd,
  })

  const basePrice = useMemo(() => {
    if (selectedVariant) return selectedVariant.price || 0
    if (selectedModel) return selectedModel.minPrice || 0
    return priceRange.min || 0
  }, [selectedVariant, selectedModel, priceRange])

  const displayPrice = useMemo(() => {
    if (discountPercentage <= 0) return basePrice
    const value = basePrice * (1 - discountPercentage / 100)
    return Math.round(value * 100) / 100
  }, [basePrice, discountPercentage])

  const displayPriceLabel = selectedVariant ? '' : 'Desde '

  const handleAdd = () => {
    if (!selectedVariant || !product) return
    addItem(product, selectedVariant, {
      price: displayPrice,
      originalPrice: basePrice,
      discountPercentage,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const handleModelSelect = (model) => {
    setSelectedModel(model)
  }

  const handleSizeSelect = (size) => {
    setSelectedSize(size)
  }

  const prevImg = () => setActiveImg((i) => (i - 1 + galleryImages.length) % galleryImages.length)
  const nextImg = () => setActiveImg((i) => (i + 1) % galleryImages.length)

  if (loading) {
    return (
      <main className={pageClass}>
        <div className={styles.container}>
          <div className={styles.skeletonLayout}>
            <div className={`skeleton ${styles.skeletonGallery}`} />
            <div className={styles.skeletonInfo}>
              <div className={`skeleton ${styles.skeletonLine}`} />
              <div className={`skeleton ${styles.skeletonLine}`} />
              <div className={`skeleton ${styles.skeletonLine}`} />
              <div className={`skeleton ${styles.skeletonButton}`} />
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (error || !product) {
    return (
      <main className={pageClass}>
        <div className={styles.container}>
          <div className={styles.notFound}>
            <h2>Producto no encontrado</h2>
            <p>El producto que buscas no existe o ya no está disponible.</p>
            <Link to={storefront.catalogPath} className={styles.backLink}>
              <ArrowLeft size={18} /> Ver catálogo
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={pageClass}>
      <div className={styles.container}>
        {/* Breadcrumb */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to={storefront.homePath} className={styles.breadcrumbLink}>
            <Home size={14} /> Inicio
          </Link>
          <ChevronRightIcon size={14} />
          <Link to={storefront.catalogPath} className={styles.breadcrumbLink}>{storefront.catalogTitle}</Link>
          <ChevronRightIcon size={14} />
          <span className={styles.breadcrumbCurrent}>{product.name}</span>
        </nav>

        <div className={styles.layout}>
          {/* Gallery */}
          <div className={styles.galleryCol}>
            <div className={styles.mainImgWrap}>
              {galleryImages.length > 0 ? (
                <>
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={activeImg}
                      src={galleryImages[activeImg]}
                      alt={`${product.name} - ${activeImg + 1}`}
                      className={styles.mainImg}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      fetchpriority="high"
                      onClick={() => setLightboxOpen(true)}
                      style={{ cursor: 'zoom-in' }}
                    />
                  </AnimatePresence>

                  {galleryImages.length > 1 && (
                    <>
                      <button className={`${styles.navBtn} ${styles.navLeft}`} onClick={prevImg} aria-label="Anterior">
                        <ChevronLeft size={20} />
                      </button>
                      <button className={`${styles.navBtn} ${styles.navRight}`} onClick={nextImg} aria-label="Siguiente">
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}

                  <div className={styles.imgCounter}>{activeImg + 1} / {galleryImages.length}</div>
                  <div className={styles.zoomHint}><Maximize2 size={14} /> Ampliar</div>
                </>
              ) : storefront.id === 'usa' ? (
                <CategoryArtwork
                  category={product.categories?.name}
                  label={product.categories?.name}
                  size="detail"
                />
              ) : (
                <div className={styles.noImage}>
                  <ShoppingBag size={48} />
                  <span>Sin imágenes</span>
                </div>
              )}

              {product.featured && <span className={styles.badge}>Destacado</span>}
              {isOutOfStock && <span className={`${styles.badge} ${styles.badgeOut}`}>Agotado</span>}
            </div>

            {galleryImages.length > 1 && (
              <div className={styles.thumbsRow}>
                {galleryImages.map((img, i) => (
                  <button
                    key={`${img}-${i}`}
                    className={`${styles.thumb} ${i === activeImg ? styles.thumbActive : ''}`}
                    onClick={() => setActiveImg(i)}
                    aria-label={`Ver imagen ${i + 1}`}
                  >
                    <img
                      src={img}
                      alt={`miniatura ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className={styles.infoCol}>
            {product.categories?.name && (
              <span className={styles.category}>{product.categories.name}</span>
            )}
            <h1 className={styles.productName}>{product.name}</h1>

            <div className={styles.priceBlock}>
              <span className={styles.price}>
                {discountPercentage > 0 && (
                  <span className={styles.oldPrice}>${basePrice.toFixed(2)}</span>
                )}
                {displayPriceLabel}${displayPrice.toFixed(2)}
              </span>
              {discountPercentage > 0 && (
                <span className={styles.discountBadge}>
                  -{Number(discountPercentage.toFixed(2))}%
                </span>
              )}
            </div>

            {product.description && (
              <p className={styles.description}>{product.description}</p>
            )}

            <div className={styles.divider} />

            {/* Models */}
            {models.length !== 1 && (
              <div className={styles.section}>
                <span className={styles.sectionLabel}>Modelo</span>
                {models.length > 0 ? (
                  <div className={styles.modelGrid}>
                    {models.map((model) => {
                      const active = selectedModel?.key === model.key
                      return (
                        <button
                          key={model.key}
                          type="button"
                          className={`${styles.modelBtn} ${active ? styles.modelBtnActive : ''}`}
                          onClick={() => handleModelSelect(model)}
                          title={model.key}
                        >
                          {model.image ? (
                            <img src={model.image} alt={model.key} className={styles.modelBtnImg} />
                          ) : null}
                          <span className={styles.modelBtnLabel}>{model.key}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className={styles.outOfStockMsg}>Sin stock disponible</p>
                )}
              </div>
            )}

            {/* Sizes */}
            {selectedModel && selectedModel.sizes.length > 0 && !selectedModel.sizes.includes('Única') && (
              <div className={styles.section}>
                <span className={styles.sectionLabel}>{product.categories?.size_label || 'Talla'}</span>
                <div className={styles.sizeGrid}>
                  {selectedModel.sizes.map((size) => {
                    const active = selectedSize === size
                    return (
                      <button
                        key={size}
                        type="button"
                        className={`${styles.sizeBtn} ${active ? styles.sizeBtnActive : ''}`}
                        onClick={() => handleSizeSelect(size)}
                      >
                        {size}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className={styles.ctaRow}>
              <motion.button
                type="button"
                className={`${styles.addBtn} ${added ? styles.addBtnSuccess : ''}`}
                onClick={handleAdd}
                whileTap={{ scale: 0.98 }}
                disabled={isOutOfStock || !selectedVariant}
              >
                <ShoppingBag size={20} />
                {added ? '✓ Agregado al carrito' : 'Agregar al carrito'}
              </motion.button>
            </div>

            <div className={styles.detailsFooter}>
              <div className={styles.detailItem}>
                <span className={styles.detailKey}>Stock</span>
                <span className={styles.detailVal}>{selectedVariant?.stock ?? selectedModel?.variants?.[0]?.stock ?? 0} unidades</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailKey}>Estado</span>
                <span className={`${styles.detailVal} ${isOutOfStock ? styles.stateInactive : styles.stateActive}`}>
                  {isOutOfStock ? 'Agotado' : 'Disponible'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ImageLightbox
        open={lightboxOpen}
        images={galleryImages}
        index={activeImg}
        alt={product.name}
        onClose={() => setLightboxOpen(false)}
      />
    </main>
  )
}
