-- Gift cards (Elite = autoridad, compartida con USA)
-- A gift card is sold (movement_type 'giftcard') and later used as a payment
-- method ('giftcard') in any sale. Single use.

CREATE TABLE IF NOT EXISTS public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'activa' CHECK (status IN ('activa','usada','anulada')),
  store text NOT NULL DEFAULT 'elite',
  buyer_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  buyer_name text,
  buyer_id_number text,
  recipient_name text,
  notes text,
  expires_at timestamptz,
  purchase_movement_id uuid,
  used_movement_id uuid,
  used_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  used_amount numeric(12,2),
  balance_to_credit numeric(12,2) NOT NULL DEFAULT 0,
  used_at timestamptz,
  annulled_at timestamptz,
  annul_refund_method text,
  annul_movement_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON public.gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON public.gift_cards(status);

-- movement_type + payment methods
ALTER TABLE public.movements DROP CONSTRAINT IF EXISTS movements_movement_type_check;
ALTER TABLE public.movements ADD CONSTRAINT movements_movement_type_check
  CHECK (movement_type IN ('venta','devolucion','apartado','consignacion','abono','giftcard'));

ALTER TABLE public.movements DROP CONSTRAINT IF EXISTS movements_payment_method_check;
ALTER TABLE public.movements ADD CONSTRAINT movements_payment_method_check
  CHECK (payment_method IN ('efectivo','pago_movil','zelle','zinli','binance','transferencia','punto','pendiente','multiple','credito','rapikom','efectivo_bs','giftcard'));

ALTER TABLE public.movement_payments DROP CONSTRAINT IF EXISTS movement_payments_method_check;
ALTER TABLE public.movement_payments ADD CONSTRAINT movement_payments_method_check
  CHECK (method IN ('efectivo','pago_movil','zelle','zinli','binance','transferencia','punto','pendiente','multiple','credito','rapikom','efectivo_bs','giftcard'));

-- RLS: authenticated (Elite) + shared (USA con anon)
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gift_cards_auth_all ON public.gift_cards;
CREATE POLICY gift_cards_auth_all ON public.gift_cards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS gift_cards_shared ON public.gift_cards;
CREATE POLICY gift_cards_shared ON public.gift_cards
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
