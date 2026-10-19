-- Recurrencias de gastos: semanal, quincenal (15 y último día), mensual y anual

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_recurrence_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_recurrence_check
  CHECK (recurrence IN ('once','weekly','semimonthly','monthly','yearly'));
