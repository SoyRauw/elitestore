import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShoppingBag, ChevronLeft, ChevronRight, ZoomIn, Star, Package } from 'lucide-react'
import styles from './ProductDetailModal.module.css'

export default function ProductDetailModal({ product, onClose, onAdd, justAdded }) {
  const [activeImg, setActiveImg] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 })

  const images = product?.images?.length > 0 ? product.images : []
  const hasImages = images.length > 0

  const availableSizes = product?.product_sizes
    ? product.product_sizes.filter(ps => ps.stock > 0).map(ps => ps.size)
    : []

  const [selectedSize, setSelectedSize] = useState(availableSizes[0] || null)
  const isOutOfStock = availableSizes.length === 0

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowRight' && images.length > 1) setActiveImg(i => (i + 1) % images.length)
    if (e.key === 'ArrowLeft' && images.length > 1) setActiveImg(i => (i - 1 + images.length) % images.length)
  }, [onClose, images.length])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [handleKey])

  const handleMouseMove = (e) => {
    if (!zoomed) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setZoomPos({ x, y })
  }

  const prevImg = () => setActiveImg(i => (i - 1 + images.length) % images.length)
  const nextImg = () => setActiveImg(i => (i + 1) % images.length)

  if (!product) return null

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      id="product-detail-overlay"
    >
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar" id="close-product-detail">
          <X size={20} />
        </button>

        <div className={styles.layout}>
          {/* ===== GALLERY ===== */}
          <div className={styles.galleryCol}>
            <div
              className={`${styles.mainImgWrap} ${zoomed && hasImages ? styles.zooming : ''}`}
              onMouseMove={handleMouseMove}
              onMouseEnter={() => hasImages && setZoomed(true)}
              onMouseLeave={() => setZoomed(false)}
              style={zoomed && hasImages ? { '--zoom-x': `${zoomPos.x}%`, '--zoom-y': `${zoomPos.y}%` } : {}}
            >
              {hasImages ? (
                <>
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={activeImg}
                      src={images[activeImg]}
                      alt={`${product.name} - imagen ${activeImg + 1}`}
                      className={styles.mainImg}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      draggable={false}
                    />
                  </AnimatePresence>

                  {images.length > 1 && (
                    <>
                      <button className={`${styles.navBtn} ${styles.navLeft}`} onClick={prevImg} aria-label="Imagen anterior">
                        <ChevronLeft size={20} />
                      </button>
                      <button className={`${styles.navBtn} ${styles.navRight}`} onClick={nextImg} aria-label="Imagen siguiente">
                        <ChevronRight size={20} />
                      </button>
                    </>
                  )}

                  <div className={styles.imgCounter}>{activeImg + 1} / {images.length}</div>
                  <div className={styles.zoomHint}><ZoomIn size={12} /> Zoom</div>
                </>
              ) : (
                <div className={styles.noImage}>
                  <ShoppingBag size={48} />
                  <span>Sin imágenes</span>
                </div>
              )}

              {product.featured && <span className={styles.badge}>⭐ Destacado</span>}
              {isOutOfStock && <span className={`${styles.badge} ${styles.badgeOut}`}>Agotado</span>}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className={styles.thumbsRow}>
                {images.map((img, i) => (
                  <button
                    key={i}
                    className={`${styles.thumb} ${i === activeImg ? styles.thumbActive : ''}`}
                    onClick={() => setActiveImg(i)}
                    aria-label={`Ver imagen ${i + 1}`}
                    id={`thumb-${i}`}
                  >
                    <img src={img} alt={`miniatura ${i + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ===== PRODUCT INFO ===== */}
          <div className={styles.infoCol}>
            {product.categories?.name && (
              <span className={styles.category}>{product.categories.name}</span>
            )}

            <h2 className={styles.productName}>{product.name}</h2>

            <div className={styles.stars}>
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={14} fill="#f59e0b" color="#f59e0b" />
              ))}
              <span className={styles.starsLabel}>Producto premium</span>
            </div>

            <div className={styles.priceBlock}>
              <span className={styles.price}>${product.price?.toFixed(2)}</span>
              <span className={styles.priceSub}>Precio de contado</span>
            </div>

            {product.description && (
              <p className={styles.description}>{product.description}</p>
            )}

            <div className={styles.divider} />

            {/* Size picker */}
            <div className={styles.sizeSection}>
              <div className={styles.sizeSectionHeader}>
                <span className={styles.sizeLabel}>Talla</span>
                {selectedSize && <span className={styles.selectedSizeTag}>{selectedSize}</span>}
              </div>
              <div className={styles.sizeGrid}>
                {availableSizes.map(s => (
                  <button
                    key={s}
                    className={`${styles.sizeBtn} ${selectedSize === s ? styles.sizeBtnActive : ''}`}
                    onClick={() => setSelectedSize(s)}
                    id={`detail-size-${s}`}
                  >
                    {s}
                  </button>
                ))}
                {isOutOfStock && (
                  <div className={styles.outOfStockMsg}>
                    <Package size={16} /> Sin stock disponible
                  </div>
                )}
              </div>
            </div>

            {/* Stock chips */}
            {!isOutOfStock && product.product_sizes && (
              <div className={styles.stockInfo}>
                {product.product_sizes.filter(ps => ps.stock > 0).map(ps => (
                  <span key={ps.size} className={styles.stockChip}>
                    {ps.size}: {ps.stock} uds
                  </span>
                ))}
              </div>
            )}

            {/* CTA */}
            <div className={styles.ctaRow}>
              <motion.button
                className={`${styles.addBtn} ${justAdded ? styles.addBtnSuccess : ''}`}
                onClick={() => !isOutOfStock && selectedSize && onAdd(product, selectedSize)}
                disabled={isOutOfStock || !selectedSize}
                whileTap={{ scale: 0.96 }}
                id="add-to-cart-detail"
              >
                {justAdded ? (
                  <>✓ ¡Agregado al carrito!</>
                ) : (
                  <><ShoppingBag size={18} /> Agregar al carrito</>
                )}
              </motion.button>
            </div>

            {!isOutOfStock && !selectedSize && (
              <p className={styles.selectSizeHint}>⬆ Selecciona una talla para continuar</p>
            )}

            <div className={styles.detailsFooter}>
              <div className={styles.detailItem}>
                <span className={styles.detailKey}>ID del producto</span>
                <span className={styles.detailVal}>#{product.id}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailKey}>Estado</span>
                <span className={`${styles.detailVal} ${product.active ? styles.stateActive : styles.stateInactive}`}>
                  {product.active ? '● Disponible' : '● No disponible'}
                </span>
              </div>
              {images.length > 0 && (
                <div className={styles.detailItem}>
                  <span className={styles.detailKey}>Fotos</span>
                  <span className={styles.detailVal}>{images.length} imagen{images.length !== 1 ? 'es' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
