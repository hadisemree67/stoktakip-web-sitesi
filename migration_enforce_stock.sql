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
  v_current_stock int;
BEGIN
  -- 1. Stok Kontrolü (Satış başlamadan önce)
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- İlgili depodaki stok miktarını bul
    SELECT quantity INTO v_current_stock 
    FROM stock_levels 
    WHERE product_id = (item->>'product_id')::uuid 
      AND warehouse_id = p_warehouse_id;

    -- Stok kaydı yoksa veya yetersizse hata fırlat
    IF v_current_stock IS NULL OR v_current_stock < (item->>'quantity')::int THEN
       RAISE EXCEPTION 'Yetersiz Stok! Ürün ID: %, Mevcut: %, İstenen: %', 
          (item->>'product_id'), COALESCE(v_current_stock, 0), (item->>'quantity');
    END IF;

    -- Toplam tutarı hesapla
    v_total := v_total + ((item->>'quantity')::int * (item->>'unit_price')::numeric);
  END LOOP;

  -- 2. Satış Ana Kaydı
  INSERT INTO sales (customer_id, sales_location_id, total_amount)
  VALUES (p_customer_id, p_sales_location_id, v_total)
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

    -- Stok düşümü
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
