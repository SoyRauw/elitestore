import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const StoreContext = createContext(null)
const STORAGE_KEY = 'elite-admin-store'

export const STORES = [
  { id: 'all', label: 'Todas las tiendas', short: 'Todas' },
  { id: 'elite', label: 'Elite Store', short: 'Elite' },
  { id: 'usa', label: 'USA Super Store', short: 'USA' },
]

export function StoreProvider({ children }) {
  const [store, setStore] = useState(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      return STORES.some((item) => item.id === saved) ? saved : 'all'
    } catch {
      return 'all'
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, store)
    } catch {
      // ignore
    }
  }, [store])

  const value = useMemo(() => {
    const current = STORES.find((item) => item.id === store) || STORES[0]
    return {
      store,
      setStore,
      storeLabel: current.label,
      storeShort: current.short,
      isAllStores: store === 'all',
    }
  }, [store])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const context = useContext(StoreContext)
  if (!context) {
    throw new Error('useStore must be used inside StoreProvider')
  }
  return context
}
