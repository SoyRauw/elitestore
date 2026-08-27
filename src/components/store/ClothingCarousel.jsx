import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectCoverflow, Pagination, Autoplay } from 'swiper/modules'
import { motion } from 'framer-motion'
import { ShoppingBag, Eye } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { getVariantModels, getProductPriceRange } from '../../lib/sku'
import 'swiper/css'
import 'swiper/css/effect-coverflow'
import 'swiper/css/pagination'

import styles from './ClothingCarousel.module.css'

export default function ClothingCarousel() {
  const navigate = useNavigate()
  const { products, loading } = useProducts({ limit: 10 })

  const availableProducts = useMemo(() => {
    return products.filter((p) => getVariantModels(p).length > 0)
  }, [products])

  const handleViewProduct = (id) => {
    navigate(`/product/${id}`)
  }

  return (
    <section className={styles.section}>
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <div className="divider" />
        <h2 className={styles.title}>Nuestra Colección</h2>
        <p className={styles.subtitle}>Prendas pensadas para ti, diseñadas para resaltar tu belleza</p>
      </motion.div>

      {!loading && availableProducts.length > 0 ? (
        <Swiper
          effect="coverflow"
          grabCursor
          centeredSlides
          slidesPerView="auto"
          loop={true}
          coverflowEffect={{
            rotate: 30,
            stretch: 0,
            depth: 100,
            modifier: 1,
            slideShadows: false,
          }}
          pagination={{ clickable: true }}
          autoplay={{ delay: 3500, disableOnInteraction: false }}
          modules={[EffectCoverflow, Pagination, Autoplay]}
          className={styles.swiper}
        >
          {availableProducts.map((item) => {
            const models = getVariantModels(item)
            const firstModel = models[0] || null
            const image = firstModel?.image || item.images?.[0] || null
            const priceRange = getProductPriceRange(item)
            const variantLabel = models.length > 1
              ? `${models.length} modelos`
              : firstModel?.key || null

            return (
              <SwiperSlide key={item.id} className={styles.slide}>
                <div className={styles.card}>
                  {item.featured && <div className={styles.tag}>Destacado</div>}

                  <div
                    className={styles.imageWrap}
                    onClick={() => handleViewProduct(item.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {image ? (
                      <img
                        src={image}
                        alt={item.name}
                        className={styles.image}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className={styles.placeholder}>
                        <ShoppingBag size={40} />
                      </div>
                    )}
                  </div>

                  <div className={styles.info}>
                    <h3 className={styles.name}>{item.name}</h3>
                    <p className={styles.category}>{item.categories?.name || 'Ropa'}</p>
                    {variantLabel && <span className={styles.variantLabel}>{variantLabel}</span>}
                    <div className={styles.footer}>
                      <span className={styles.price}>Desde ${priceRange.min.toFixed(2)}</span>
                      <button
                        type="button"
                        className={styles.addBtn}
                        onClick={(e) => { e.stopPropagation(); handleViewProduct(item.id) }}
                        aria-label={`Ver ${item.name}`}
                      >
                        <Eye size={16} />
                        Ver producto
                      </button>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            )
          })}
        </Swiper>
      ) : (
        <div className={styles.loadingMsg}>
          {loading ? 'Cargando colección...' : 'Aún no hay productos en la tienda.'}
        </div>
      )}
    </section>
  )
}
