-- Migration: category prefixes for product codes (BLU-001-001)
-- Run this in the Supabase SQL Editor (new query)

ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS prefix TEXT;

-- Backfill prefixes for existing categories
DO $$
DECLARE
  rec RECORD;
  base TEXT;
  candidate TEXT;
  len INT;
  suffix INT;
BEGIN
  FOR rec IN SELECT id, name FROM public.categories ORDER BY created_at LOOP
    base := UPPER(REGEXP_REPLACE(rec.name, '[^a-zA-Z]', '', 'g'));
    IF LENGTH(base) = 0 THEN
      base := 'CAT';
    END IF;

    len := 3;
    candidate := SUBSTRING(base FROM 1 FOR len);

    WHILE EXISTS (SELECT 1 FROM public.categories WHERE prefix = candidate AND id != rec.id) LOOP
      len := len + 1;
      IF len <= LENGTH(base) THEN
        candidate := SUBSTRING(base FROM 1 FOR len);
      ELSE
        suffix := len - LENGTH(base);
        candidate := base || suffix::TEXT;
      END IF;
    END LOOP;

    UPDATE public.categories SET prefix = candidate WHERE id = rec.id;
  END LOOP;
END $$;

-- Ensure every category has a prefix and they are unique
ALTER TABLE public.categories
ALTER COLUMN prefix SET NOT NULL,
ADD CONSTRAINT categories_prefix_unique UNIQUE (prefix);
