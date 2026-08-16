-- ⚠️⚠️⚠️ WARNING: DESTRUCTIVE SCRIPT ⚠️⚠️⚠️
-- This script deletes ALL business data: sales, products, inventory, customers,
-- coupons, points history and cash sessions.
-- Run this ONLY in Supabase SQL Editor when you want to start from scratch.
-- Categories and user accounts are preserved.

-- 1. Sales-related data (delete children first)
DELETE FROM public.movement_items;
DELETE FROM public.movement_payments;
DELETE FROM public.customer_points_history;
DELETE FROM public.customer_coupons;
DELETE FROM public.movements;

-- 2. Cash register sessions
DELETE FROM public.cash_sessions;

-- 3. Inventory and products
DELETE FROM public.product_variants;
DELETE FROM public.products;

-- 4. Customers and loyalty coupons
DELETE FROM public.customers;
DELETE FROM public.reward_coupons;

-- NOTE: Product images in Supabase Storage are NOT deleted by this script.
-- To remove them, go to Supabase → Storage → product-images bucket → Empty bucket.
