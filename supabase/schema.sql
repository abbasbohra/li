-- Run this in Supabase SQL Editor
create extension if not exists vector;

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'sales' check (role in ('admin','sales'))
);
create function is_admin() returns boolean language sql security definer as
$$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create function handle_new_user() returns trigger language plpgsql security definer as
$$ begin insert into profiles(id) values (new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  category text,
  price numeric(10,2) not null default 0,
  stock int not null default 0,
  low_stock_level int not null default 5,
  wattage text, size text, color text,
  location text,
  description text,
  created_at timestamptz default now()
);

-- cost price kept separate: only admin can read
create table product_costs (
  product_id uuid primary key references products on delete cascade,
  cost_price numeric(10,2) not null default 0
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products on delete cascade,
  image_url text not null,
  embedding vector(512)
);
create index on product_images using hnsw (embedding vector_cosine_ops);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products on delete cascade,
  change int not null,
  reason text,
  user_id uuid default auth.uid(),
  created_at timestamptz default now()
);

-- Photo search: best matching products
create function match_products(query_embedding vector(512), match_count int default 3)
returns table (id uuid, sku text, name text, price numeric, stock int, similarity float)
language sql stable as $$
  with best as (
    select pi.product_id, max(1 - (pi.embedding <=> query_embedding)) as sim
    from product_images pi group by pi.product_id
  )
  select p.id, p.sku, p.name, p.price, p.stock, b.sim::float
  from best b join products p on p.id = b.product_id
  order by b.sim desc limit match_count;
$$;

-- Stock change (sale = negative, purchase = positive)
create function adjust_stock(p_id uuid, qty int, p_reason text)
returns int language plpgsql security definer as $$
declare new_stock int;
begin
  if p_reason <> 'sale' and not is_admin() then raise exception 'admin only'; end if;
  if p_reason = 'sale' and qty > 0 then raise exception 'invalid sale'; end if;
  update products set stock = stock + qty where id = p_id returning stock into new_stock;
  if new_stock < 0 then raise exception 'not enough stock'; end if;
  insert into stock_movements(product_id, change, reason) values (p_id, qty, p_reason);
  return new_stock;
end $$;

-- Security (RLS)
alter table profiles enable row level security;
alter table products enable row level security;
alter table product_costs enable row level security;
alter table product_images enable row level security;
alter table stock_movements enable row level security;

create policy "own profile" on profiles for select using (id = auth.uid());
create policy "read products" on products for select to authenticated using (true);
create policy "admin write products" on products for all using (is_admin()) with check (is_admin());
create policy "read images" on product_images for select to authenticated using (true);
create policy "admin write images" on product_images for all using (is_admin()) with check (is_admin());
create policy "admin costs" on product_costs for all using (is_admin()) with check (is_admin());
create policy "admin movements" on stock_movements for select using (is_admin());

-- Storage bucket for photos
insert into storage.buckets (id, name, public) values ('product-images','product-images', true)
  on conflict do nothing;
create policy "admin upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and is_admin());
