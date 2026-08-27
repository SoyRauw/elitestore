-- Ensure product_variants can store a per-variant image.
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS image text;
