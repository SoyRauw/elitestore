import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './Pagination.module.css'

export default function Pagination({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)

  const start = Math.max(1, Math.min(current - 2, totalPages - 4))
  const end = Math.min(totalPages, start + 4)
  const pages = Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index)

  const go = (next) => {
    const clamped = Math.min(Math.max(1, next), totalPages)
    if (clamped !== current) onPageChange(clamped)
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.summary}>
        Mostrando <strong>{from}–{to}</strong> de <strong>{total}</strong>
      </span>

      {totalPages > 1 && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrow}
            onClick={() => go(current - 1)}
            disabled={current === 1}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>

          {start > 1 && (
            <>
              <button type="button" className={styles.page} onClick={() => go(1)}>1</button>
              {start > 2 && <span className={styles.ellipsis}>…</span>}
            </>
          )}

          {pages.map((number) => (
            <button
              key={number}
              type="button"
              className={`${styles.page} ${number === current ? styles.pageActive : ''}`}
              onClick={() => go(number)}
            >
              {number}
            </button>
          ))}

          {end < totalPages && (
            <>
              {end < totalPages - 1 && <span className={styles.ellipsis}>…</span>}
              <button type="button" className={styles.page} onClick={() => go(totalPages)}>
                {totalPages}
              </button>
            </>
          )}

          <button
            type="button"
            className={styles.arrow}
            onClick={() => go(current + 1)}
            disabled={current === totalPages}
            aria-label="Página siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
