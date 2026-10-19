-- Permitir margen de ganancia negativo (productos vendidos por debajo del costo).
-- El margen real se muestra en rojo en el formulario.

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_profit_margin_check;
