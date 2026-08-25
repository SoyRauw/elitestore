import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { Plus, X, User, Shield, Save } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import ConfirmModal from '../../components/admin/ConfirmModal'
import * as V from '../../lib/validation'
import styles from './AdminUsers.module.css'

const INTERNAL_EMAIL_DOMAIN = 'elite.local'

// Isolated client so signing up a new user does not log out the current admin.
const createUserClient = () => createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      storageKey: 'elite-create-user',
      autoRefreshToken: false,
    },
  }
)

const emptyForm = {
  username: '',
  password: '',
  role: 'seller',
}

const ROLE_LABELS = {
  admin: 'Administrador',
  seller: 'Vendedor',
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [success, setSuccess] = useState('')

  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, email, name, role, created_at')
      .order('created_at', { ascending: false })
    if (error) console.error('Error cargando usuarios:', error)
    setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleNew = () => {
    setForm(emptyForm)
    setError('')
    setSuccess('')
    setShowForm(true)
  }

  const validationErrors = useMemo(() => {
    const errs = {}
    errs.username = V.run(form.username.trim(), [
      (v) => V.required(v, 'El usuario'),
      (v) => V.noSpaces(v, 'El usuario'),
      (v) => V.minLength(v, 'El usuario', 3),
      (v) => V.unique(v, 'El usuario', users.map(u => u.username)),
    ])
    errs.password = V.run(form.password, [
      (v) => V.required(v, 'La contraseña'),
      (v) => V.minLength(v, 'La contraseña', 6),
    ])
    errs.role = V.oneOf(form.role, 'El rol', ['admin', 'seller'])
    Object.keys(errs).forEach(k => { if (!errs[k]) delete errs[k] })
    return errs
  }, [form, users])

  const hasErrors = useMemo(() => Object.keys(validationErrors).length > 0, [validationErrors])

  const handleFormSubmit = (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (hasErrors) return
    setConfirmOpen(true)
  }

  const executeSave = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    const username = form.username.trim().toLowerCase()
    const email = `${username}@${INTERNAL_EMAIL_DOMAIN}`

    try {
      // Double-check uniqueness in case another admin created it meanwhile.
      const { data: existing } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .limit(1)
      if (existing?.length) {
        throw new Error('El nombre de usuario ya está en uso')
      }

      const client = createUserClient()
      const { data, error: signUpError } = await client.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            username,
            name: username,
            role: form.role,
          },
        },
      })

      if (signUpError) throw signUpError
      if (!data?.user) throw new Error('No se pudo crear el usuario')

      // Fallback: if the trigger didn't create the profile, insert it manually.
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          username,
          email,
          name: username,
          role: form.role,
        }, { onConflict: 'id' })

      if (profileError) throw profileError

      setShowForm(false)
      setForm(emptyForm)
      setSuccess(`Usuario "${username}" creado como ${ROLE_LABELS[form.role]}.`)
      fetchUsers()
    } catch (e) {
      const message = e?.message || e?.error?.message || 'Error al crear el usuario'
      const lower = message.toLowerCase()
      if (lower.includes('user_already_registered') || lower.includes('duplicate key') && lower.includes('profiles_username_key')) {
        setError('El nombre de usuario ya está registrado.')
      } else if (lower.includes('password')) {
        setError('La contraseña no cumple los requisitos mínimos.')
      } else if (lower.includes('row-level security')) {
        setError(`Error de permisos (RLS): ${message}`)
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
    if (error) {
      console.error('Error cambiando rol:', error)
      alert('No se pudo cambiar el rol')
    } else {
      fetchUsers()
    }
  }

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Usuarios</h1>
            <p className={styles.pageSubtitle}>{users.length} usuarios registrados</p>
          </div>
          <button className="btn btn-primary" onClick={handleNew}>
            <Plus size={16} /> Nuevo usuario
          </button>
        </div>

        {success && <p className={styles.success}>{success}</p>}

        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.emptyTable}>Cargando...</div>
          ) : (
            <>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Correo interno</th>
                    <th>Rol</th>
                    <th>Creado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td>
                        <div className={styles.userCell}>
                          <div className={styles.userAvatar}>
                            <User size={14} />
                          </div>
                          <strong>{u.username || '—'}</strong>
                        </div>
                      </td>
                      <td className={styles.mono}>{u.email || '—'}</td>
                      <td>
                        <select
                          className={styles.roleSelect}
                          value={u.role || 'seller'}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          <option value="admin">Administrador</option>
                          <option value="seller">Vendedor</option>
                        </select>
                      </td>
                      <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                      <td>
                        <span className={`${styles.badge} ${u.role === 'admin' ? styles.badgeAdmin : styles.badgeSeller}`}>
                          {u.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.mobileCards}>
                {users.map((u) => (
                  <motion.div key={u.id} className={styles.mobileCard} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className={styles.mobileCardHeader}>
                      <div>
                        <strong>{u.username || '—'}</strong>
                        <span className={`${styles.badge} ${u.role === 'admin' ? styles.badgeAdmin : styles.badgeSeller}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </div>
                    </div>
                    <div className={styles.mobileCardBody}>
                      <div className={styles.mobileCardRow}>
                        <span>Correo</span>
                        <span className={styles.mono}>{u.email || '—'}</span>
                      </div>
                      <div className={styles.mobileCardRow}>
                        <span>Creado</span>
                        <span>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</span>
                      </div>
                      <div className={styles.mobileCardRow}>
                        <span>Rol</span>
                        <select
                          className={styles.roleSelect}
                          value={u.role || 'seller'}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          <option value="admin">Administrador</option>
                          <option value="seller">Vendedor</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
          {!loading && users.length === 0 && (
            <div className={styles.emptyTable}>No hay usuarios registrados</div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={styles.formModal} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
              <div className={styles.modalHeader}>
                <h2>Nuevo usuario</h2>
                <button className={styles.closeBtn} onClick={() => setShowForm(false)}>
                  <X size={20} />
                </button>
              </div>

              <form className={styles.form} onSubmit={handleFormSubmit} noValidate onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}>
                <div className={styles.field}>
                  <label><User size={14} style={{ display: 'inline', marginRight: '0.25rem' }} /> Nombre de usuario *</label>
                  <input
                    className={`${styles.input} ${validationErrors.username ? styles.inputError : ''}`}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="vendedor1"
                    autoComplete="off"
                  />
                  {validationErrors.username && <span className={styles.fieldError}>{validationErrors.username}</span>}
                </div>

                <div className={styles.field}>
                  <label>Contraseña *</label>
                  <input
                    type="password"
                    className={`${styles.input} ${validationErrors.password ? styles.inputError : ''}`}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete="new-password"
                  />
                  {validationErrors.password && <span className={styles.fieldError}>{validationErrors.password}</span>}
                </div>

                <div className={styles.field}>
                  <label><Shield size={14} style={{ display: 'inline', marginRight: '0.25rem' }} /> Rol *</label>
                  <select
                    className={`${styles.input} ${validationErrors.role ? styles.inputError : ''}`}
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="seller">Vendedor</option>
                    <option value="admin">Administrador</option>
                  </select>
                  {validationErrors.role && <span className={styles.fieldError}>{validationErrors.role}</span>}
                </div>

                {error && <p className={styles.formError}>{error}</p>}

                <div className={styles.formActions}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={saving || hasErrors}>
                    {saving ? 'Guardando...' : <><Save size={16} /> Guardar</>}
                  </button>
                </div>
              </form>

              <ConfirmModal
                isOpen={confirmOpen}
                title="¿Crear usuario?"
                onCancel={() => setConfirmOpen(false)}
                onConfirm={executeSave}
                confirmText="Confirmar"
                disabled={saving}
              >
                <ul className={styles.summaryList}>
                  <li><span className={styles.summaryLabel}>Usuario</span><span className={styles.summaryValue}>{form.username.trim().toLowerCase() || '—'}</span></li>
                  <li><span className={styles.summaryLabel}>Rol</span><span className={styles.summaryValue}>{ROLE_LABELS[form.role] || '—'}</span></li>
                  <li><span className={styles.summaryLabel}>Correo interno</span><span className={styles.summaryValue}>{form.username.trim() ? `${form.username.trim().toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}` : '—'}</span></li>
                </ul>
              </ConfirmModal>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}
