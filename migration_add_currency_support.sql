-- Add currency column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'TL';

-- Add currency details to sale_items table
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS original_currency text DEFAULT 'TL',
ADD COLUMN IF NOT EXISTS original_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;

-- Update the handle_new_sale function to accept and store currency details
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
  -- Sepet toplamını hesapla (TL Cinsinden toplam)
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
      (item->>'unit_price')::numeric, -- Bu TL fiyatıdır (dönüştürülmüş)
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
