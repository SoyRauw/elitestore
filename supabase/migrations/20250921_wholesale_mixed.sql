-- Venta mixta: detal + mayor en una misma venta
-- 1. Nuevo valor 'mixed' para el tipo de venta
-- 2. Marcar por línea si el ítem fue vendido al mayor

ALTER TABLE public.movements DROP CONSTRAINT IF EXISTS movements_sale_type_check;
ALTER TABLE public.movements ADD CONSTRAINT movements_sale_type_check
  CHECK (sale_type IN ('retail','wholesale','mixed'));

ALTER TABLE public.movement_items
  ADD COLUMN IF NOT EXISTS is_wholesale boolean NOT NULL DEFAULT false;
