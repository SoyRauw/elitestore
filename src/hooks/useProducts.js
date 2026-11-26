import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'

// Solo lo necesario para cards/carrusel: sin costos, sin galerías completas
// ni campos que no se muestran. El detalle sigue usando useProduct con *.
const CARD_SELECT = `
  id, name, price, store_id, created_at, featured, images, category_id,
  categories(id, name, size_label, size_options, sizes_enabled),
  product_variants(id, sku, color, variant_name, size, price, stock, image, active, created_at)
`

export const useProducts = ({ category_id, featured, limit, storeId = 'elite' } = {}) => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        let query = supabase
          .from('products')
          .select(CARD_SELECT)
          .eq('active', true)
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })

        if (category_id) query = query.eq('category_id', category_id)
        if (featured) query = query.eq('featured', true)
        if (limit)    query = query.limit(limit)

        const { data, error } = await query
        if (error) throw error
        setProducts(data || [])
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [category_id, featured, limit, storeId])

  return { products, loading, error }
}

export const useProduct = (id, storeId = 'elite') => {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    const fetch = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*, categories(*), product_variants(*)')
          .eq('id', id)
          .eq('active', true)
          .eq('store_id', storeId)
          .single()
        if (error) throw error
        setProduct(data)
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id, storeId])

  return { product, loading, error }
}

export const useCategories = (storeId = 'elite') => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .in('store_id', [storeId, 'both'])
        .order('name')
      setCategories(data || [])
      setLoading(false)
    }
    fetch()
  }, [storeId])

  return { categories, loading }
}
