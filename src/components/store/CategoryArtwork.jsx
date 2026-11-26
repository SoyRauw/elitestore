import { getCategoryVisual } from '../../lib/categoryVisuals'
import styles from './CategoryArtwork.module.css'

export default function CategoryArtwork({ category, label, size = 'card', className = '' }) {
  const visual = getCategoryVisual(category)
  const Icon = visual.icon

  return (
    <div
      className={`${styles.art} ${styles[size] || ''} ${className}`}
      style={{
        '--from': visual.from,
        '--to': visual.to,
        '--accent': visual.accent,
      }}
      aria-hidden="true"
    >
      <span className={styles.pattern} />
      <span className={styles.glow} />
      <Icon className={styles.icon} strokeWidth={1.25} />
      <span className={styles.brand}>USA SUPER STORE</span>
      <span className={styles.category}>{label || visual.label}</span>
    </div>
  )
}
