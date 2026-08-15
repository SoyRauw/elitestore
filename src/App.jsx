import { Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'

/* Store Components */
import Navbar from './components/store/Navbar'
import Home from './pages/store/Home'
import Catalog from './pages/store/Catalog'
import Nosotros from './pages/store/Nosotros'
import Footer from './components/store/Footer'

/* Admin Components */
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminProducts from './pages/admin/AdminProducts'
import AdminInventory from './pages/admin/AdminInventory'
import AdminCategories from './pages/admin/AdminCategories'
import AdminMovements from './pages/admin/AdminMovements'
import AdminMovementNew from './pages/admin/AdminMovementNew'
import AdminMovementDetail from './pages/admin/AdminMovementDetail'
import AdminPOS from './pages/admin/AdminPOS'
import AdminCash from './pages/admin/AdminCash'
import AdminCustomers from './pages/admin/AdminCustomers'
import AdminCoupons from './pages/admin/AdminCoupons'
import AdminReports from './pages/admin/AdminReports'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  
  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando...</div>
  
  if (!user) {
    return <Navigate to="/admin" replace />
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

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Store Routes */}
        <Route element={<StoreLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/nosotros" element={<Nosotros />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLogin />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/categories" element={<AdminCategories />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/inventory" element={<AdminInventory />} />
          <Route path="/admin/movements" element={<AdminMovements />} />
          <Route path="/admin/movements/new" element={<AdminMovementNew />} />
          <Route path="/admin/movements/:id" element={<AdminMovementDetail />} />
          <Route path="/admin/pos" element={<AdminPOS />} />
          <Route path="/admin/cash" element={<AdminCash />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/customers" element={<AdminCustomers />} />
          <Route path="/admin/coupons" element={<AdminCoupons />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
