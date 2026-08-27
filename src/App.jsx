import { Suspense, lazy } from 'react'
import { Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'

/* Store Components */
import Navbar from './components/store/Navbar'
import Home from './pages/store/Home'
import Catalog from './pages/store/Catalog'
import ProductDetailPage from './pages/store/ProductDetailPage'
import Nosotros from './pages/store/Nosotros'
import Footer from './components/store/Footer'

/* Admin Components — lazy loaded to keep public bundle small */
import AdminLogin from './pages/admin/AdminLogin'

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'))
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory'))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'))
const AdminMovements = lazy(() => import('./pages/admin/AdminMovements'))
const AdminMovementDetail = lazy(() => import('./pages/admin/AdminMovementDetail'))
const AdminPOS = lazy(() => import('./pages/admin/AdminPOS'))
const AdminCash = lazy(() => import('./pages/admin/AdminCash'))
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'))
const AdminCoupons = lazy(() => import('./pages/admin/AdminCoupons'))
const AdminReports = lazy(() => import('./pages/admin/AdminReports'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))

const ADMIN_ONLY_ROUTES = [
  '/admin/dashboard',
  '/admin/categories',
  '/admin/products',
  '/admin/reports',
  '/admin/users',
]

function ProtectedRoute({ children }) {
  const { user, loading, role } = useAuth()
  const location = useLocation()

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando...</div>

  if (!user) {
    return <Navigate to="/admin" replace />
  }

  // Non-admin users cannot access admin-only routes.
  if (role !== 'admin' && ADMIN_ONLY_ROUTES.some(path => location.pathname.startsWith(path))) {
    return <Navigate to="/admin/pos" replace />
  }

  return children ? children : <Outlet />
}

function StoreLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
      <Footer />
    </>
  )
}

function AdminFallback() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-cream)' }}>
      Cargando panel...
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Store Routes */}
        <Route element={<StoreLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/nosotros" element={<Nosotros />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route element={
          <Suspense fallback={<AdminFallback />}>
            <ProtectedRoute />
          </Suspense>
        }>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/inventory" element={<AdminInventory />} />
          <Route path="/admin/movements" element={<AdminMovements />} />
          <Route path="/admin/movements/:id" element={<AdminMovementDetail />} />
          <Route path="/admin/pos" element={<AdminPOS />} />
          <Route path="/admin/cash" element={<AdminCash />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/customers" element={<AdminCustomers />} />
          <Route path="/admin/coupons" element={<AdminCoupons />} />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
