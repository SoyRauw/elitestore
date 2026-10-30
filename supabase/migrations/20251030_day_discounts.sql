-- Descuentos automáticos por días (compartidos Elite Store / USA Super Store).
-- La tabla vive en la base de Elite (autoridad) y USA la lee con el cliente compartido.
-- Se aplican solo a ventas de detal y no se acumulan con cupones.

CREATE TABLE IF NOT EXISTS public.day_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage'
    CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value > 0),
  dates date[] NOT NULL CHECK (cardinality(dates) > 0),
  is_active boolean NOT NULL DEFAULT true,
  store_scope text NOT NULL DEFAULT 'ambos'
    CHECK (store_scope IN ('elite', 'usa', 'ambos')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT day_discounts_percentage_max
    CHECK (discount_type <> 'percentage' OR discount_value <= 100)
);

CREATE INDEX IF NOT EXISTS idx_day_discounts_dates
  ON public.day_discounts USING GIN (dates);
CREATE INDEX IF NOT EXISTS idx_day_discounts_active
  ON public.day_discounts (is_active);

ALTER TABLE public.day_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS day_discounts_select ON public.day_discounts;
DROP POLICY IF EXISTS day_discounts_insert ON public.day_discounts;
DROP POLICY IF EXISTS day_discounts_update ON public.day_discounts;
DROP POLICY IF EXISTS day_discounts_delete ON public.day_discounts;

-- Lectura pública: USA consulta la tabla con su cliente compartido (anon).
CREATE POLICY day_discounts_select ON public.day_discounts
  FOR SELECT USING (true);

CREATE POLICY day_discounts_insert ON public.day_discounts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY day_discounts_update ON public.day_discounts
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY day_discounts_delete ON public.day_discounts
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Datos del descuento del día en cada venta.
ALTER TABLE public.movements
  ADD COLUMN IF NOT EXISTS day_discount_id uuid
    REFERENCES public.day_discounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS day_discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS day_discount_name text;
