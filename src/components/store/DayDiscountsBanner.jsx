import { Sparkles } from 'lucide-react'
import { useStorefront } from '../../context/StorefrontContext'
import { useDayDiscounts } from '../../context/DayDiscountsContext'
import styles from './DayDiscountsBanner.module.css'

export default function DayDiscountsBanner() {
  const storefront = useStorefront()
  const { promotionsFor } = useDayDiscounts()
  const promotions = promotionsFor(storefront.id)

  if (promotions.length === 0) return null

  return (
    <div className={`${styles.banner} ${storefront.id === 'usa' ? styles.usa : ''}`}>
      <span className={styles.label}>
        <Sparkles size={15} /> Hay descuentos
      </span>
    </div>
  )
}
