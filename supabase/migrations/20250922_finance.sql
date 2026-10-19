-- Módulo Finanzas: gastos, compras y costo congelado por unidad vendida

-- 1) Categorías de gastos (editables)
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#C4788A',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Gastos (variables y fijos mensuales)
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT current_date,
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  payment_method text,
  notes text,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence text NOT NULL DEFAULT 'once' CHECK (recurrence IN ('once','monthly')),
  recurring_start date,
  recurring_end date,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);

-- 3) Costo congelado al momento de la venta
ALTER TABLE public.movement_items
  ADD COLUMN IF NOT EXISTS unit_cost numeric(12,2) NOT NULL DEFAULT 0;

-- 5) RLS
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expense_categories_auth ON public.expense_categories;
CREATE POLICY expense_categories_auth ON public.expense_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS expenses_auth ON public.expenses;
CREATE POLICY expenses_auth ON public.expenses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6) Categorías iniciales
INSERT INTO public.expense_categories (name, color) VALUES
  ('Alquiler', '#C4788A'),
  ('Servicios', '#D4A017'),
  ('Sueldos', '#7C9A92'),
  ('Flete', '#8A6D3B'),
  ('Publicidad', '#B5697C'),
  ('Empaque', '#9C7FA8'),
  ('Otros', '#6B7280')
ON CONFLICT (name) DO NOTHING;

-- 7) Recalcular costo de ventas históricas desde el costo actual del producto
CREATE OR REPLACE FUNCTION public.backfill_movement_item_costs(p_overwrite boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.movement_items mi
  SET unit_cost = COALESCE(p.cost_price, 0)
                + COALESCE(p.shipping_cost, 0)
                + COALESCE(p.freight_cost, 0)
  FROM public.products p
  WHERE mi.product_id = p.id
    AND (p_overwrite OR COALESCE(mi.unit_cost, 0) = 0);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.backfill_movement_item_costs(boolean) TO authenticated;
