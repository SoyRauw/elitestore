-- Apartado payments as first-class movements
-- Each inicial/abono becomes its own movement (movement_type = 'abono') linked
-- to the parent apartado via reference_movement_id.

-- 1. Denormalized amount paid on the parent apartado
ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) NOT NULL DEFAULT 0;

-- 2. Allow movement_type 'abono'
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.movements'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%movement_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.movements DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.movements ADD CONSTRAINT movements_movement_type_check
  CHECK (movement_type IN ('venta','devolucion','apartado','consignacion','abono'));

-- 3. Fast lookup of child movements by parent
CREATE INDEX IF NOT EXISTS idx_movements_reference
  ON public.movements(reference_movement_id);
