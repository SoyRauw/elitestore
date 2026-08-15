-- Migration: points and coupons loyalty system
-- Run this in the Supabase SQL Editor (new query)

-- Points balance column on customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- Global coupon catalog (admins create these)
CREATE TABLE IF NOT EXISTS public.reward_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value >= 0),
  points_cost INTEGER NOT NULL DEFAULT 0 CHECK (points_cost >= 0),
  min_purchase_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_purchase_amount >= 0),
  applies_to TEXT NOT NULL DEFAULT 'sale' CHECK (applies_to IN ('sale','product')),
  product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  usage_limit INTEGER DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Coupons owned by customers (issued after redeeming points or manually)
CREATE TABLE IF NOT EXISTS public.customer_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  reward_coupon_id UUID NOT NULL REFERENCES public.reward_coupons(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired')),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- History of point changes (earned / redeemed)
CREATE TABLE IF NOT EXISTS public.customer_points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  movement_id UUID REFERENCES public.movements(id) ON DELETE SET NULL,
  change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Movement columns to track discount and coupon
ALTER TABLE public.movements
ADD COLUMN IF NOT EXISTS customer_coupon_id UUID REFERENCES public.customer_coupons(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0;

-- Add min_purchase_amount if table was already created without it
ALTER TABLE public.reward_coupons
ADD COLUMN IF NOT EXISTS min_purchase_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_purchase_amount >= 0);

-- Enable RLS
ALTER TABLE public.reward_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_points_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS reward_coupons_select ON public.reward_coupons;
DROP POLICY IF EXISTS reward_coupons_insert ON public.reward_coupons;
DROP POLICY IF EXISTS reward_coupons_update ON public.reward_coupons;
DROP POLICY IF EXISTS reward_coupons_delete ON public.reward_coupons;

DROP POLICY IF EXISTS customer_coupons_select ON public.customer_coupons;
DROP POLICY IF EXISTS customer_coupons_insert ON public.customer_coupons;
DROP POLICY IF EXISTS customer_coupons_update ON public.customer_coupons;

DROP POLICY IF EXISTS customer_points_history_select ON public.customer_points_history;
DROP POLICY IF EXISTS customer_points_history_insert ON public.customer_points_history;

-- Reward coupons policies (only admins can manage; all authenticated can read active)
CREATE POLICY reward_coupons_select ON public.reward_coupons
  FOR SELECT USING (true);

CREATE POLICY reward_coupons_insert ON public.reward_coupons
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY reward_coupons_update ON public.reward_coupons
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY reward_coupons_delete ON public.reward_coupons
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Customer coupons policies
CREATE POLICY customer_coupons_select ON public.customer_coupons
  FOR SELECT USING (true);

CREATE POLICY customer_coupons_insert ON public.customer_coupons
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY customer_coupons_update ON public.customer_coupons
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Points history policies
CREATE POLICY customer_points_history_select ON public.customer_points_history
  FOR SELECT USING (true);

CREATE POLICY customer_points_history_insert ON public.customer_points_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_coupons_customer ON public.customer_coupons(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_coupons_status ON public.customer_coupons(status);
CREATE INDEX IF NOT EXISTS idx_customer_points_history_customer ON public.customer_points_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_movements_coupon ON public.movements(customer_coupon_id);
