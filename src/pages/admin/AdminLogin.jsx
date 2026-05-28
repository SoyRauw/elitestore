import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Sparkles, Eye, EyeOff, Lock } from 'lucide-react'
import styles from './AdminLogin.module.css'

export default function AdminLogin() {
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { signIn }  = useAuth()
  const navigate    = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/admin/dashboard')
    } catch (err) {
      setError('Credenciales incorrectas. Verifica tu usuario y contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Animated background */}
      <div className={styles.bg}>
        <motion.div className={`${styles.blob} ${styles.b1}`}
          animate={{ scale: [1,1.2,1], x:[0,30,0] }}
          transition={{ duration:8, repeat:Infinity }} />
        <motion.div className={`${styles.blob} ${styles.b2}`}
          animate={{ scale: [1,1.15,1], y:[0,-20,0] }}
          transition={{ duration:10, repeat:Infinity, delay:1 }} />
      </div>

      <motion.div
        className={styles.card}
        initial={{ opacity:0, y:40, scale:0.95 }}
        animate={{ opacity:1, y:0, scale:1 }}
        transition={{ duration:0.6, ease:[0.22,1,0.36,1] }}
      >
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Sparkles size={24} />
          </div>
          <h1 className={styles.logoText}>Elite Store</h1>
          <p className={styles.logoSub}>Panel de Administración</p>
        </div>

        {/* Form */}
        <form className={styles.form} onSubmit={handleSubmit} id="admin-login-form">
          <div className={styles.field}>
            <label className="label" htmlFor="admin-email">Correo electrónico</label>
            <input
              id="admin-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@elitestore.com"
              required
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className="label" htmlFor="admin-password">Contraseña</label>
            <div className={styles.passwordWrap}>
              <input
                id="admin-password"
                type={showPwd ? 'text' : 'password'}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPwd(!showPwd)}
                aria-label="Mostrar contraseña"
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.p
              className={styles.error}
              initial={{ opacity:0, x:-10 }}
              animate={{ opacity:1, x:0 }}
            >
              {error}
            </motion.p>
          )}

          <motion.button
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={loading}
            whileTap={{ scale:0.97 }}
          >
            {loading ? (
              <div className={styles.spinner} />
            ) : (
              <>
                <Lock size={16} />
                Ingresar
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}
