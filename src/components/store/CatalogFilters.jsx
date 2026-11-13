import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SlidersHorizontal, X } from 'lucide-react'
import styles from './CatalogFilters.module.css'

const EMPTY = {
  category: '',
  size: '',
  minPrice: '',
  maxPrice: '',
  sort: 'newest',
}

export default function CatalogFilters({ open, onClose, categories = [], sizes = [], value, onApply }) {
  const [draft, setDraft] = useState(EMPTY)

  useEffect(() => {
    if (!open) return
    setDraft({
      category: value?.category || '',
      size: value?.size || '',
      minPrice: value?.minPrice ?? '',
      maxPrice: value?.maxPrice ?? '',
      sort: value?.sort || 'newest',
    })
  }, [open, value?.category, value?.size, value?.minPrice, value?.maxPrice, value?.sort])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const update = (key, next) => setDraft((prev) => ({ ...prev, [key]: next }))
  const reset = () => setDraft(EMPTY)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="presentation"
        >
          <motion.aside
            className={styles.panel}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Filtros del catálogo"
          >
            <div className={styles.header}>
              <h2><SlidersHorizontal size={18} /> Filtros</h2>
              <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className={styles.body}>
              <section className={styles.section}>
                <h3>Categoría</h3>
                <div className={styles.chips}>
                  <button
                    type="button"
                    className={`${styles.chip} ${!draft.category ? styles.chipActive : ''}`}
                    onClick={() => update('category', '')}
                  >
                    Todas
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={`${styles.chip} ${draft.category === category.id ? styles.chipActive : ''}`}
                      onClick={() => update('category', category.id)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <h3>Talla</h3>
                <div className={styles.chips}>
                  <button
                    type="button"
                    className={`${styles.chip} ${!draft.size ? styles.chipActive : ''}`}
                    onClick={() => update('size', '')}
                  >
                    Todas
                  </button>
                  {sizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`${styles.chip} ${draft.size === size ? styles.chipActive : ''}`}
                      onClick={() => update('size', size)}
                    >
                      {size}
                    </button>
                  ))}
                  {sizes.length === 0 && <span className={styles.empty}>No hay tallas disponibles.</span>}
                </div>
              </section>

              <section className={styles.section}>
                <h3>Precio</h3>
                <div className={styles.priceRow}>
                  <input
                    type="number"
                    min="0"
                    className={styles.input}
                    placeholder="Mínimo"
                    value={draft.minPrice}
                    onChange={(event) => update('minPrice', event.target.value)}
                  />
                  <span>—</span>
                  <input
                    type="number"
                    min="0"
                    className={styles.input}
                    placeholder="Máximo"
                    value={draft.maxPrice}
                    onChange={(event) => update('maxPrice', event.target.value)}
                  />
                </div>
              </section>

              <section className={styles.section}>
                <h3>Ordenar por</h3>
                <select
                  className={styles.select}
                  value={draft.sort}
                  onChange={(event) => update('sort', event.target.value)}
                >
                  <option value="newest">Más recientes</option>
                  <option value="price_asc">Precio: menor a mayor</option>
                  <option value="price_desc">Precio: mayor a menor</option>
                </select>
              </section>
            </div>

            <div className={styles.footer}>
              <button type="button" className="btn btn-ghost" onClick={reset}>Limpiar</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { onApply(draft); onClose() }}
              >
                Aplicar filtros
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
