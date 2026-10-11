-- ==============================================================================
-- ÖDEME YÖNTEMLERİ & VERESİYE (ALACAK) TAKİBİ GÜNCELLEMESİ
-- ==============================================================================
-- Bu SQL kodunu Supabase SQL Editor'e yapıştırıp "Run" butonuna basarak çalıştırın.

-- 1. Satış tablosuna ödeme yöntemi ve durum kolonlarını ekle
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'nakit',
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'paid',
ADD COLUMN IF NOT EXISTS paid_at timestamptz DEFAULT now();

-- Mevcut geçmiş satışları 'nakit' ve 'paid' olarak güncelle
UPDATE public.sales 
SET payment_method = 'nakit', payment_status = 'paid', paid_at = created_at
WHERE payment_method IS NULL;

-- 2. handle_new_sale fonksiyonunu güncelle
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

-- 3. Schema önbelleğini yenile
NOTIFY pgrst, 'reload schema';
