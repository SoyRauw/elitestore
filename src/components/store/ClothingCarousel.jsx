import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectCoverflow, Pagination, Autoplay } from 'swiper/modules'
import { motion } from 'framer-motion'
import { ShoppingBag } from 'lucide-react'
import { useCartStore } from '../../store/cartStore'
import 'swiper/css'
import 'swiper/css/effect-coverflow'
import 'swiper/css/pagination'

import { useProducts } from '../../hooks/useProducts'
import styles from './ClothingCarousel.module.css'

export default function ClothingCarousel() {
  const addItem = useCartStore((s) => s.addItem)
  const { products, loading } = useProducts({ limit: 10 })

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

      {!loading && products.length > 0 ? (
        <Swiper
          effect="coverflow"
          grabCursor
          centeredSlides
          slidesPerView="auto"
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
          {products.map((item) => (
            <SwiperSlide key={item.id} className={styles.slide}>
              <motion.div
                className={styles.card}
                whileHover={{ y: -8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {/* Tag */}
                {item.featured && <div className={styles.tag}>Destacado</div>}

                {/* Image */}
                <div className={styles.imageWrap}>
                  {item.images?.[0] ? (
                    <img src={item.images[0]} alt={item.name} className={styles.image} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                      <ShoppingBag size={40} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className={styles.info}>
                  <h3 className={styles.name}>{item.name}</h3>
                  <p className={styles.category}>{item.categories?.name || 'Ropa'}</p>
                  <div className={styles.footer}>
                    <span className={styles.price}>${item.price.toFixed(2)}</span>
                    <motion.button
                      className={styles.addBtn}
                      onClick={() => addItem(item, 'M')}
                      whileTap={{ scale: 0.9 }}
                      aria-label={`Agregar ${item.name} al carrito`}
                    >
                      <ShoppingBag size={16} />
                      Agregar
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          {loading ? 'Cargando colección...' : 'Aún no hay productos en la tienda.'}
        </div>
      )}
    </section>
  )
}
