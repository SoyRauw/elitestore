-- Regalos: prendas entregadas sin cobro.
-- No son ventas: descuentan stock y generan un gasto automático en Finanzas
-- bajo la categoría "Regalos". No dependen del SQL de auditoría pendiente.

-- 1) Cabecera del regalo
CREATE TABLE IF NOT EXISTS public.gift_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  gift_date date NOT NULL DEFAULT current_date,
  user_id uuid,
  user_name text,
  recipient_name text,
  recipient_phone text,
  reason text NOT NULL DEFAULT 'Cortesía',
  notes text,
  total_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  status text NOT NULL DEFAULT 'entregado' CHECK (status IN ('entregado', 'anulada')),
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  voided_at timestamptz,
  voided_by uuid,
  voided_by_name text
);

-- 2) Detalle: una fila por prenda regalada
CREATE TABLE IF NOT EXISTS public.gift_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id uuid NOT NULL REFERENCES public.gift_movements(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  variant_label text,
  sku text,
  size text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  line_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (line_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_movements_date
  ON public.gift_movements(gift_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_movements_status
  ON public.gift_movements(status);
CREATE INDEX IF NOT EXISTS idx_gift_items_gift
  ON public.gift_items(gift_id);
CREATE INDEX IF NOT EXISTS idx_gift_items_variant
  ON public.gift_items(variant_id);

-- 3) RLS: solo admin puede leer. Las escrituras pasan por las RPC.
ALTER TABLE public.gift_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gift_movements_admin_select ON public.gift_movements;
CREATE POLICY gift_movements_admin_select ON public.gift_movements
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS gift_items_admin_select ON public.gift_items;
CREATE POLICY gift_items_admin_select ON public.gift_items
  FOR SELECT TO authenticated USING (public.is_admin());

REVOKE ALL ON TABLE public.gift_movements FROM anon, authenticated;
REVOKE ALL ON TABLE public.gift_items FROM anon, authenticated;
GRANT SELECT ON TABLE public.gift_movements TO authenticated;
GRANT SELECT ON TABLE public.gift_items TO authenticated;

-- 4) Registrar un regalo: valida admin y stock, descuenta, congela costo
--    y crea el gasto en Finanzas. Todo dentro de una sola transacción.
CREATE OR REPLACE FUNCTION public.admin_register_gift(
  p_items jsonb,
  p_recipient_name text DEFAULT NULL,
  p_recipient_phone text DEFAULT NULL,
  p_reason text DEFAULT 'Cortesía',
  p_notes text DEFAULT NULL,
  p_gift_date date DEFAULT current_date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_user_name text;
  v_gift_id uuid;
  v_expense_id uuid;
  v_category_id uuid;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_stock integer;
  v_product_id uuid;
  v_product_name text;
  v_variant_label text;
  v_sku text;
  v_size text;
  v_unit_cost numeric(12,2);
  v_line_cost numeric(12,2);
  v_items_summary text;
  v_description text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede registrar regalos';
  END IF;

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos una prenda al regalo';
  END IF;

  SELECT COALESCE(NULLIF(p.name, ''), NULLIF(p.username, ''), p.email, 'Admin')
    INTO v_user_name
    FROM public.profiles p
   WHERE p.id = v_user
   LIMIT 1;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) AS item(value)
  LOOP
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::integer, 0);

    IF v_variant_id IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Cada prenda necesita una variante y una cantidad mayor a cero';
    END IF;

    SELECT
      COALESCE(pv.stock, 0),
      pv.product_id,
      pv.sku,
      pv.size,
      NULLIF(TRIM(CONCAT_WS(' ', pv.color, pv.variant_name, pv.size)), ''),
      p.name,
      ROUND(
        COALESCE(p.cost_price, 0) +
        COALESCE(p.shipping_cost, 0) +
        COALESCE(p.freight_cost, 0),
        2
      )
    INTO
      v_stock, v_product_id, v_sku, v_size, v_variant_label,
      v_product_name, v_unit_cost
    FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = v_variant_id
    FOR UPDATE OF pv;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variante no encontrada: %', v_variant_id;
    END IF;

    IF v_stock < v_quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para %: hay % y se intentan regalar %',
        v_product_name, v_stock, v_quantity;
    END IF;

    -- Se descuenta en el momento para que dos líneas de la misma variante
    -- no puedan regalar más de lo disponible.
    UPDATE public.product_variants
       SET stock = stock - v_quantity
     WHERE id = v_variant_id;

    v_line_cost := ROUND(v_unit_cost * v_quantity, 2);
    v_total := v_total + v_line_cost;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'variant_id', v_variant_id,
      'product_name', v_product_name,
      'variant_label', COALESCE(v_variant_label, v_sku, 'Variante'),
      'sku', v_sku,
      'size', v_size,
      'quantity', v_quantity,
      'unit_cost', v_unit_cost,
      'line_cost', v_line_cost
    ));
  END LOOP;

  v_total := ROUND(v_total, 2);

  INSERT INTO public.gift_movements (
    gift_date, user_id, user_name, recipient_name, recipient_phone,
    reason, notes, total_cost, status
  ) VALUES (
    COALESCE(p_gift_date, current_date),
    v_user,
    COALESCE(v_user_name, 'Admin'),
    NULLIF(TRIM(p_recipient_name), ''),
    NULLIF(TRIM(p_recipient_phone), ''),
    COALESCE(NULLIF(TRIM(p_reason), ''), 'Cortesía'),
    NULLIF(TRIM(p_notes), ''),
    v_total,
    'entregado'
  )
  RETURNING id INTO v_gift_id;

  INSERT INTO public.gift_items (
    gift_id, product_id, variant_id, product_name, variant_label,
    sku, size, quantity, unit_cost, line_cost
  )
  SELECT
    v_gift_id, x.product_id, x.variant_id, x.product_name, x.variant_label,
    x.sku, x.size, x.quantity, x.unit_cost, x.line_cost
  FROM jsonb_to_recordset(v_rows) AS x(
    product_id uuid,
    variant_id uuid,
    product_name text,
    variant_label text,
    sku text,
    size text,
    quantity integer,
    unit_cost numeric,
    line_cost numeric
  );

  -- Categoría de gasto "Regalos"
  INSERT INTO public.expense_categories (name, color)
  VALUES ('Regalos', '#8A6D3B')
  ON CONFLICT (name) DO NOTHING;

  SELECT id INTO v_category_id
    FROM public.expense_categories
   WHERE name = 'Regalos'
   LIMIT 1;

  SELECT STRING_AGG(DISTINCT value->>'product_name', ', ')
    INTO v_items_summary
    FROM jsonb_array_elements(v_rows) AS item(value);

  v_description := 'Regalo: ' ||
    COALESCE(NULLIF(TRIM(p_recipient_name), ''), 'sin destinatario');

  IF v_items_summary IS NOT NULL THEN
    v_description := v_description || ' · ' || v_items_summary;
  END IF;

  INSERT INTO public.expenses (
    expense_date, category_id, description, amount, notes,
    created_by, recurrence, active
  ) VALUES (
    COALESCE(p_gift_date, current_date),
    v_category_id,
    v_description,
    v_total,
    CONCAT_WS(' · ', NULLIF(TRIM(p_notes), ''), 'Regalo ' || v_gift_id::text),
    v_user,
    'once',
    true
  )
  RETURNING id INTO v_expense_id;

  UPDATE public.gift_movements
     SET expense_id = v_expense_id
   WHERE id = v_gift_id;

  RETURN v_gift_id;
