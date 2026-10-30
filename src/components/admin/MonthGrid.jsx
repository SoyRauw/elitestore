import { ChevronLeft, ChevronRight } from 'lucide-react'
import { toISODate } from '../../lib/finance'
import styles from '../../pages/admin/AdminFinance.module.css'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function MonthGrid({ month, onMonthChange, renderDay, onDayClick, dayClassName }) {
  const y = month.getFullYear()
  const m = month.getMonth()
  const first = new Date(y, m, 1)
  const startWeekday = (first.getDay() + 6) % 7 // lunes = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const todayISO = toISODate(new Date())

  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d))
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className={styles.calendarWrap}>
      <div className={styles.calendarHeader}>
        <button type="button" className={styles.monthBtn} onClick={() => onMonthChange(-1)} aria-label="Mes anterior">
          <ChevronLeft size={16} />
        </button>
        <div className={styles.monthTitle}>
          {first.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })}
        </div>
        <button type="button" className={styles.monthBtn} onClick={() => onMonthChange(1)} aria-label="Mes siguiente">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAYS.map((d) => <div key={d} className={styles.weekday}>{d}</div>)}
      </div>

      <div className={styles.daysGrid}>
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className={`${styles.dayCell} ${styles.dayCellMuted}`} />
          const iso = toISODate(date)
          return (
            <button
              key={iso}
              type="button"
              className={`${styles.dayCell} ${iso === todayISO ? styles.dayCellToday : ''} ${dayClassName ? dayClassName(iso) : ''}`}
              onClick={() => onDayClick?.(iso)}
            >
              <span className={styles.dayNum}>{date.getDate()}</span>
              {renderDay?.(iso, date)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
