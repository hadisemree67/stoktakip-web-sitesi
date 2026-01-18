-- ==============================================================================
-- SUPABASE SCHEMA V2 - MULTI-USER IGOLATION (ÇOKLU KULLANICI DESTEĞİ)
-- ==============================================================================
-- BU KODU ÇALIŞTIRMAK MEVCUT TÜM VERİLERİ SİLECEKTİR! (Tabloları sıfırlar)
-- Her kullanıcının sadece kendi verisini görmesini sağlayan yapıdır.

-- 1. Önceki tabloları temizle (Sıfırdan kurulum)
DROP TABLE IF EXISTS public.sale_items CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.stock_levels CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;
DROP TABLE IF EXISTS public.sales_locations CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- 2. TABLOLARI OLUŞTUR (user_id eklenmiş haliyle)
create table public.customers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(), -- KULLANICIYA ZİMMETLEME
  name text not null,
  type text check (type in ('bireysel', 'şirket')) default 'bireysel',
  email text,
  phone text,
  address text,
  created_at timestamptz default now()
);

create table public.products (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(), -- KULLANICIYA ZİMMETLEME
  name text not null,
  sku_or_barcode text,
  category text,
  brand text,
  purchase_price numeric default 0, -- Alış Fiyatı (V2)
  unit_price numeric default 0,     -- Perakende Satış Fiyatı
  wholesale_price numeric default 0,-- Toptan Satış Fiyatı (V2)
  created_at timestamptz default now()
);

create table public.warehouses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(), -- KULLANICIYA ZİMMETLEME
  name text not null,
  location text,
  description text,
  created_at timestamptz default now()
);

create table public.sales_locations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(), -- KULLANICIYA ZİMMETLEME
  name text not null,
  type text check (type in ('mağaza', 'online', 'bayi')),
  address text,
  created_at timestamptz default now()
);

create table public.stock_levels (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(), -- KULLANICIYA ZİMMETLEME
  product_id uuid references public.products(id) on delete cascade,
  warehouse_id uuid references public.warehouses(id) on delete cascade,
  quantity integer default 0,
  unique(product_id, warehouse_id) -- Aynı ambarda aynı ürün tek kayıt olur
);

create table public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(), -- KULLANICIYA ZİMMETLEME
  product_id uuid references public.products(id) on delete cascade,
  from_warehouse_id uuid references public.warehouses(id) on delete set null,
  to_warehouse_id uuid references public.warehouses(id) on delete set null,
  type text check (type in ('in', 'out', 'transfer')),
  quantity integer not null,
  note text,
  created_at timestamptz default now()
);

create table public.sales (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(), -- KULLANICIYA ZİMMETLEME
  customer_id uuid references public.customers(id) on delete set null,
  sales_location_id uuid references public.sales_locations(id) on delete set null,
  total_amount numeric default 0,
  created_at timestamptz default now()
);

create table public.sale_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users default auth.uid(), -- KULLANICIYA ZİMMETLEME
  sale_id uuid references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null,
  unit_price numeric not null,
  line_total numeric generated always as (quantity * unit_price) stored
);

-- 3. GÜVENLİK (RLS) AYARLARI
-- Her kullanıcı SADECE kendi eklediği (user_id'si kendisine eşit olan) veriyi görebilir/düzenleyebilir.

alter table public.customers enable row level security;
create policy "Users can only see their own data" on public.customers for all using (auth.uid() = user_id);

alter table public.products enable row level security;
create policy "Users can only see their own data" on public.products for all using (auth.uid() = user_id);

alter table public.warehouses enable row level security;
create policy "Users can only see their own data" on public.warehouses for all using (auth.uid() = user_id);

alter table public.sales_locations enable row level security;
create policy "Users can only see their own data" on public.sales_locations for all using (auth.uid() = user_id);

alter table public.stock_levels enable row level security;
create policy "Users can only see their own data" on public.stock_levels for all using (auth.uid() = user_id);

alter table public.stock_movements enable row level security;
create policy "Users can only see their own data" on public.stock_movements for all using (auth.uid() = user_id);

alter table public.sales enable row level security;
create policy "Users can only see their own data" on public.sales for all using (auth.uid() = user_id);

alter table public.sale_items enable row level security;
create policy "Users can only see their own data" on public.sale_items for all using (auth.uid() = user_id);

-- 4. FONKSİYONLAR (Otomatik İşlemler)
-- Fonksiyonlar 'SECURITY INVOKER' (varsayılan) çalıştığı için, çağıran kullanıcının yetkileriyle işlem yapar.
-- Dolayısıyla RLS kuralları fonksiyonlar içinde de geçerli olur ve veri karışmaz.

CREATE OR REPLACE FUNCTION handle_stock_movement(
  p_product_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_type text,
  p_quantity integer,
  p_note text
) RETURNS void AS $$
BEGIN
  -- Hareketi kaydet (user_id otomatik auth.uid() olur)
  INSERT INTO stock_movements (product_id, from_warehouse_id, to_warehouse_id, type, quantity, note)
  VALUES (p_product_id, p_from_warehouse_id, p_to_warehouse_id, p_type, p_quantity, p_note);

  -- Stok seviyelerini güncelle
  -- RLS sayesinde kullanıcı sadece kendi stok kayıtlarını günceller.
  IF p_type = 'in' THEN
    INSERT INTO stock_levels (product_id, warehouse_id, quantity)
    VALUES (p_product_id, p_to_warehouse_id, p_quantity)
    ON CONFLICT (product_id, warehouse_id) 
    DO UPDATE SET quantity = stock_levels.quantity + EXCLUDED.quantity;
    
  ELSIF p_type = 'out' THEN
     UPDATE stock_levels 
     SET quantity = quantity - p_quantity
     WHERE product_id = p_product_id AND warehouse_id = p_from_warehouse_id;
     
  ELSIF p_type = 'transfer' THEN
     UPDATE stock_levels 
     SET quantity = quantity - p_quantity
     WHERE product_id = p_product_id AND warehouse_id = p_from_warehouse_id;
     
     INSERT INTO stock_levels (product_id, warehouse_id, quantity)
     VALUES (p_product_id, p_to_warehouse_id, p_quantity)
     ON CONFLICT (product_id, warehouse_id) 
     DO UPDATE SET quantity = stock_levels.quantity + EXCLUDED.quantity;
  END IF;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION handle_new_sale(
  p_customer_id uuid,
  p_sales_location_id uuid,
  p_warehouse_id uuid,
  p_items jsonb 
) RETURNS json AS $$
DECLARE
  v_sale_id uuid;
  v_total numeric := 0;
  item jsonb;
BEGIN
  -- Sepet toplamını hesapla
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total := v_total + ((item->>'quantity')::int * (item->>'unit_price')::numeric);
  END LOOP;

  -- Satış ana kaydını oluştur
  INSERT INTO sales (customer_id, sales_location_id, total_amount)
  VALUES (p_customer_id, p_sales_location_id, v_total)
  RETURNING id INTO v_sale_id;

  -- Ürünleri ekle ve stoktan düş
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price)
    VALUES (v_sale_id, (item->>'product_id')::uuid, (item->>'quantity')::int, (item->>'unit_price')::numeric);

    PERFORM handle_stock_movement(
      (item->>'product_id')::uuid,
      p_warehouse_id,
      null,
      'out', 
      (item->>'quantity')::int,
      'Satış #' || v_sale_id::text
    );
  END LOOP;

  RETURN json_build_object('id', v_sale_id, 'status', 'success');
END;
$$ LANGUAGE plpgsql;
