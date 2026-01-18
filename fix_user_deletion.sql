-- ============================================================
-- KULLANICI SİLME HATASI DÜZELTME (CASCADE DELETE)
-- ============================================================
-- Bu kodu Supabase SQL Editor'de çalıştırın.
-- Bu kod, bir kullanıcıyı sildiğinizde ona ait verilerin de otomatik silinmesini sağlar.
-- Böylece "Database error deleting user" hatası almazsınız.

-- 1. Müşteriler
ALTER TABLE public.customers
DROP CONSTRAINT IF EXISTS customers_user_id_fkey;

ALTER TABLE public.customers
ADD CONSTRAINT customers_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Ürünler
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_user_id_fkey;

ALTER TABLE public.products
ADD CONSTRAINT products_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Depolar
ALTER TABLE public.warehouses
DROP CONSTRAINT IF EXISTS warehouses_user_id_fkey;

ALTER TABLE public.warehouses
ADD CONSTRAINT warehouses_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Satış Lokasyonları
ALTER TABLE public.sales_locations
DROP CONSTRAINT IF EXISTS sales_locations_user_id_fkey;

ALTER TABLE public.sales_locations
ADD CONSTRAINT sales_locations_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. Stok Seviyeleri
ALTER TABLE public.stock_levels
DROP CONSTRAINT IF EXISTS stock_levels_user_id_fkey;

ALTER TABLE public.stock_levels
ADD CONSTRAINT stock_levels_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6. Stok Hareketleri
ALTER TABLE public.stock_movements
DROP CONSTRAINT IF EXISTS stock_movements_user_id_fkey;

ALTER TABLE public.stock_movements
ADD CONSTRAINT stock_movements_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. Satışlar
ALTER TABLE public.sales
DROP CONSTRAINT IF EXISTS sales_user_id_fkey;

ALTER TABLE public.sales
ADD CONSTRAINT sales_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 8. Satış Kalemleri
ALTER TABLE public.sale_items
DROP CONSTRAINT IF EXISTS sale_items_user_id_fkey;

ALTER TABLE public.sale_items
ADD CONSTRAINT sale_items_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
