-- Dress Dreams by Nihara: customer orders submitted directly to Supabase.
-- Run this entire file once in Supabase Dashboard -> SQL Editor -> New query.

create extension if not exists pgcrypto;

create table if not exists public.store_orders (
    id uuid primary key default gen_random_uuid(),
    order_number text not null unique,
    customer_name text not null,
    customer_phone text not null,
    customer_email text,
    delivery_address text not null,
    pincode text not null,
    utr text not null,
    total_amount numeric(12,2) not null check (total_amount > 0),
    items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
    payment_status text not null default 'pending_verification'
        check (payment_status in ('pending_verification','verified','rejected')),
    order_status text not null default 'new'
        check (order_status in ('new','processing','shipped','delivered','cancelled')),
    created_at timestamptz not null default now()
);

create or replace function public.dd_prepare_store_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.id := coalesce(new.id, gen_random_uuid());
    new.order_number := 'DD-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' ||
        upper(substr(replace(new.id::text, '-', ''), 1, 8));
    -- Never trust a browser to mark its own payment/order as verified.
    new.payment_status := 'pending_verification';
    new.order_status := 'new';
    new.created_at := now();
    return new;
end;
$$;

drop trigger if exists dd_prepare_store_order_trigger on public.store_orders;
create trigger dd_prepare_store_order_trigger
before insert on public.store_orders
for each row execute function public.dd_prepare_store_order();

alter table public.store_orders enable row level security;

grant usage on schema public to anon, authenticated;
grant insert on public.store_orders to anon, authenticated;
grant select, update on public.store_orders to authenticated;

drop policy if exists "Customers can submit orders" on public.store_orders;
create policy "Customers can submit orders"
on public.store_orders for insert
to anon, authenticated
with check (
    length(trim(customer_name)) between 1 and 100
    and length(trim(customer_phone)) between 8 and 18
    and length(trim(delivery_address)) between 5 and 600
    and pincode ~ '^[0-9]{6}$'
    and length(trim(utr)) between 6 and 40
    and total_amount > 0
    and jsonb_typeof(items) = 'array'
);

drop policy if exists "Store admins can view orders" on public.store_orders;
create policy "Store admins can view orders"
on public.store_orders for select
to authenticated
using (public.is_store_admin());

drop policy if exists "Store admins can update orders" on public.store_orders;
create policy "Store admins can update orders"
on public.store_orders for update
to authenticated
using (public.is_store_admin())
with check (public.is_store_admin());

-- No public SELECT policy is created: customers cannot read other customers' orders.

-- Enable live order notifications for the admin dashboard (if publication exists).
do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
           select 1 from pg_publication_tables
           where pubname = 'supabase_realtime'
             and schemaname = 'public'
             and tablename = 'store_orders'
       ) then
        alter publication supabase_realtime add table public.store_orders;
    end if;
end;
$$;
