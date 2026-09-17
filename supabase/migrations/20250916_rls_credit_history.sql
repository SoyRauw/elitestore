-- RLS for the credit history table.
-- Authenticated users (logged-in admin/seller) can read and write.

ALTER TABLE public.customer_credit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_credit_history_auth_all ON public.customer_credit_history;

CREATE POLICY customer_credit_history_auth_all
ON public.customer_credit_history
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
