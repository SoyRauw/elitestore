-- Unificación Elite Store + USA Super Store
-- Base única: Elite producción.
-- Este SQL es idempotente. Ejecutar completo en el SQL Editor de Supabase.

begin;

-- 1) Catálogo de tiendas
create table if not exists public.stores (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.stores (id, name)
values ('elite', 'Elite Store'), ('usa', 'USA Super Store')
on conflict (id) do update set name = excluded.name;

alter table public.stores enable row level security;
drop policy if exists stores_read on public.stores;
create policy stores_read on public.stores
  for select to authenticated using (true);

-- 2) Categorías
alter table public.categories add column if not exists store_id text;
update public.categories set store_id = 'elite' where store_id is null;
alter table public.categories alter column store_id set default 'elite';
alter table public.categories alter column store_id set not null;
create index if not exists idx_categories_store on public.categories(store_id);

-- 3) Productos
alter table public.products add column if not exists store_id text;
update public.products set store_id = 'elite' where store_id is null;
alter table public.products alter column store_id set default 'elite';
alter table public.products alter column store_id set not null;
create index if not exists idx_products_store on public.products(store_id);

-- 4) Variantes
alter table public.product_variants add column if not exists store_id text;
alter table public.product_variants add column if not exists active boolean not null default true;
update public.product_variants pv
   set store_id = p.store_id
  from public.products p
 where p.id = pv.product_id
   and pv.store_id is null;
update public.product_variants set store_id = 'elite' where store_id is null;
alter table public.product_variants alter column store_id set default 'elite';
alter table public.product_variants alter column store_id set not null;
create index if not exists idx_product_variants_store on public.product_variants(store_id);

-- 5) Movimientos: cabecera puede ser elite, usa o mixed
alter table public.movements add column if not exists store_id text;
update public.movements set store_id = 'elite' where store_id is null;
alter table public.movements alter column store_id set default 'elite';
alter table public.movements alter column store_id set not null;
alter table public.movements drop constraint if exists movements_store_id_check;
alter table public.movements add constraint movements_store_id_check
  check (store_id in ('elite', 'usa', 'mixed'));
create index if not exists idx_movements_store on public.movements(store_id);

-- 6) Líneas de movimiento: tienda exacta de cada prenda
alter table public.movement_items add column if not exists store_id text;
update public.movement_items mi
   set store_id = p.store_id
  from public.products p
 where p.id = mi.product_id
   and mi.store_id is null;
update public.movement_items set store_id = 'elite' where store_id is null;
alter table public.movement_items alter column store_id set default 'elite';
alter table public.movement_items alter column store_id set not null;
create index if not exists idx_movement_items_store on public.movement_items(store_id);

-- 7) Gastos
alter table public.expenses add column if not exists store_id text;
update public.expenses set store_id = 'elite' where store_id is null;
alter table public.expenses alter column store_id set default 'elite';
alter table public.expenses alter column store_id set not null;
create index if not exists idx_expenses_store on public.expenses(store_id);

-- 8) Regalos
alter table public.gift_movements add column if not exists store_id text;
update public.gift_movements set store_id = 'elite' where store_id is null;
alter table public.gift_movements alter column store_id set default 'elite';
alter table public.gift_movements alter column store_id set not null;
create index if not exists idx_gift_movements_store on public.gift_movements(store_id);

alter table public.gift_items add column if not exists store_id text;
update public.gift_items gi
   set store_id = p.store_id
  from public.products p
 where p.id = gi.product_id
   and gi.store_id is null;
update public.gift_items set store_id = 'elite' where store_id is null;
alter table public.gift_items alter column store_id set default 'elite';
alter table public.gift_items alter column store_id set not null;
create index if not exists idx_gift_items_store on public.gift_items(store_id);

-- 9) Ajustes de inventario (si la tabla existe)
do $$
begin
  if to_regclass('public.inventory_adjustments') is not null then
    alter table public.inventory_adjustments add column if not exists store_id text;
    update public.inventory_adjustments set store_id = 'elite' where store_id is null;
    alter table public.inventory_adjustments alter column store_id set default 'elite';
    alter table public.inventory_adjustments alter column store_id set not null;
    create index if not exists idx_inventory_adjustments_store
      on public.inventory_adjustments(store_id);
  end if;
end $$;

-- 10) Llaves foráneas de tienda
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'categories_store_id_fkey') then
    alter table public.categories add constraint categories_store_id_fkey
      foreign key (store_id) references public.stores(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_store_id_fkey') then
    alter table public.products add constraint products_store_id_fkey
      foreign key (store_id) references public.stores(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_variants_store_id_fkey') then
    alter table public.product_variants add constraint product_variants_store_id_fkey
      foreign key (store_id) references public.stores(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'movement_items_store_id_fkey') then
    alter table public.movement_items add constraint movement_items_store_id_fkey
      foreign key (store_id) references public.stores(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'expenses_store_id_fkey') then
    alter table public.expenses add constraint expenses_store_id_fkey
      foreign key (store_id) references public.stores(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gift_movements_store_id_fkey') then
    alter table public.gift_movements add constraint gift_movements_store_id_fkey
      foreign key (store_id) references public.stores(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gift_items_store_id_fkey') then
    alter table public.gift_items add constraint gift_items_store_id_fkey
      foreign key (store_id) references public.stores(id);
  end if;
end $$;

-- 11) Triggers: la variante/línea siempre hereda la tienda del producto
create or replace function public.sync_variant_store()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select store_id into new.store_id from public.products where id = new.product_id;
  if new.store_id is null then new.store_id := 'elite'; end if;
  return new;
end;
$$;

drop trigger if exists trg_variant_store on public.product_variants;
create trigger trg_variant_store
before insert or update of product_id on public.product_variants
for each row execute function public.sync_variant_store();

create or replace function public.sync_product_store_variants()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.product_variants
     set store_id = new.store_id
   where product_id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_product_store_variants on public.products;
create trigger trg_product_store_variants
after update of store_id on public.products
for each row when (old.store_id is distinct from new.store_id)
execute function public.sync_product_store_variants();

create or replace function public.sync_movement_item_store()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select store_id into new.store_id from public.products where id = new.product_id;
  if new.store_id is null then new.store_id := 'elite'; end if;
  return new;
end;
$$;

drop trigger if exists trg_movement_item_store on public.movement_items;
create trigger trg_movement_item_store
before insert or update of product_id on public.movement_items
for each row execute function public.sync_movement_item_store();

create or replace function public.sync_gift_item_store()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select store_id into new.store_id from public.products where id = new.product_id;
  if new.store_id is null then new.store_id := 'elite'; end if;
  return new;
end;
$$;

drop trigger if exists trg_gift_item_store on public.gift_items;
create trigger trg_gift_item_store
before insert or update of product_id on public.gift_items
for each row execute function public.sync_gift_item_store();

commit;

-- Verificación rápida
select 'stores' as tabla, count(*) from public.stores
union all
select 'categories', count(*) from public.categories
union all
select 'products', count(*) from public.products
union all
select 'product_variants', count(*) from public.product_variants
union all
select 'movements', count(*) from public.movements
union all
select 'movement_items', count(*) from public.movement_items
union all
select 'expenses', count(*) from public.expenses
union all
select 'gift_movements', count(*) from public.gift_movements
union all
select 'gift_items', count(*) from public.gift_items;
