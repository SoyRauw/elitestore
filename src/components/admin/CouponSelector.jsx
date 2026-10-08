import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Gift, X, ChevronDown, ChevronUp, Coins, ShoppingBag, Package } from 'lucide-react'
import styles from './CouponSelector.module.css'

export default function CouponSelector({
  customer,
  subtotal,
  appliedCoupon,
  onApplyCustomerCoupon,
  onRedeemRewardCoupon,
  onRemoveCoupon,
  disabled,
}) {
  const [customerCoupons, setCustomerCoupons] = useState([])
  const [rewardCoupons, setRewardCoupons] = useState([])
  const [loading, setLoading] = useState(false)
  const [showRedeem, setShowRedeem] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const rewardsPromise = supabase
      .from('reward_coupons')
      .select('*')
      .eq('is_active', true)
    const couponsPromise = customer?.id
      ? supabase
        .from('customer_coupons')
        .select('*, reward_coupons(*)')
        .eq('customer_id', customer.id)
        .eq('status', 'active')
      : Promise.resolve({ data: [] })
    const [couponsRes, rewardsRes] = await Promise.all([couponsPromise, rewardsPromise])
    setCustomerCoupons(couponsRes.data || [])
    setRewardCoupons(rewardsRes.data || [])
    setLoading(false)
  }, [customer?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const checkMinPurchase = (coupon) => {
    const min = parseFloat(coupon.min_purchase_amount) || 0
    return subtotal >= min
  }

  const formatDiscount = (coupon) => {
    if (coupon.discount_type === 'percentage') return `${coupon.discount_value}%`
    return `$${coupon.discount_value}`
  }

  const handleRedeem = async (coupon) => {
    setError('')
    const isFree = (coupon.points_cost || 0) === 0
    if (!checkMinPurchase(coupon)) {
      setError(`Requiere compra mínima de $${coupon.min_purchase_amount}`)
      return
    }
    if (!isFree && !customer?.id) {
      setError('Este cupón requiere cliente registrado (puntos)')
      return
    }
    if ((customer?.points || 0) < coupon.points_cost) {
      setError(`Puntos insuficientes. Necesita ${coupon.points_cost} pts.`)
      return
    }
    const msg = isFree
      ? `¿Aplicar el cupón "${coupon.name}" a esta venta?`
      : `¿Canjear ${coupon.points_cost} puntos y aplicar el cupón "${coupon.name}" a esta venta?`
    if (!confirm(msg)) return
    try {
      await onRedeemRewardCoupon(coupon)
      setShowRedeem(false)
    } catch (e) {
      setError(e.message || 'Error al canjear')
    }
  }

  const handleApplyCustomer = async (coupon) => {
    setError('')
    if (!checkMinPurchase(coupon.reward_coupons)) {
      setError(`Requiere compra mínima de $${coupon.reward_coupons.min_purchase_amount}`)
      return
    }
    try {
      await onApplyCustomerCoupon(coupon)
    } catch (e) {
      setError(e.message || 'Error al aplicar')
    }
  }

  const getCouponInfo = () => {
    if (!appliedCoupon) return null
    if (appliedCoupon.type === 'reward') {
      return {
        name: appliedCoupon.coupon.name,
        discount: formatDiscount(appliedCoupon.coupon),
        pointsCost: appliedCoupon.coupon.points_cost,
      }
    }
    return {
      name: appliedCoupon.coupon.reward_coupons?.name,
      discount: formatDiscount(appliedCoupon.coupon.reward_coupons),
      pointsCost: null,
    }
  }

  const info = getCouponInfo()
  const registered = !!customer?.id
  const typed = !!((customer?.id_number || '').trim() && (customer?.name || '').trim())
  const canUseCoupons = registered || typed

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div className={styles.headerTitle}>
          <Gift size={16} />
          <span>Cupones y puntos</span>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.points}>
            <Coins size={12} /> {registered ? `${customer?.points || 0} pts` : 'Nuevo cliente'}
          </span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {expanded && (
        <div className={styles.body}>
          {!canUseCoupons ? (
            <p className={styles.emptyText}>Escribe la cédula y el nombre del cliente para aplicar cupones.</p>
          ) : loading ? (
            <p className={styles.emptyText}>Cargando...</p>
          ) : (
            <>
              {appliedCoupon ? (
                <div className={styles.appliedCoupon}>
                  <div className={styles.appliedInfo}>
                    <strong>{info.name}</strong>
                    <span>{info.discount} de descuento {info.pointsCost ? `· ${info.pointsCost} pts` : ''}</span>
                  </div>
                  <button className={styles.removeBtn} onClick={onRemoveCoupon} disabled={disabled}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  {customerCoupons.length > 0 && (
                    <div className={styles.couponList}>
                      <div className={styles.sectionLabel}>Cupones disponibles</div>
                      {customerCoupons.map((cc) => {
                        const qualifies = checkMinPurchase(cc.reward_coupons)
                        return (
                          <button
                            key={cc.id}
                            className={styles.couponBtn}
                            onClick={() => handleApplyCustomer(cc)}
                            disabled={disabled || !qualifies}
                          >
                            <div className={styles.couponIcon}>
                              {cc.reward_coupons.applies_to === 'sale' ? <ShoppingBag size={14} /> : <Package size={14} />}
                            </div>
                            <div className={styles.couponInfo}>
                              <strong>{cc.reward_coupons.name}</strong>
                              <span>{formatDiscount(cc.reward_coupons)} de descuento</span>
                            </div>
                            {!qualifies ? (
                              <span className={styles.couponLock}>Min. ${cc.reward_coupons.min_purchase_amount || 0}</span>
                            ) : (
                              <span className={styles.couponCode}>{cc.code.slice(-6)}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {rewardCoupons.length > 0 && (
                    <>
                      <button className={styles.redeemBtn} onClick={() => setShowRedeem(!showRedeem)} disabled={disabled}>
                        <Gift size={14} /> {registered ? 'Cupones y puntos' : 'Cupones especiales'}
                      </button>

                      {showRedeem && (
                        <div className={styles.redeemList}>
                          <div className={styles.sectionLabel}>{registered ? 'Cupones disponibles' : 'Cupones sin puntos'}</div>
                          {rewardCoupons.map((coupon) => {
                            const qualifies = checkMinPurchase(coupon)
                            const isFree = (parseFloat(coupon.points_cost) || 0) === 0
                            const enoughPoints = registered && (customer?.points || 0) >= coupon.points_cost
                            const canUse = qualifies && (isFree || enoughPoints)
                            return (
                              <button
                                key={coupon.id}
                                className={styles.redeemOption}
                                onClick={() => handleRedeem(coupon)}
                                disabled={disabled || !canUse}
                              >
                                <div className={styles.redeemInfo}>
                                  <strong>{coupon.name}</strong>
                                  <span>{formatDiscount(coupon)} de descuento · {coupon.applies_to === 'sale' ? 'Venta' : 'Producto'}</span>
                                  {!qualifies && (
                                    <span className={styles.minWarning}>Compra mínima: ${coupon.min_purchase_amount || 0}</span>
                                  )}
                                  {!isFree && !registered && (
                                    <span className={styles.minWarning}>Requiere cliente registrado</span>
                                  )}
                                </div>
                                <span className={`${styles.redeemCost} ${!canUse ? styles.insufficient : ''}`}>
                                  {isFree ? 'Sin puntos' : `${coupon.points_cost} pts`}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {error && <p className={styles.error}>{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
