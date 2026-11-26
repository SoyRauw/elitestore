import {
  Utensils,
  Pill,
  Sparkles,
  Droplets,
  Shirt,
  Home,
  Laptop,
  ShoppingBag,
} from 'lucide-react'

const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

const VISUALS = {
  food: {
    label: 'Food',
    icon: Utensils,
    from: '#7F1D1D',
    to: '#DC2626',
    accent: '#FDE68A',
  },
  medicamentos: {
    label: 'Medicamentos',
    icon: Pill,
    from: '#1E3A8A',
    to: '#2563EB',
    accent: '#BFDBFE',
  },
  'beauty and home': {
    label: 'Beauty & Home',
    icon: Sparkles,
    from: '#9D174D',
    to: '#DB2777',
    accent: '#FBCFE8',
  },
  'bath & body': {
    label: 'Bath & Body',
    icon: Droplets,
    from: '#0E7490',
    to: '#06B6D4',
    accent: '#CFFAFE',
  },
  franelas: {
    label: 'Franelas',
    icon: Shirt,
    from: '#1E293B',
    to: '#334155',
    accent: '#E2E8F0',
  },
  jeans: {
    label: 'Jeans',
    icon: Shirt,
    from: '#172554',
    to: '#1E3A8A',
    accent: '#DBEAFE',
  },
  'home luxury': {
    label: 'Home Luxury',
    icon: Home,
    from: '#92400E',
    to: '#D97706',
    accent: '#FDE68A',
  },
  tecnologia: {
    label: 'Tecnología',
    icon: Laptop,
    from: '#334155',
    to: '#64748B',
    accent: '#E2E8F0',
  },
}

const FALLBACK = {
  label: 'Producto',
  icon: ShoppingBag,
  from: '#7F1D1D',
  to: '#B91C1C',
  accent: '#FDE68A',
}

export function getCategoryVisual(name) {
  return VISUALS[normalize(name)] || FALLBACK
}
