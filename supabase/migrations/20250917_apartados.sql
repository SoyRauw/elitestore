-- Apartados (layaway) support

-- 1. movements: apartado metadata
ALTER TABLE public.movements
ADD COLUMN IF NOT EXISTS due_date timestamptz,
ADD COLUMN IF NOT EXISTS extended_count integer NOT NULL DEFAULT 0;

-- 2. movement_payments: every abono/inicial tied to the shift in which it was paid
ALTER TABLE public.movement_payments
ADD COLUMN IF NOT EXISTS cash_session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movement_payments_cash_session
  ON public.movement_payments(cash_session_id);
