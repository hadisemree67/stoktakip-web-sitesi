-- BU KODU SUPABASE SQL EDITOR'DE ÇALIŞTIRIN
-- Ürünler tablosuna toptan satış fiyatı ekler

ALTER TABLE public.products 
ADD COLUMN wholesale_price numeric default 0;
