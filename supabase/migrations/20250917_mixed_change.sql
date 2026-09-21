-- Vuelto mixto: Bs efectivo y pago móvil como formas de dar vuelto

-- On the cash payment row we store how the change was given:
-- vuelto_bs        → Bs handed from the Bs drawer (subtracts from Bs expected)
-- vuelto_pm_amount → $ equivalent given as change via pago móvil (no drawer effect)
-- vuelto_pm_reference → transaction reference for the PM change
ALTER TABLE public.movement_payments
ADD COLUMN IF NOT EXISTS vuelto_bs numeric(12,2),
ADD COLUMN IF NOT EXISTS vuelto_pm_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS vuelto_pm_reference text;
