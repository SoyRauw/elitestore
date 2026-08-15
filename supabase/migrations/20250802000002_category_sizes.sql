-- Migration: category sizes and barcode index
-- Run this in the Supabase SQL Editor (new query)

-- Category measurement label and options
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS size_label TEXT DEFAULT 'Talla',
ADD COLUMN IF NOT EXISTS size_options TEXT[] DEFAULT ARRAY['XS','S','M','L','XL','2XL','UNI'];

-- Ensure existing categories have defaults
UPDATE public.categories
SET size_label = COALESCE(size_label, 'Talla'),
    size_options = COALESCE(size_options, ARRAY['XS','S','M','L','XL','2XL','UNI'])
WHERE size_label IS NULL OR size_options IS NULL;

-- Update Owala category if it exists
UPDATE public.categories
SET size_label = 'Onzas', size_options = ARRAY['24 oz', '32 oz', '40 oz']
WHERE name ILIKE 'owala';

-- Make columns NOT NULL after backfill
ALTER TABLE public.categories
ALTER COLUMN size_label SET NOT NULL,
ALTER COLUMN size_options SET NOT NULL;

-- Index for barcode scanner in POS
CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON public.product_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku);
