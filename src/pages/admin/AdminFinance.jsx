import { useState } from 'react'
import { Wallet, TrendingUp, CalendarDays, Receipt, Tags } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import FinanceSummary from './finance/FinanceSummary'
import CalendarTab from './finance/CalendarTab'
import ExpensesTab from './finance/ExpensesTab'
import CostsTab from './finance/CostsTab'
import styles from './AdminFinance.module.css'

const TABS = [
  { id: 'resumen', label: 'Resumen', icon: TrendingUp, Component: FinanceSummary },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays, Component: CalendarTab },
  { id: 'gastos', label: 'Gastos', icon: Receipt, Component: ExpensesTab },
  { id: 'costos', label: 'Costos', icon: Tags, Component: CostsTab },
]

export default function AdminFinance() {
  const [tab, setTab] = useState('resumen')
  const Active = TABS.find((t) => t.id === tab)?.Component || FinanceSummary

  return (
    <AdminLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}><Wallet size={22} /> Finanzas</h1>
            <p className={styles.pageSubtitle}>Ingresos, costos, gastos, inversión y ganancia real</p>
          </div>
        </div>

        <div className={styles.tabs}>
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
                onClick={() => setTab(t.id)}
              >
                <Icon size={15} /> {t.label}
              </button>
            )
          })}
        </div>

        <Active />
      </div>
    </AdminLayout>
  )
}
