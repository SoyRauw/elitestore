import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { Plus, Edit2, Trash2, Search, X, User, Phone, Mail, MapPin, Cake, Eye, Gift, Coins, History } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import * as V from '../../lib/validation'
import styles from './AdminCustomers.module.css'

const emptyForm = {
  name: '',
  id_number: '',
  phone: '',
  email: '',
  address: '',
  birthday: '',
}

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editCustomer, setEditCustomer] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [detailCustomer, setDetailCustomer] = useState(null)
  const [customerCoupons, setCustomerCoupons] = useState([])
  const [pointsHistory, setPointsHistory] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchCustomers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name')
    if (error) console.error('Error cargando clientes:', error)
    setCustomers(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCustomers() }, [])

  const openDetail = async (customer) => {
    setDetailCustomer(customer)
    setDetailLoading(true)
    const [couponsRes, historyRes] = await Promise.all([
      supabase.from('customer_coupons').select('*, reward_coupons(*)').eq('customer_id', customer.id).order('created_at', { ascending: false }),
      supabase.from('customer_points_history').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false })
    ])
    setCustomerCoupons(couponsRes.data || [])
    setPointsHistory(historyRes.data || [])
    setDetailLoading(false)
  }

  const handleEdit = (customer) => {
    setEditCustomer(customer)
    setForm({
      name: customer.name || '',
      id_number: customer.id_number || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      birthday: customer.birthday || '',
    })
    setShowForm(true)
  }

  const handleNew = () => {
    setEditCustomer(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este cliente?')) return
    await supabase.from('customers').delete().eq('id', id)
    fetchCustomers()
  }

  const otherCustomers = useMemo(() => customers.filter(c => !editCustomer || c.id !== editCustomer.id), [customers, editCustomer])

  const validationErrors = useMemo(() => {
    const errs = {}
    errs.name = V.required(form.name, 'El nombre')
    if (form.id_number.trim()) {
      errs.id_number = V.unique(form.id_number, 'La cédula / RIF', otherCustomers.map(c => c.id_number))
    }
    if (form.phone.trim()) {
      // Basic phone characters allowed
      const phoneRegex = /^[\d\-+()\s]+$/
      if (!phoneRegex.test(form.phone)) errs.phone = 'El teléfono solo puede contener números, guiones y espacios'
    }
    if (form.email.trim()) {
      errs.email = V.email(form.email)
    }
    Object.keys(errs).forEach(k => { if (!errs[k]) delete errs[k] })
    return errs
  }, [form, otherCustomers])

  const hasErrors = useMemo(() => Object.keys(validationErrors).length > 0, [validationErrors])

  const handleFormSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (hasErrors) return
    setConfirmOpen(true)
  }

  const executeSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        id_number: form.id_number.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        birthday: form.birthday || null,
      }

      if (editCustomer) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editCustomer.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('customers').insert([payload])
        if (error) throw error
      }

      setShowForm(false)
      fetchCustomers()
    } catch (e) {
      const message = e?.message || e?.error?.message || 'Error al guardar'
      const lower = message.toLowerCase()
      if (lower.includes('customers_id_number_key') || (lower.includes('duplicate key') && lower.includes('id_number'))) {
        setError('La cédula / RIF ya está registrada.')
      } else if (lower.includes('row-level security')) {
        setError(`Error de permisos (RLS): ${message}.`)
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone && c.phone.includes(search)) ||
    (c.id_number && c.id_number.includes(search))
  )

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Clientes</h1>
            <p className={styles.pageSubtitle}>{customers.length} clientes registrados</p>
          </div>
          <button className="btn btn-primary" onClick={handleNew}>
            <Plus size={16} /> Nuevo cliente
          </button>
        </div>

        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Buscar por nombre, teléfono o cédula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.emptyTable}>Cargando...</div>
          ) : (
            <>
              {/* Vista tabla (desktop) */}
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Cédula / RIF</th>
                    <th>Teléfono</th>
                    <th>Puntos</th>
                    <th>Correo</th>
                    <th>Cumpleaños</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td><strong>{c.name}</strong></td>
                      <td>{c.id_number || '—'}</td>
                      <td>{c.phone || '—'}</td>
                      <td>
                        <span className={styles.pointsBadge}>
                          <Coins size={12} /> {c.points || 0}
                        </span>
                      </td>
                      <td>{c.email || '—'}</td>
                      <td>{c.birthday ? new Date(c.birthday).toLocaleDateString() : '—'}</td>
                      <td>
                        <div className={styles.actions}>
                          <button className={styles.detailBtn} onClick={() => openDetail(c)} aria-label="Ver detalle">
                            <Eye size={14} />
                          </button>
                          <button className={styles.editBtn} onClick={() => handleEdit(c)} aria-label="Editar">
                            <Edit2 size={14} />
                          </button>
                          <button className={styles.deleteBtn} onClick={() => handleDelete(c.id)} aria-label="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>

              {/* Vista cards (móvil) */}
              <div className={styles.mobileCards}>
                {filtered.map((c) => (
                  <motion.div key={c.id} className={styles.mobileCard} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className={styles.mobileCardHeader}>
                      <div>
                        <strong>{c.name}</strong>
                        <span className={styles.pointsBadgeMobile}>
                          <Coins size={10} /> {c.points || 0} pts
                        </span>
                      </div>
                      <div className={styles.actions}>
                        <button className={styles.detailBtn} onClick={() => openDetail(c)} aria-label="Ver detalle">
                          <Eye size={14} />
                        </button>
                        <button className={styles.editBtn} onClick={() => handleEdit(c)} aria-label="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(c.id)} aria-label="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className={styles.mobileCardBody}>
                      {c.id_number && (
                        <div className={styles.mobileCardRow}>
                          <span>Cédula</span>
                          <span>{c.id_number}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className={styles.mobileCardRow}>
                          <span>Teléfono</span>
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className={styles.mobileCardRow}>
                          <span>Correo</span>
                          <span>{c.email}</span>
                        </div>
                      )}
                      {c.birthday && (
                        <div className={styles.mobileCardRow}>
                          <span>Cumpleaños</span>
                          <span>{new Date(c.birthday).toLocaleDateString()}</span>
                        </div>
                      )}
                      {c.address && (
                        <div className={styles.mobileCardRow}>
                          <span>Dirección</span>
                          <span>{c.address}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
          {!loading && filtered.length === 0 && (
            <div className={styles.emptyTable}>No se encontraron clientes</div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={styles.formModal} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className={styles.modalHeader}>
                <h2>{editCustomer ? 'Editar cliente' : 'Nuevo cliente'}</h2>
                <button className={styles.closeBtn} onClick={() => setShowForm(false)}>
                  <X size={20} />
                </button>
              </div>

              <form className={styles.form} onSubmit={handleFormSubmit} noValidate onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}>
                <div className={styles.field}>
                  <label><User size={14} style={{ display: 'inline', marginRight: '0.25rem' }} /> Nombre completo *</label>
                  <input className={`${styles.input} ${validationErrors.name ? styles.inputError : ''}`} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="María Pérez" />
                  {validationErrors.name && <span className={styles.fieldError}>{validationErrors.name}</span>}
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label>Cédula / RIF</label>
                    <input className={`${styles.input} ${validationErrors.id_number ? styles.inputError : ''}`} value={form.id_number} onChange={(e) => setForm({...form, id_number: e.target.value})} placeholder="V-12345678" />
                    {validationErrors.id_number && <span className={styles.fieldError}>{validationErrors.id_number}</span>}
                  </div>
                  <div className={styles.field}>
                    <label><Phone size={14} style={{ display: 'inline', marginRight: '0.25rem' }} /> Teléfono</label>
                    <input className={`${styles.input} ${validationErrors.phone ? styles.inputError : ''}`} value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="0414-0000000" />
                    {validationErrors.phone && <span className={styles.fieldError}>{validationErrors.phone}</span>}
                  </div>
                </div>

                <div className={styles.row}>
                  <div className={styles.field}>
                    <label><Mail size={14} style={{ display: 'inline', marginRight: '0.25rem' }} /> Correo</label>
                    <input className={`${styles.input} ${validationErrors.email ? styles.inputError : ''}`} type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="cliente@email.com" />
                    {validationErrors.email && <span className={styles.fieldError}>{validationErrors.email}</span>}
                  </div>
                  <div className={styles.field}>
                    <label><Cake size={14} style={{ display: 'inline', marginRight: '0.25rem' }} /> Cumpleaños</label>
                    <input className={styles.input} type="date" value={form.birthday} onChange={(e) => setForm({...form, birthday: e.target.value})} />
                  </div>
                </div>

                <div className={styles.field}>
                  <label><MapPin size={14} style={{ display: 'inline', marginRight: '0.25rem' }} /> Dirección</label>
                  <input className={styles.input} value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} placeholder="Dirección de entrega" />
                </div>

                {error && <p className={styles.formError}>{error}</p>}

                <div className={styles.formActions}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving || hasErrors}>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>

              <ConfirmModal
                isOpen={confirmOpen}
                title={editCustomer ? '¿Guardar cambios?' : '¿Crear cliente?'}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={executeSave}
                confirmText="Confirmar"
                disabled={saving}
              >
                <ul className={styles.summaryList}>
                  <li><span className={styles.summaryLabel}>Nombre</span><span className={styles.summaryValue}>{form.name || '—'}</span></li>
                  <li><span className={styles.summaryLabel}>Cédula / RIF</span><span className={styles.summaryValue}>{form.id_number || '—'}</span></li>
                  <li><span className={styles.summaryLabel}>Teléfono</span><span className={styles.summaryValue}>{form.phone || '—'}</span></li>
                  <li><span className={styles.summaryLabel}>Correo</span><span className={styles.summaryValue}>{form.email || '—'}</span></li>
                </ul>
              </ConfirmModal>
            </motion.div>
          </motion.div>
        )}

        {detailCustomer && (
          <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={`${styles.formModal} ${styles.detailModal}`} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className={styles.modalHeader}>
                <h2>{detailCustomer.name}</h2>
                <button className={styles.closeBtn} onClick={() => setDetailCustomer(null)}>
                  <X size={20} />
                </button>
              </div>

              {detailLoading ? (
                <p>Cargando...</p>
              ) : (
                <>
                  <div className={styles.detailHero}>
                    <span className={styles.detailPoints}>
                      <Coins size={18} /> {detailCustomer.points || 0} puntos
                    </span>
                    {detailCustomer.id_number && <p>Cédula: {detailCustomer.id_number}</p>}
                    {detailCustomer.phone && <p>Teléfono: {detailCustomer.phone}</p>}
                  </div>

                  <div className={styles.detailSection}>
                    <h3><History size={14} /> Historial de puntos</h3>
                    {pointsHistory.length === 0 ? (
                      <p className={styles.detailEmpty}>Sin movimientos de puntos</p>
                    ) : (
                      <div className={styles.detailList}>
                        {pointsHistory.map((h) => (
                          <div key={h.id} className={styles.detailRow}>
                            <span className={styles.detailReason}>{h.reason}</span>
                            <span className={`${styles.detailChange} ${h.change > 0 ? styles.positive : styles.negative}`}>
                              {h.change > 0 ? '+' : ''}{h.change} pts
                            </span>
                            <span className={styles.detailDate}>{new Date(h.created_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.detailSection}>
                    <h3><Gift size={14} /> Cupones</h3>
                    {customerCoupons.length === 0 ? (
                      <p className={styles.detailEmpty}>Sin cupones</p>
                    ) : (
                      <div className={styles.detailList}>
                        {customerCoupons.map((cc) => (
                          <div key={cc.id} className={styles.detailRow}>
                            <span className={styles.detailReason}>{cc.reward_coupons?.name}</span>
                            <span className={styles.detailCode}>{cc.code.slice(-6)}</span>
                            <span className={`${styles.badge} ${cc.status === 'active' ? styles.badgeActive : styles.badgeUsed}`}>
                              {cc.status === 'active' ? 'Activo' : 'Usado'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}
