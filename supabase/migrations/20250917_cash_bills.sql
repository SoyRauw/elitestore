-- Cash drawer bill tracking (USD bills only)

CREATE TABLE IF NOT EXISTS public.cash_bill_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  movement_id uuid REFERENCES public.movements(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('apertura','venta','vuelto','ajuste','cierre')),
  denomination numeric NOT NULL CHECK (denomination IN (100,50,20,10,5,2,1)),
  quantity integer NOT NULL CHECK (quantity > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_bill_movements_session
  ON public.cash_bill_movements(session_id);

CREATE INDEX IF NOT EXISTS idx_cash_bill_movements_movement
  ON public.cash_bill_movements(movement_id);

ALTER TABLE public.cash_bill_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cash_bill_movements_auth_all ON public.cash_bill_movements;

CREATE POLICY cash_bill_movements_auth_all
ON public.cash_bill_movements
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
