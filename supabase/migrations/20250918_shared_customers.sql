-- Clientes, saldo, puntos y cupones COMPARTIDOS entre Elite/USA (autoridad = Elite)

-- 1. Los movimientos pueden venir de cualquier tienda (ids de USA)
ALTER TABLE public.customer_credit_history
  DROP CONSTRAINT IF EXISTS customer_credit_history_movement_id_fkey;

ALTER TABLE public.customer_points_history
  DROP CONSTRAINT IF EXISTS customer_points_history_movement_id_fkey;

-- 2. Alcance de cupones: elite / usa / ambos
ALTER TABLE public.reward_coupons
  ADD COLUMN IF NOT EXISTS store_scope text NOT NULL DEFAULT 'ambos';

-- 3. RLS permisivas para clientes/crédito/puntos/cupones
--    (USA llega con rol anon; las políticas van PRIMERO)
CREATE POLICY customers_shared ON public.customers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY credit_hist_shared ON public.customer_credit_history
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY points_hist_shared ON public.customer_points_history
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY coupons_reward_shared ON public.reward_coupons
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY coupons_customer_shared ON public.customer_coupons
  FOR ALL USING (true) WITH CHECK (true);

-- 4. RLS al final (nunca sin políticas previas)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_points_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_coupons ENABLE ROW LEVEL SECURITY;
