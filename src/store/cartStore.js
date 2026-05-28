import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, size) => {
        const { items } = get()
        const existingIndex = items.findIndex(
          (i) => i.id === product.id && i.size === size
        )
        if (existingIndex >= 0) {
          const updated = [...items]
          updated[existingIndex].quantity += 1
          set({ items: updated })
        } else {
          set({
            items: [
              ...items,
              {
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.images?.[0] || null,
                size,
                quantity: 1,
              },
            ],
          })
        }
      },

      removeItem: (id, size) => {
        set({ items: get().items.filter((i) => !(i.id === id && i.size === size)) })
      },

      updateQuantity: (id, size, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id, size)
          return
        }
        set({
          items: get().items.map((i) =>
            i.id === id && i.size === size ? { ...i, quantity } : i
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
    { name: 'elite-store-cart' }
  )
)
