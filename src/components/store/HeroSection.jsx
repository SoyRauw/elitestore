import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Sparkles, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './HeroSection.module.css'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } },
}

const itemVariants = {
  hidden:   { opacity: 0, y: 30 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } },
}

export default function HeroSection() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

  return (
    <section className={styles.hero} ref={ref}>
      {/* Animated background blobs */}
      <div className={styles.blobs}>
        <motion.div
          className={`${styles.blob} ${styles.blob1}`}
          animate={{ scale: [1, 1.15, 1], x: [0, 20, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className={`${styles.blob} ${styles.blob2}`}
          animate={{ scale: [1, 1.1, 1], x: [0, -15, 0], y: [0, 25, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
        <motion.div
          className={`${styles.blob} ${styles.blob3}`}
          animate={{ scale: [1, 1.2, 1], x: [0, 10, 0], y: [0, 15, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      {/* Floating petals */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className={styles.petal}
          style={{ left: `${10 + i * 15}%`, top: `${20 + (i % 3) * 20}%` }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 15, -15, 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.4,
            ease: 'easeInOut',
          }}
        >
          🌸
        </motion.div>
      ))}

      {/* Content */}
      <motion.div
        className={styles.content}
        style={{ y, opacity }}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className={styles.badge} variants={itemVariants}>
          <Sparkles size={14} />
          <span>Nueva Colección 2026</span>
        </motion.div>

        <motion.h1 className={styles.title} variants={itemVariants}>
          Elegancia que
          <br />
          <span className={styles.titleAccent}>te abraza</span>
        </motion.h1>

        <motion.p className={styles.subtitle} variants={itemVariants}>
          Moda exclusiva diseñada para la mujer que se ama a sí misma.
          Suavidad, estilo y confort en cada prenda.
        </motion.p>

        <motion.div className={styles.actions} variants={itemVariants}>
          <Link to="/catalog" className={`btn btn-primary ${styles.ctaBtn}`}>
            Ver Colección
            <ArrowRight size={18} />
          </Link>
          <Link to="/catalog" className={`btn btn-outline ${styles.secondaryBtn}`}>
            Catálogo
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div className={styles.stats} variants={itemVariants}>
          {[
            { value: '100%', label: 'Calidad Premium' },
            { value: 'XS–XL', label: 'Todas las tallas' },
            { value: '💕', label: 'Hecho con amor' },
          ].map((s) => (
            <div key={s.label} className={styles.stat}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className={styles.scrollIndicator}
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <div className={styles.scrollLine} />
        <span>scroll</span>
      </motion.div>
    </section>
  )
}