END;
$$;

-- 5) Anular un regalo: devuelve stock y elimina el gasto asociado.
CREATE OR REPLACE FUNCTION public.admin_void_gift(p_gift_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_expense_id uuid;
  v_item record;
  v_user_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede anular regalos';
  END IF;

  SELECT status, expense_id
    INTO v_status, v_expense_id
    FROM public.gift_movements
   WHERE id = p_gift_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regalo no encontrado';
  END IF;

  IF v_status <> 'entregado' THEN
    RAISE EXCEPTION 'Este regalo ya está anulado';
  END IF;

  FOR v_item IN
    SELECT variant_id, quantity
      FROM public.gift_items
     WHERE gift_id = p_gift_id
  LOOP
    IF v_item.variant_id IS NOT NULL THEN
      UPDATE public.product_variants
         SET stock = stock + v_item.quantity
       WHERE id = v_item.variant_id;
    END IF;
  END LOOP;

  SELECT COALESCE(NULLIF(p.name, ''), NULLIF(p.username, ''), p.email, 'Admin')
    INTO v_user_name
    FROM public.profiles p
   WHERE p.id = auth.uid()
   LIMIT 1;

  UPDATE public.gift_movements
     SET status = 'anulada',
         voided_at = now(),
         voided_by = auth.uid(),
         voided_by_name = COALESCE(v_user_name, 'Admin')
   WHERE id = p_gift_id;

  IF v_expense_id IS NOT NULL THEN
    DELETE FROM public.expenses WHERE id = v_expense_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_register_gift(jsonb, text, text, text, text, date) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_register_gift(jsonb, text, text, text, text, date) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_void_gift(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_void_gift(uuid) TO authenticated;
