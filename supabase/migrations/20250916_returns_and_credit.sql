-- Returns & store-credit support

-- 1. Customer store-credit balance
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS balance numeric(12,2) NOT NULL DEFAULT 0;

-- 2. Track how many units of a line have been returned
ALTER TABLE public.movement_items
ADD COLUMN IF NOT EXISTS returned_quantity integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

-- 3. Track credit used as payment and link returns to original invoices
ALTER TABLE public.movements
ADD COLUMN IF NOT EXISTS credit_amount numeric(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS reference_movement_id uuid REFERENCES public.movements(id) ON DELETE SET NULL;

-- 4. Ledger of credit changes (returns = positive, purchases = negative)
CREATE TABLE IF NOT EXISTS public.customer_credit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  movement_id uuid REFERENCES public.movements(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast customer history lookups
CREATE INDEX IF NOT EXISTS idx_customer_credit_history_customer_id
  ON public.customer_credit_history(customer_id);
