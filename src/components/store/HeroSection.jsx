import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Sparkles, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './HeroSection.module.css'

const HERO_VIDEO_URL = 'https://soivtyndamuzbdtwfvza.supabase.co/storage/v1/object/public/assets/video_2026-08-26_21-58-01.mp4'

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
      {/* Background video */}
      <video
        className={styles.videoBg}
        src={HERO_VIDEO_URL}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <div className={styles.videoOverlay} aria-hidden="true" />

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
          Elegancia en tu
          <br />
          <span className={styles.titleAccent}>día a día</span>
        </motion.h1>

        <motion.p className={styles.subtitle} variants={itemVariants}>
          Moda exclusiva, tendencias y accesorios esenciales diseñados para la mujer contemporánea. Encuentra tu look ideal y complementa tu rutina.
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
            { value: 'XS–XXL', label: 'Todas las tallas' },
          ].map((s) => (
            <div key={s.label} className={styles.stat}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <div className={styles.scrollIndicator}>
        <motion.div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <div className={styles.scrollLine} />
          <span>scroll</span>
        </motion.div>
      </div>
    </section>
  )
}
