-- Productos específicos con porcentaje dentro de una campaña.
-- El parent day_discounts mantiene discount_scope = 'categories' para
-- descuentos por artículos (categorías y/o productos).

create table if not exists public.day_discount_products (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null
    references public.day_discounts(id) on delete cascade,
  product_id text not null
    references public.products(id) on delete cascade,
  percentage numeric(5,2) not null
    check (percentage > 0 and percentage <= 100),
  created_at timestamptz not null default now(),
  constraint day_discount_products_unique
    unique (discount_id, product_id)
);

create index if not exists idx_day_discount_products_discount
  on public.day_discount_products(discount_id);

create index if not exists idx_day_discount_products_product
  on public.day_discount_products(product_id);

grant select on public.day_discount_products to anon, authenticated;
grant insert, update, delete on public.day_discount_products to authenticated;

alter table public.day_discount_products enable row level security;

drop policy if exists day_discount_products_select on public.day_discount_products;
drop policy if exists day_discount_products_insert on public.day_discount_products;
drop policy if exists day_discount_products_update on public.day_discount_products;
drop policy if exists day_discount_products_delete on public.day_discount_products;

create policy day_discount_products_select
  on public.day_discount_products
  for select using (true);

create policy day_discount_products_insert
  on public.day_discount_products
  for insert with check (auth.uid() is not null);

create policy day_discount_products_update
  on public.day_discount_products
  for update using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy day_discount_products_delete
  on public.day_discount_products
  for delete using (auth.uid() is not null);
