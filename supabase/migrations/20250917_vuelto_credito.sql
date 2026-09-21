-- Vuelto dejado en crédito en la tienda (store credit as change)

ALTER TABLE public.movement_payments
ADD COLUMN IF NOT EXISTS vuelto_credito numeric(12,2);
