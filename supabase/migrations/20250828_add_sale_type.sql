-- Add sale_type to movements to distinguish retail vs wholesale sales
ALTER TABLE public.movements
ADD COLUMN IF NOT EXISTS sale_type text DEFAULT 'retail';

ALTER TABLE public.movements
DROP CONSTRAINT IF EXISTS movements_sale_type_check;

ALTER TABLE public.movements
ADD CONSTRAINT movements_sale_type_check
CHECK (sale_type IN ('retail', 'wholesale'));
