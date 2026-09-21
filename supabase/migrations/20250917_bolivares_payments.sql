-- Rapikom + Efectivo en bolívares + tasa euro (Bs/$)

-- 1. New payment methods in the check constraints
ALTER TABLE public.movements
DROP CONSTRAINT IF EXISTS movements_payment_method_check;

ALTER TABLE public.movements
ADD CONSTRAINT movements_payment_method_check
CHECK (payment_method IN ('efectivo','pago_movil','zelle','zinli','binance','transferencia','punto','pendiente','multiple','credito','rapikom','efectivo_bs'));

ALTER TABLE public.movement_payments
DROP CONSTRAINT IF EXISTS movement_payments_method_check;

ALTER TABLE public.movement_payments
ADD CONSTRAINT movement_payments_method_check
CHECK (method IN ('efectivo','pago_movil','zelle','zinli','binance','transferencia','punto','pendiente','multiple','credito','rapikom','efectivo_bs'));

-- 2. Cash session: euro rate used during the shift and Bs drawer reconciliation
ALTER TABLE public.cash_sessions
ADD COLUMN IF NOT EXISTS exchange_rate numeric(14,4),
ADD COLUMN IF NOT EXISTS expected_bs numeric(12,2),
ADD COLUMN IF NOT EXISTS closing_bs numeric(12,2);

-- 3. Track the native Bs amount + rate used per payment (null for USD payments)
ALTER TABLE public.movement_payments
ADD COLUMN IF NOT EXISTS bs_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS bs_rate numeric(14,4);
