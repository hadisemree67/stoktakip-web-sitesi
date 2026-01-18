-- BU KODU SUPABASE SQL EDITOR'DE ÇALIŞTIRIN
-- Ürünler tablosuna alış fiyatı ekler

ALTER TABLE public.products 
ADD COLUMN purchase_price numeric default 0;
