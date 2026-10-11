-- ==============================================================================
-- STOK TAKİP SİSTEMİ - TAM VERİTABANI KURULUM ŞEMASI (ALL-IN-ONE)
-- ==============================================================================
-- Bu kod yeni oluşturulan Supabase projesinde "SQL Editor" alanına yapıştırılıp
-- "Run" butonuna basılarak tek seferde çalıştırılmalıdır.
-- Çoklu kullanıcı desteği (RLS), döviz desteği, stok kontrolü ve cascade silme dahildir.

-- 1. Önceki tabloları temizle (Sıfırdan temiz kurulum)
DROP TABLE IF EXISTS public.sale_items CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.stock_levels CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;
DROP TABLE IF EXISTS public.sales_locations CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- 2. TABLOLARI OLUŞTUR

-- Müşteriler
CREATE TABLE public.customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL,
  type text CHECK (type IN ('bireysel', 'şirket')) DEFAULT 'bireysel',
  email text,
  phone text,
  address text,
  created_at timestamptz DEFAULT now()
);

-- Ürünler
CREATE TABLE public.products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL,
  sku_or_barcode text,
  category text,
  brand text,
  purchase_price numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  wholesale_price numeric DEFAULT 0,
  currency text DEFAULT 'TL',
  created_at timestamptz DEFAULT now()
);

-- Depolar
CREATE TABLE public.warehouses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL,
  location text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Satış Lokasyonları / Kanalları
CREATE TABLE public.sales_locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name text NOT NULL,
  type text CHECK (type IN ('mağaza', 'online', 'bayi')),
  address text,
  created_at timestamptz DEFAULT now()
);

-- Stok Seviyeleri
CREATE TABLE public.stock_levels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity integer DEFAULT 0,
  UNIQUE(product_id, warehouse_id)
);

-- Stok Hareketleri
CREATE TABLE public.stock_movements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  from_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  to_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  type text CHECK (type IN ('in', 'out', 'transfer')),
  quantity integer NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

-- Satışlar
CREATE TABLE public.sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  sales_location_id uuid REFERENCES public.sales_locations(id) ON DELETE SET NULL,
  total_amount numeric DEFAULT 0,
  payment_method text DEFAULT 'nakit',
  payment_status text DEFAULT 'paid',
  paid_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Satış Kalemleri
CREATE TABLE public.sale_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  line_total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  original_currency text DEFAULT 'TL',
  original_price numeric DEFAULT 0,
  exchange_rate numeric DEFAULT 1
);

-- 3. GÜVENLİK (ROW LEVEL SECURITY - RLS) AYARLARI
-- Her kullanıcı yalnızca kendi user_id'sine ait verileri görebilir ve yönetebilir.

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own customers" ON public.customers FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own products" ON public.products FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own warehouses" ON public.warehouses FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.sales_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own sales locations" ON public.sales_locations FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own stock levels" ON public.stock_levels FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own stock movements" ON public.stock_movements FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own sales" ON public.sales FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own sale items" ON public.sale_items FOR ALL USING (auth.uid() = user_id);

-- 4. FONKSİYONLAR (PL/pgSQL)

-- Stok Hareketi Fonksiyonu
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

-- Satış Gerçekleştirme Fonksiyonu (Stok Kontrollü + Döviz Desteği + Ödeme Yöntemi)
CREATE OR REPLACE FUNCTION handle_new_sale(
  p_customer_id uuid,
  p_sales_location_id uuid,
  p_warehouse_id uuid,
  p_items jsonb,
  p_payment_method text DEFAULT 'nakit',
  p_payment_status text DEFAULT 'paid'
) RETURNS json AS $$
DECLARE
  v_sale_id uuid;
  v_total numeric := 0;
  item jsonb;
  v_current_stock int;
  v_paid_at timestamptz := NULL;
  v_p_method text;
  v_p_status text;
BEGIN
  v_p_method := COALESCE(p_payment_method, 'nakit');
  v_p_status := COALESCE(p_payment_status, 'paid');

  IF v_p_status = 'paid' THEN
    v_paid_at := now();
  END IF;

  -- 1. Stok Kontrolü (Satış başlamadan önce)
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT quantity INTO v_current_stock 
    FROM stock_levels 
    WHERE product_id = (item->>'product_id')::uuid 
      AND warehouse_id = p_warehouse_id;

    IF v_current_stock IS NULL OR v_current_stock < (item->>'quantity')::int THEN
       RAISE EXCEPTION 'Yetersiz Stok! Ürün ID: %, Mevcut: %, İstenen: %', 
          (item->>'product_id'), COALESCE(v_current_stock, 0), (item->>'quantity');
    END IF;

    v_total := v_total + ((item->>'quantity')::int * (item->>'unit_price')::numeric);
  END LOOP;

  -- 2. Satış Ana Kaydı
  INSERT INTO sales (customer_id, sales_location_id, total_amount, payment_method, payment_status, paid_at)
  VALUES (p_customer_id, p_sales_location_id, v_total, v_p_method, v_p_status, v_paid_at)
  RETURNING id INTO v_sale_id;

  -- 3. Detay Kayıtları ve Stok Düşümü
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO sale_items (
      sale_id, 
      product_id, 
      quantity, 
      unit_price, 
      original_currency, 
      original_price, 
      exchange_rate
    )
    VALUES (
      v_sale_id, 
      (item->>'product_id')::uuid, 
      (item->>'quantity')::int, 
      (item->>'unit_price')::numeric,
      COALESCE((item->>'original_currency'), 'TL'),
      COALESCE((item->>'original_price')::numeric, (item->>'unit_price')::numeric),
      COALESCE((item->>'exchange_rate')::numeric, 1)
    );

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

-- 5. Schema Önbelleğini Yenile
NOTIFY pgrst, 'reload schema';
