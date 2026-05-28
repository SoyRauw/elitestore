import { motion } from 'framer-motion'
import HeroSection from '../../components/store/HeroSection'
import ClothingCarousel from '../../components/store/ClothingCarousel'

export default function Home() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <HeroSection />
      <ClothingCarousel />

      {/* About section */}
      <section style={{
        padding: '4rem 1.25rem',
        background: 'var(--gradient-pink-soft)',
        textAlign: 'center',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="divider" />
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.875rem, 4vw, 2.5rem)',
            fontWeight: 700,
            color: 'var(--color-dark)',
            marginBottom: '1rem',
          }}>
            ¿Por qué Elite Store?
          </h2>
          <p style={{
            color: 'var(--color-dark-soft)',
            maxWidth: '500px',
            margin: '0 auto 2rem',
            lineHeight: 1.8,
          }}>
            Cada prenda está seleccionada con amor para que te sientas como la reina que eres. 
            Calidad premium, tallas para todas y envíos a todo el país.
          </p>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            flexWrap: 'wrap',
          }}>
            {['🌹 Calidad Premium', '📦 Envíos Seguros', '💕 Solo para ti'].map((f) => (
              <motion.div
                key={f}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'white',
                  borderRadius: '9999px',
                  boxShadow: 'var(--shadow-md)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--color-dark)',
                }}
                whileHover={{ y: -4, boxShadow: 'var(--shadow-lg)' }}
              >
                {f}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>
    </motion.main>
  )
}
