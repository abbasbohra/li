-- Run once in Supabase -> SQL Editor. Safe to run again.
-- Makes a unique, valid EAN-13 barcode for a product that has none.
-- Codes start with "2" (the range reserved for in-store / internal use), so they never clash with manufacturer barcodes.
create sequence if not exists barcode_seq start 1;

create or replace function ean13_check(body text) returns text
language sql immutable as $$
  select ((10 - (sum((substr(body, i, 1))::int * case when i % 2 = 1 then 1 else 3 end) % 10)) % 10)::text
  from generate_series(1, 12) i
$$;

create or replace function generate_barcode(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare cur text; body text; code text;
begin
  if not is_admin() then raise exception 'admin only'; end if;
  select barcode into cur from products where id = p_id for update;
  if not found then raise exception 'product not found'; end if;
  if cur is not null and cur <> '' then return cur; end if;   -- already has one: keep it
  loop
    body := '2' || lpad(nextval('barcode_seq')::text, 11, '0');
    code := body || ean13_check(body);
    exit when not exists (select 1 from products where barcode = code);
  end loop;
  update products set barcode = code where id = p_id;
  return code;
end $$;

revoke execute on function generate_barcode(uuid) from public, anon;
grant execute on function generate_barcode(uuid) to authenticated;
