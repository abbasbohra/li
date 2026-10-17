-- Run once in Supabase -> SQL Editor. Safe to run again.
-- ALL permission checks live here in the database, so they cannot be bypassed from the app.

-- ===== 1. Roles: admin, sales, delivery =====
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('admin','sales','delivery'));
alter table profiles add column if not exists full_name text;
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists active boolean not null default true;

create or replace function current_role_name() returns text
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and active $$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(current_role_name() = 'admin', false) $$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  insert into public.profiles(id, full_name) values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict do nothing;
  return new;
end $$;

drop policy if exists "admin read profiles" on profiles;
create policy "admin read profiles" on profiles for select using (is_admin());

-- Only admin and sales can read the product catalogue (delivery staff cannot)
drop policy if exists "read products" on products;
create policy "read products" on products for select to authenticated
  using (current_role_name() in ('admin','sales'));
drop policy if exists "read images" on product_images;
create policy "read images" on product_images for select to authenticated
  using (current_role_name() in ('admin','sales'));

-- ===== 2. Stock =====
alter table stock_movements add column if not exists note text;
drop function if exists adjust_stock(uuid, int, text);

create or replace function adjust_stock(p_id uuid, qty int, p_reason text, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare r text := current_role_name(); new_stock int;
begin
  if r is null then raise exception 'not allowed'; end if;
  if p_reason = 'sale' then
    if r not in ('admin','sales') then raise exception 'not allowed'; end if;
    if qty >= 0 then raise exception 'a sale must reduce stock'; end if;
  elsif p_reason in ('purchase','adjustment','return') then
    if r <> 'admin' then raise exception 'admin only'; end if;
  else raise exception 'invalid reason'; end if;
  update products set stock = stock + qty where id = p_id returning stock into new_stock;
  if not found then raise exception 'product not found'; end if;
  if new_stock < 0 then raise exception 'not enough stock'; end if;
  insert into stock_movements(product_id, change, reason, note) values (p_id, qty, p_reason, p_note);
  return new_stock;
end $$;

create or replace function set_stock(p_id uuid, p_count int, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare cur int;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  if p_count < 0 then raise exception 'count cannot be negative'; end if;
  select stock into cur from products where id = p_id for update;
  if not found then raise exception 'product not found'; end if;
  update products set stock = p_count where id = p_id;
  insert into stock_movements(product_id, change, reason, note)
    values (p_id, p_count - cur, 'adjustment', trim(coalesce(p_note,'') || ' (set to ' || p_count || ')'));
  return p_count;
end $$;

-- ===== 3. Deliveries =====
create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text,
  address text not null,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','assigned','out_for_delivery','delivered','cancelled')),
  assigned_to uuid references profiles(id),
  assigned_name text,
  created_by uuid not null default auth.uid() references profiles(id),
  created_by_name text,
  created_at timestamptz default now(),
  delivered_at timestamptz
);
create table if not exists delivery_items (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references deliveries on delete cascade,
  product_id uuid not null references products,
  product_name text not null,
  qty int not null check (qty > 0),
  price numeric(10,2) not null default 0
);
alter table deliveries enable row level security;
alter table delivery_items enable row level security;
-- read only: admin sees all, sales see their own, delivery staff see what is assigned to them. No direct writes.
drop policy if exists "see deliveries" on deliveries;
create policy "see deliveries" on deliveries for select to authenticated
  using (current_role_name() is not null and (is_admin() or created_by = auth.uid() or assigned_to = auth.uid()));
drop policy if exists "see delivery items" on delivery_items;
create policy "see delivery items" on delivery_items for select to authenticated
  using (exists (select 1 from deliveries d where d.id = delivery_id));

create or replace function create_delivery(p_name text, p_phone text, p_address text, p_notes text, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare r text := current_role_name(); d_id uuid; it jsonb; prod products%rowtype; q int; uname text;
begin
  if r not in ('admin','sales') then raise exception 'not allowed'; end if;
  if coalesce(trim(p_name),'') = '' or coalesce(trim(p_address),'') = '' then
    raise exception 'customer name and address are required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'add at least one item'; end if;
  select full_name into uname from profiles where id = auth.uid();
  insert into deliveries(customer_name, customer_phone, address, notes, created_by, created_by_name)
    values (trim(p_name), nullif(trim(p_phone),''), trim(p_address), nullif(trim(p_notes),''), auth.uid(), uname)
    returning id into d_id;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'qty')::int;
    if q is null or q <= 0 then raise exception 'invalid quantity'; end if;
    select * into prod from products where id = (it->>'product_id')::uuid for update;
    if not found then raise exception 'product not found'; end if;
    if prod.stock < q then raise exception 'Not enough stock for % (only % left)', prod.name, prod.stock; end if;
    update products set stock = stock - q where id = prod.id;
    insert into delivery_items(delivery_id, product_id, product_name, qty, price)
      values (d_id, prod.id, prod.name, q, prod.price);
    insert into stock_movements(product_id, change, reason, note) values (prod.id, -q, 'delivery', 'Delivery ' || d_id);
  end loop;
  return d_id;
end $$;

create or replace function assign_delivery(p_id uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d deliveries%rowtype; u profiles%rowtype;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select * into d from deliveries where id = p_id for update;
  if not found then raise exception 'delivery not found'; end if;
  if d.status not in ('pending','assigned') then raise exception 'this delivery can no longer be assigned'; end if;
  select * into u from profiles where id = p_user and role = 'delivery' and active;
  if not found then raise exception 'choose an active delivery person'; end if;
  update deliveries set assigned_to = u.id, assigned_name = coalesce(u.full_name, 'Delivery'), status = 'assigned' where id = p_id;
end $$;

create or replace function update_delivery_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare r text := current_role_name(); d deliveries%rowtype;
begin
  select * into d from deliveries where id = p_id for update;
  if not found then raise exception 'delivery not found'; end if;
  if d.status in ('delivered','cancelled') then raise exception 'delivery is already %', d.status; end if;
  if p_status not in ('out_for_delivery','delivered') then raise exception 'invalid status'; end if;
  if d.assigned_to is null then raise exception 'assign a delivery person first'; end if;
  if r = 'delivery' then
    if d.assigned_to is distinct from auth.uid() then raise exception 'not your delivery'; end if;
  elsif r is distinct from 'admin' then raise exception 'not allowed'; end if;
  if p_status = 'delivered' and d.status <> 'out_for_delivery' then raise exception 'start the delivery first'; end if;
  update deliveries set status = p_status, delivered_at = case when p_status = 'delivered' then now() end where id = p_id;
end $$;

create or replace function cancel_delivery(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r text := current_role_name(); d deliveries%rowtype; it delivery_items%rowtype;
begin
  select * into d from deliveries where id = p_id for update;
  if not found then raise exception 'delivery not found'; end if;
  if d.status in ('delivered','cancelled') then raise exception 'delivery is already %', d.status; end if;
  if not (r = 'admin' or (r = 'sales' and d.created_by = auth.uid() and d.status = 'pending')) then
    raise exception 'not allowed'; end if;
  for it in select * from delivery_items where delivery_id = p_id loop
    update products set stock = stock + it.qty where id = it.product_id;
    insert into stock_movements(product_id, change, reason, note) values (it.product_id, it.qty, 'return', 'Cancelled delivery ' || p_id);
  end loop;
  update deliveries set status = 'cancelled' where id = p_id;
end $$;

-- ===== 4. Admin dashboard numbers =====
create or replace function admin_summary() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
  return json_build_object(
    'products', (select count(*) from products),
    'out_of_stock', (select count(*) from products where stock <= 0),
    'low_stock', (select count(*) from products where stock > 0 and stock <= low_stock_level),
    'pending_deliveries', (select count(*) from deliveries where status in ('pending','assigned')),
    'out_for_delivery', (select count(*) from deliveries where status = 'out_for_delivery'),
    'delivered_today', (select count(*) from deliveries where status = 'delivered' and delivered_at >= date_trunc('day', now())),
    'stock_value', (select coalesce(sum(p.stock * c.cost_price), 0) from products p join product_costs c on c.product_id = p.id)
  );
end $$;

-- ===== 5. Photo search + learning: staff only =====
create or replace function match_products(query_embedding vector(512), match_count int default 3)
returns table (id uuid, sku text, name text, price numeric, stock int, similarity float)
language sql stable security definer set search_path = public as $$
  with all_emb as (
    select product_id, embedding from product_images where embedding is not null
    union all select product_id, embedding from learned_embeddings
  ), best as (
    select product_id, max(1 - (embedding <=> query_embedding)) as sim from all_emb group by product_id
  )
  select p.id, p.sku, p.name, p.price, p.stock, b.sim::float
  from best b join products p on p.id = b.product_id
  where current_role_name() in ('admin','sales')
  order by b.sim desc limit match_count;
$$;

create or replace function learn_scan(p_id uuid, p_embedding vector(512))
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_role_name(), '') not in ('admin','sales') then raise exception 'not allowed'; end if;
  if exists (
    select 1 from (
      select embedding from product_images where product_id = p_id and embedding is not null
      union all select embedding from learned_embeddings where product_id = p_id
    ) e where 1 - (e.embedding <=> p_embedding) > 0.98
  ) then return; end if;
  insert into learned_embeddings(product_id, embedding) values (p_id, p_embedding);
  delete from learned_embeddings where id in (
    select id from learned_embeddings where product_id = p_id order by created_at desc offset 30);
end $$;

-- ===== 6. Lock the functions: logged-in users only (anonymous visitors get nothing) =====
revoke execute on function current_role_name(), is_admin(), set_stock(uuid,int,text),
  adjust_stock(uuid,int,text,text), create_delivery(text,text,text,text,jsonb),
  assign_delivery(uuid,uuid), update_delivery_status(uuid,text), cancel_delivery(uuid),
  admin_summary(), match_products(vector,int), learn_scan(uuid,vector) from public, anon;
grant execute on function current_role_name(), is_admin(), set_stock(uuid,int,text),
  adjust_stock(uuid,int,text,text), create_delivery(text,text,text,text,jsonb),
  assign_delivery(uuid,uuid), update_delivery_status(uuid,text), cancel_delivery(uuid),
  admin_summary(), match_products(vector,int), learn_scan(uuid,vector) to authenticated;
