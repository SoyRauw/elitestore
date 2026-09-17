-- Return reversal support.
-- Links each return line back to the original sale line so a return
-- can be fully reversed later (stock, returned_quantity, balance, points).

ALTER TABLE public.movement_items
ADD COLUMN IF NOT EXISTS original_item_id uuid REFERENCES public.movement_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movement_items_original_item_id
  ON public.movement_items(original_item_id);
