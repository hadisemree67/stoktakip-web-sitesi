-- BU DOSYADAKİ TÜM KODLARI KOPYALAYIP SUPABASE SQL EDITOR'E YAPIŞTIRIN VE 'RUN' BUTONUNA BASIN.

-- ==========================================
-- 1. TABLOLARIN OLUŞTURULMASI
-- ==========================================

-- Müşteriler Tablosu
create table public.customers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text check (type in ('bireysel', 'şirket')) default 'bireysel',
  email text,
  phone text,
  address text,
  created_at timestamptz default now()
);

-- Ürünler Tablosu
create table public.products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  sku_or_barcode text,
  category text,
  brand text,
  unit_price numeric default 0,
  created_at timestamptz default now()
);

-- Depolar Tablosu
create table public.warehouses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  location text,
  description text,
  created_at timestamptz default now()
);

-- Satış Lokasyonları Tablosu
create table public.sales_locations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text check (type in ('mağaza', 'online', 'bayi')),
  address text,
  created_at timestamptz default now()
);

-- Stok Seviyeleri (Hangi depoda, hangi üründen ne kadar var?)
create table public.stock_levels (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade,
  warehouse_id uuid references public.warehouses(id) on delete cascade,
  quantity integer default 0,
  unique(product_id, warehouse_id)
);

-- Stok Hareketleri (Giriş, Çıkış, Transfer logları)
create table public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade,
  from_warehouse_id uuid references public.warehouses(id) on delete set null,
  to_warehouse_id uuid references public.warehouses(id) on delete set null,
  type text check (type in ('in', 'out', 'transfer')),
  quantity integer not null,
  note text,
  created_at timestamptz default now()
);

-- Satışlar Ana Tablo
create table public.sales (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete set null,
  sales_location_id uuid references public.sales_locations(id) on delete set null,
  total_amount numeric default 0,
  created_at timestamptz default now()
);

-- Satış Detayları (Sepetteki ürünler)
create table public.sale_items (
  id uuid default gen_random_uuid() primary key,
  sale_id uuid references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null,
  unit_price numeric not null,
  line_total numeric generated always as (quantity * unit_price) stored
);

-- ==========================================
-- 2. GÜVENLİK (RLS) AYARLARI
-- ==========================================
-- Giriş yapmış kullanıcıların verileri okuyup yazabilmesi için gerekli izinler.

alter table public.customers enable row level security;
create policy "Enable all for authenticated users" on public.customers for all using (auth.role() = 'authenticated');

alter table public.products enable row level security;
create policy "Enable all for authenticated users" on public.products for all using (auth.role() = 'authenticated');

alter table public.warehouses enable row level security;
create policy "Enable all for authenticated users" on public.warehouses for all using (auth.role() = 'authenticated');

alter table public.sales_locations enable row level security;
create policy "Enable all for authenticated users" on public.sales_locations for all using (auth.role() = 'authenticated');

alter table public.stock_levels enable row level security;
create policy "Enable all for authenticated users" on public.stock_levels for all using (auth.role() = 'authenticated');

alter table public.stock_movements enable row level security;
create policy "Enable all for authenticated users" on public.stock_movements for all using (auth.role() = 'authenticated');

alter table public.sales enable row level security;
create policy "Enable all for authenticated users" on public.sales for all using (auth.role() = 'authenticated');

alter table public.sale_items enable row level security;
create policy "Enable all for authenticated users" on public.sale_items for all using (auth.role() = 'authenticated');


-- ==========================================
-- 3. FONKSİYONLAR (Otomatik İşlemler)
-- ==========================================

-- Stok hareketlerini işleyen fonksiyon
-- Bu fonksiyon çağrıldığında hem hareket kaydı oluşturur hem de stock_levels tablosundaki adetleri günceller.
CREATE OR REPLACE FUNCTION handle_stock_movement(
  p_product_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_type text,
  p_quantity integer,
  p_note text
) RETURNS void AS $$
BEGIN
  -- Hareketi kaydet
  INSERT INTO stock_movements (product_id, from_warehouse_id, to_warehouse_id, type, quantity, note)
  VALUES (p_product_id, p_from_warehouse_id, p_to_warehouse_id, p_type, p_quantity, p_note);

  -- Stok seviyelerini güncelle
  IF p_type = 'in' THEN
    -- Giriş işlemi: Hedef depodaki sayıyı artır
    INSERT INTO stock_levels (product_id, warehouse_id, quantity)
    VALUES (p_product_id, p_to_warehouse_id, p_quantity)
    ON CONFLICT (product_id, warehouse_id) 
    DO UPDATE SET quantity = stock_levels.quantity + EXCLUDED.quantity;
    
  ELSIF p_type = 'out' THEN
     -- Çıkış işlemi: Kaynak depodaki sayıyı azalt
     UPDATE stock_levels 
     SET quantity = quantity - p_quantity
     WHERE product_id = p_product_id AND warehouse_id = p_from_warehouse_id;
     
  ELSIF p_type = 'transfer' THEN
     -- Transfer işlemi: Kaynaktan düş, hedefe ekle
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


-- Yeni Satış İşleyen Fonksiyon
-- Bu fonksiyon tek bir işlemde (transaction) satışı kaydeder, kalemleri ekler ve stoku düşer.
CREATE OR REPLACE FUNCTION handle_new_sale(
  p_customer_id uuid,
  p_sales_location_id uuid,
  p_warehouse_id uuid,
  p_items jsonb -- [{product_id, quantity, unit_price}] formatında JSON verisi alır
) RETURNS json AS $$
DECLARE
  v_sale_id uuid;
  v_total numeric := 0;
  item jsonb;
BEGIN
  -- 1. Sepet toplamını hesapla
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total := v_total + ((item->>'quantity')::int * (item->>'unit_price')::numeric);
  END LOOP;

  -- 2. Satış ana kaydını oluştur
  INSERT INTO sales (customer_id, sales_location_id, total_amount)
  VALUES (p_customer_id, p_sales_location_id, v_total)
  RETURNING id INTO v_sale_id;

  -- 3. Ürünleri ekle ve stoktan düş
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Sale Item ekle
    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price)
    VALUES (v_sale_id, (item->>'product_id')::uuid, (item->>'quantity')::int, (item->>'unit_price')::numeric);

    -- Stoktan düşmek için yukarıdaki handle_stock_movement fonksiyonunu çağır (Type: OUT)
    PERFORM handle_stock_movement(
      (item->>'product_id')::uuid,
      p_warehouse_id, -- Kaynak depo
      null,           -- Hedef yok (çünkü satış yapıyoruz)
      'out', 
      (item->>'quantity')::int,
      'Satış #' || v_sale_id::text
    );
  END LOOP;

  RETURN json_build_object('id', v_sale_id, 'status', 'success');
END;
$$ LANGUAGE plpgsql;
