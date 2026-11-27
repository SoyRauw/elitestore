-- Descuentos por categoría con porcentaje independiente por categoría.
-- Una campaña puede tener varias filas en day_discount_categories.

alter table public.day_discounts
  add column if not exists discount_scope text;

update public.day_discounts
set discount_scope = 'store'
where discount_scope is null;

alter table public.day_discounts
  alter column discount_scope set default 'store';

alter table public.day_discounts
  alter column discount_scope set not null;

alter table public.day_discounts
  drop constraint if exists day_discounts_discount_scope_check;

alter table public.day_discounts
  add constraint day_discounts_discount_scope_check
  check (discount_scope in ('store', 'categories'));

create table if not exists public.day_discount_categories (
  id uuid primary key default gen_random_uuid(),
  discount_id uuid not null
    references public.day_discounts(id) on delete cascade,
  category_id uuid not null
    references public.categories(id) on delete cascade,
  percentage numeric(5,2) not null
    check (percentage > 0 and percentage <= 100),
  created_at timestamptz not null default now(),
  constraint day_discount_categories_unique
    unique (discount_id, category_id)
);

create index if not exists idx_day_discount_categories_discount
  on public.day_discount_categories(discount_id);

create index if not exists idx_day_discount_categories_category
  on public.day_discount_categories(category_id);

grant select on public.day_discount_categories to anon, authenticated;
grant insert, update, delete on public.day_discount_categories to authenticated;

alter table public.day_discount_categories enable row level security;

drop policy if exists day_discount_categories_select on public.day_discount_categories;
drop policy if exists day_discount_categories_insert on public.day_discount_categories;
drop policy if exists day_discount_categories_update on public.day_discount_categories;
drop policy if exists day_discount_categories_delete on public.day_discount_categories;

create policy day_discount_categories_select
  on public.day_discount_categories
  for select using (true);

create policy day_discount_categories_insert
  on public.day_discount_categories
  for insert with check (auth.uid() is not null);

create policy day_discount_categories_update
  on public.day_discount_categories
  for update using (auth.uid() is not null)
  with check (auth.uid() is not null);

create policy day_discount_categories_delete
  on public.day_discount_categories
  for delete using (auth.uid() is not null);
