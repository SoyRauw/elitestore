import { motion } from 'framer-motion'
import HeroSection from '../../components/store/HeroSection'
import ClothingCarousel from '../../components/store/ClothingCarousel'
import fondoImg from '../../assets/fondo.webp'

export default function Home() {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        backgroundImage: `url(${fondoImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <HeroSection />
      <ClothingCarousel />

      {/* About section moved to /nosotros */}
    </motion.main>
  )
}
