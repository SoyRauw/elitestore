-- Migration: product pricing calculator fields
-- Run this in the Supabase SQL Editor (new query)

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS freight_cost NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_margin NUMERIC(5,2) DEFAULT 50;

-- Backfill existing products with sensible defaults based on current price
UPDATE public.products
SET cost_price = COALESCE(cost_price, 0),
    shipping_cost = COALESCE(shipping_cost, 0),
    freight_cost = COALESCE(freight_cost, 0),
    profit_margin = COALESCE(profit_margin, 50)
WHERE cost_price IS NULL
   OR shipping_cost IS NULL
   OR freight_cost IS NULL
   OR profit_margin IS NULL;

-- Ensure NOT NULL after backfill
ALTER TABLE public.products
ALTER COLUMN cost_price SET NOT NULL,
ALTER COLUMN shipping_cost SET NOT NULL,
ALTER COLUMN freight_cost SET NOT NULL,
ALTER COLUMN profit_margin SET NOT NULL;

-- Add check constraints for positive values
ALTER TABLE public.products
ADD CONSTRAINT chk_products_cost_price CHECK (cost_price >= 0),
ADD CONSTRAINT chk_products_shipping_cost CHECK (shipping_cost >= 0),
ADD CONSTRAINT chk_products_freight_cost CHECK (freight_cost >= 0),
ADD CONSTRAINT chk_products_profit_margin CHECK (profit_margin >= 0);
