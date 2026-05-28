import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'

export const useProducts = ({ category_id, featured, limit } = {}) => {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        let query = supabase
          .from('products')
          .select('*, categories(name), product_sizes(size, stock)')
          .eq('active', true)
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
  }, [category_id, featured, limit])

  return { products, loading, error }
}

export const useCategories = () => {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('categories').select('*').order('name')
      setCategories(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  return { categories, loading }
}
