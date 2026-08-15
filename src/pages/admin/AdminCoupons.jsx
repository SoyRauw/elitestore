import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, X, Save, Tag, Percent, DollarSign, Package, ShoppingBag } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import styles from './AdminCoupons.module.css'

const emptyForm = {
  name: '',
  discount_type: 'percentage',
  discount_value: '',
  points_cost: '',
  min_purchase_amount: '',
  applies_to: 'sale',
  usage_limit: 1,
  end_date: '',
  is_active: true,
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCoupon, setEditCoupon] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchCoupons = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('reward_coupons')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('Error cargando cupones:', error)
    setCoupons(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCoupons() }, [])

  const handleNew = () => {
    setEditCoupon(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const handleEdit = (coupon) => {
    setEditCoupon(coupon)
    setForm({
      name: coupon.name || '',
      discount_type: coupon.discount_type || 'percentage',
      discount_value: coupon.discount_value || '',
      points_cost: coupon.points_cost || '',
      applies_to: coupon.applies_to || 'sale',
      min_purchase_amount: coupon.min_purchase_amount || '',
      usage_limit: coupon.usage_limit || 1,
      end_date: coupon.end_date ? coupon.end_date.slice(0, 10) : '',
      is_active: coupon.is_active !== false,
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este cupón? Los clientes que ya lo canjearon seguirán teniéndolo.')) return
    await supabase.from('reward_coupons').delete().eq('id', id)
    fetchCoupons()
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.discount_value || parseFloat(form.discount_value) <= 0) { setError('El descuento debe ser mayor a 0'); return }
    if (form.points_cost === '' || parseInt(form.points_cost) < 0) { setError('El costo en puntos no puede ser negativo'); return }
    if (form.min_purchase_amount !== '' && parseFloat(form.min_purchase_amount) < 0) { setError('La compra mínima no puede ser negativa'); return }

    setSaving(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      points_cost: parseInt(form.points_cost),
      min_purchase_amount: parseFloat(form.min_purchase_amount) || 0,
      applies_to: form.applies_to,
      usage_limit: parseInt(form.usage_limit) || 1,
      end_date: form.end_date || null,
      is_active: form.is_active,
    }

    try {
      if (editCoupon) {
        const { error } = await supabase.from('reward_coupons').update(payload).eq('id', editCoupon.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('reward_coupons').insert([payload])
        if (error) throw error
      }
      setShowForm(false)
      fetchCoupons()
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const isExpired = (coupon) => {
    if (!coupon.end_date) return false
    return new Date(coupon.end_date) < new Date().setHours(0, 0, 0, 0)
  }

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Cupones y Descuentos</h1>
            <p className={styles.pageSubtitle}>{coupons.length} cupones creados</p>
          </div>
          <button className="btn btn-primary" onClick={handleNew}>
            <Plus size={16} /> Nuevo cupón
          </button>
        </div>

        {loading ? (
          <div className={styles.empty}>Cargando...</div>
        ) : coupons.length === 0 ? (
          <div className={styles.emptyCard}>
            <Tag size={48} />
            <p>No hay cupones creados</p>
            <button className="btn btn-primary" onClick={handleNew} style={{ marginTop: '0.5rem' }}>
              Crear primer cupón
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {coupons.map((coupon) => (
              <motion.div key={coupon.id} className={`${styles.card} ${!coupon.is_active || isExpired(coupon) ? styles.inactive : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIcon}>
                    {coupon.applies_to === 'sale' ? <ShoppingBag size={20} /> : <Package size={20} />}
                  </div>
                  <div className={styles.cardTitleWrap}>
                    <h3 className={styles.cardTitle}>{coupon.name}</h3>
                    <span className={styles.cardType}>
                      {coupon.applies_to === 'sale' ? 'Toda la venta' : 'Producto específico'}
                    </span>
                  </div>
                  <div className={styles.cardActions}>
                    <button className={styles.iconBtn} onClick={() => handleEdit(coupon)} aria-label="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button className={`${styles.iconBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(coupon.id)} aria-label="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Descuento</span>
                    <strong className={styles.statValue}>
                      {coupon.discount_type === 'percentage' ? (
                        <><Percent size={14} /> {coupon.discount_value}%</>
                      ) : (
                        <><DollarSign size={14} /> ${coupon.discount_value}</>
                      )}
                    </strong>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Costo en puntos</span>
                    <strong className={styles.statValue}>{coupon.points_cost} pts</strong>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Usos</span>
                    <strong className={styles.statValue}>{coupon.usage_limit}</strong>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Compra mín.</span>
                    <strong className={styles.statValue}>${coupon.min_purchase_amount || 0}</strong>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  {!coupon.is_active && <span className={`${styles.badge} ${styles.badgeInactive}`}>Inactivo</span>}
                  {isExpired(coupon) && <span className={`${styles.badge} ${styles.badgeExpired}`}>Vencido</span>}
                  {coupon.is_active && !isExpired(coupon) && <span className={`${styles.badge} ${styles.badgeActive}`}>Activo</span>}
                  {coupon.end_date && (
                    <span className={styles.validUntil}>Vence: {new Date(coupon.end_date).toLocaleDateString()}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={styles.modal} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className={styles.modalHeader}>
                <h2>{editCoupon ? 'Editar cupón' : 'Nuevo cupón'}</h2>
                <button className={styles.closeBtn} onClick={() => setShowForm(false)}>
                  <X size={20} />
                </button>
              </div>

              <form className={styles.form} onSubmit={handleSave}>
                <div className={styles.field}>
                  <label>Nombre del cupón</label>
                  <input className={styles.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Descuento 10%" required />
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>Tipo de descuento</label>
                    <select className={styles.input} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                      <option value="percentage">Porcentaje (%)</option>
                      <option value="fixed">Monto fijo ($)</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label>Valor del descuento</label>
                    <input type="number" step="0.01" min="0.01" className={styles.input} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder={form.discount_type === 'percentage' ? '10' : '5'} required />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>Costo en puntos</label>
                    <input type="number" min="0" className={styles.input} value={form.points_cost} onChange={(e) => setForm({ ...form, points_cost: e.target.value })} placeholder="100" required />
                  </div>
                  <div className={styles.field}>
                    <label>Aplica a</label>
                    <select className={styles.input} value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value })}>
                      <option value="sale">Toda la venta</option>
                      <option value="product">Producto específico</option>
                    </select>
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>Límite de usos</label>
                    <input type="number" min="1" className={styles.input} value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} required />
                  </div>
                  <div className={styles.field}>
                    <label>Vencimiento (opcional)</label>
                    <input type="date" className={styles.input} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>Compra mínima ($)</label>
                    <input type="number" step="0.01" min="0" className={styles.input} value={form.min_purchase_amount} onChange={(e) => setForm({ ...form, min_purchase_amount: e.target.value })} placeholder="0" />
                  </div>
                </div>

                <label className={styles.toggle}>
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  <span>Cupón activo</span>
                </label>

                {error && <p className={styles.formError}>{error}</p>}

                <div className={styles.formActions}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : <><Save size={16} /> Guardar</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}
