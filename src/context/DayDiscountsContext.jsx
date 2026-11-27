import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  bestDiscountForCategory,
  fetchActiveDayDiscounts,
  localISODate,
  promotionsForStore,
} from '../lib/dayDiscounts'

const DayDiscountsContext = createContext(null)

export function DayDiscountsProvider({ children }) {
  const [discounts, setDiscounts] = useState([])

  const refresh = useCallback(async () => {
    try {
      setDiscounts(await fetchActiveDayDiscounts())
    } catch (error) {
      console.error('Error cargando descuentos de la tienda:', error)
      setDiscounts([])
    }
  }, [])

  useEffect(() => {
    refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const value = useMemo(() => {
    const discountFor = (storeId, categoryId) =>
      bestDiscountForCategory(discounts, storeId, categoryId, localISODate())

    return {
      discounts,
      refresh,
      discountFor,
      percentageFor: (storeId, categoryId) =>
        discountFor(storeId, categoryId)?.percentage || 0,
      promotionsFor: (storeId) =>
        promotionsForStore(discounts, storeId, localISODate()),
    }
  }, [discounts, refresh])

  return (
    <DayDiscountsContext.Provider value={value}>
      {children}
    </DayDiscountsContext.Provider>
  )
}

const FALLBACK = {
  discounts: [],
  refresh: () => {},
  discountFor: () => null,
  percentageFor: () => 0,
  promotionsFor: () => [],
}

export const useDayDiscounts = () => useContext(DayDiscountsContext) || FALLBACK
