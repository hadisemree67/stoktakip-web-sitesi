-- ============================================================
-- YÖNETİCİ KULLANICI İSMİ GÜNCELLEME KOMUTU
-- ============================================================
-- Bu kodu Supabase SQL Editor'de çalıştırarak, kullanıcının ismini manuel atayabilirsiniz.
-- Eğer bunu yaparsanız, kullanıcı giriş yaptığında "İsim Sorma" ekranını GÖRMEZ.
-- Direkt sisteme girer.

-- 1. Aşağıdaki 'ornek@email.com' kısmına kullanıcının emailini yazın.
-- 2. 'Ahmet Yılmaz' kısmına vermek istediğiniz ismi yazın.
-- 3. Çalıştırın (Run).

UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object('full_name', 'Ahmet Yılmaz') -- İSMİ BURAYA YAZIN
WHERE email = 'ornek@email.com'; -- EMAİLİ BURAYA YAZIN
