import { motion } from 'framer-motion'
import { MapPin, Package, Bike, MessageCircle, CheckCircle, Sparkles } from 'lucide-react'
import { WHATSAPP_NUMBER } from '../../lib/whatsapp'
import styles from './Nosotros.module.css'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
}

const NATIONAL = [
  'MRW, Tealca, Zoom, Domesa y cualquier agencia de tu elección',
  'El costo de envío lo cancela el destinatario al retirar',
  'Te enviamos el número de guía para rastrear tu pedido',
  'Empacamos con cuidado para que llegue impecable',
]

const DELIVERY = [
  'Cobertura a toda Maracaibo',
  'Coordinamos el costo según tu zona y distancia',
  'Entrega rápida — coordinamos el horario contigo',
  'Pago al momento de entrega o transferencia previa',
]

const STEPS = [
  { n: '01', title: 'Elige tu producto', body: 'Haz tu carrito desde nuestra tienda y anota el producto que quieres.' },
  { n: '02', title: 'Escríbenos',        body: 'Contáctanos por WhatsApp o Instagram con tu pedido, nombre completo y ciudad.' },
  { n: '03', title: 'Coordina el pago', body: 'Te indicamos los métodos disponibles: Pago Móvil, Zelle, transferencia y más.' },
  { n: '04', title: '¡Listo!',           body: 'Procesamos tu pedido y te enviamos la guía o coordinamos el delivery.' },
]

export default function Nosotros() {
  const openWA = () => {
    const m = encodeURIComponent('Hola Elite Store 👋, tengo una pregunta sobre mi pedido')
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${m}`, '_blank')
  }

  return (
    <motion.main className={styles.page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

      {/* ─── HEADER ─── */}
      <div className={styles.pageHeader}>
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <span className={styles.pill}><Sparkles size={12} /> Nuestra tienda</span>
          <h1 className={styles.pageTitle}>
            Sobre <span className={styles.italic}>Nosotras</span>
          </h1>
          <p className={styles.pageSubtitle}>
            Somos Elite Store — una tienda pensada para la mujer que cuida su estilo
            en el día a día. Vestidos, conjuntos, pijamas, accesorios y más.
          </p>
        </motion.div>
      </div>

      <div className={styles.wrap}>

        {/* ─── UBICACIÓN ─── */}
        <motion.div
          className={styles.locationCard}
          variants={fadeUp} initial="hidden"
          whileInView="visible" viewport={{ once: true }}
        >
          <div className={styles.locationIcon}><MapPin size={24} /></div>
          <div className={styles.locationBody}>
            <span className={styles.locationEye}>Encuéntranos</span>
            <strong className={styles.locationName}>Centro Comercial Lago Mall</strong>
            <span className={styles.locationCity}>Maracaibo, Venezuela</span>
          </div>
          <span className={styles.soon}>Te esperamos</span>
        </motion.div>

        {/* ─── ENVÍOS ─── */}
        <div className={styles.block}>
          <motion.div className={styles.blockHeader} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <h2 className={styles.blockTitle}>¿Cómo te llega tu pedido?</h2>
            <p className={styles.blockSub}>Dos opciones para que recibas tu compra sin complicaciones.</p>
          </motion.div>

          <div className={styles.shippingGrid}>
            {[
              { icon: <Package size={20} />, title: 'Envíos Nacionales', sub: 'A todo Venezuela', items: NATIONAL },
              { icon: <Bike size={20} />,    title: 'Delivery Maracaibo', sub: 'Directo a tu puerta', items: DELIVERY },
            ].map((card, ci) => (
              <motion.div
                key={card.title}
                className={styles.shCard}
                variants={fadeUp} custom={ci}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
              >
                <div className={styles.shCardHead}>
                  <span className={styles.shIcon}>{card.icon}</span>
                  <div>
                    <h3 className={styles.shTitle}>{card.title}</h3>
                    <p className={styles.shSub}>{card.sub}</p>
                  </div>
                </div>
                <ul className={styles.checkList}>
                  {card.items.map(it => (
                    <li key={it}>
                      <CheckCircle size={14} className={styles.chk} />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ─── PASOS ─── */}
        <div className={styles.block}>
          <motion.div className={styles.blockHeader} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <h2 className={styles.blockTitle}>¿Cómo hago mi pedido?</h2>
            <p className={styles.blockSub}>Cuatro pasos sencillos y tu pedido está en camino.</p>
          </motion.div>

          <div className={styles.stepsGrid}>
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                className={styles.stepCard}
                variants={fadeUp} custom={i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
              >
                <span className={styles.stepN}>{s.n}</span>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepBody}>{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ─── CTA ─── */}
        <motion.div
          className={styles.cta}
          variants={fadeUp} initial="hidden"
          whileInView="visible" viewport={{ once: true }}
        >
          <h2 className={styles.ctaTitle}>¿Tienes alguna duda?</h2>
          <p className={styles.ctaSub}>Escríbenos y te respondemos lo antes posible.</p>
          <div className={styles.ctaBtns}>
            <motion.button className={styles.btnWa} onClick={openWA} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <MessageCircle size={18} /> Escribir al WhatsApp
            </motion.button>
            <a href="https://www.instagram.com/elitestoremcbo_/" target="_blank" rel="noopener noreferrer" className={styles.btnIg}>
              @elitestoremcbo_
            </a>
          </div>
        </motion.div>

      </div>
    </motion.main>
  )
}
