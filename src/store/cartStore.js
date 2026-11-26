import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getVariantImage } from '../lib/sku'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, variant) => {
        const { items } = get()
        const existingIndex = items.findIndex((i) => i.id === variant.id)

        if (existingIndex >= 0) {
          const updated = [...items]
          const nextQty = updated[existingIndex].quantity + 1
          if (nextQty > variant.stock) return
          updated[existingIndex].quantity = nextQty
          set({ items: updated })
        } else {
          set({
            items: [
              ...items,
              {
                id: variant.id,
                product_id: product.id,
                store_id: product.store_id || 'elite',
                name: product.name,
                category_name: product.categories?.name || null,
                variant_name: variant.variant_name,
                color: variant.color,
                size: variant.size,
                size_label: product.categories?.size_label || 'Talla',
                sku: variant.sku,
                price: variant.price,
                image: getVariantImage(product, variant),
                stock: variant.stock,
                quantity: 1,
              },
            ],
          })
        }
      },

      removeItem: (variantId) => {
        set({ items: get().items.filter((i) => i.id !== variantId) })
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId)
          return
        }
        const item = get().items.find((i) => i.id === variantId)
        if (item && quantity > item.stock) return
        set({
          items: get().items.map((i) =>
            i.id === variantId ? { ...i, quantity } : i
          ),
        })
      },

      clearCart: () => set({ items: [] }),

      get total() {
        return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0)
      },

      get count() {
        return get().items.reduce((sum, i) => sum + i.quantity, 0)
      },
    }),
    {
      name: 'elite-store-cart',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState || {}
        const items = (state.items || []).map((item) => ({
          ...item,
          store_id: item.store_id || 'elite',
        }))
        return { ...state, items }
      },
    }
  )
)

