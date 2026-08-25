-- Add Zinli and Binance payment methods
ALTER TABLE public.movements
DROP CONSTRAINT IF EXISTS movements_payment_method_check;

ALTER TABLE public.movements
ADD CONSTRAINT movements_payment_method_check
CHECK (payment_method IN ('efectivo','pago_movil','zelle','zinli','binance','transferencia','punto','pendiente','multiple'));

ALTER TABLE public.movement_payments
DROP CONSTRAINT IF EXISTS movement_payments_method_check;

ALTER TABLE public.movement_payments
ADD CONSTRAINT movement_payments_method_check
CHECK (method IN ('efectivo','pago_movil','zelle','zinli','binance','transferencia','punto','pendiente','multiple'));
