import { createContext, useContext } from 'react'
import { STOREFRONTS } from '../lib/storefronts'

const StorefrontContext = createContext(STOREFRONTS.elite)

export function StorefrontProvider({ store = 'elite', children }) {
  const value = STOREFRONTS[store] || STOREFRONTS.elite
  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>
}

export const useStorefront = () => useContext(StorefrontContext)
