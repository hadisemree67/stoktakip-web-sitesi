-- ==============================================================================
-- VERESİYE DEFTERİ & BORÇ TAHSİLATLARI GÜNCELLEMESİ
-- ==============================================================================
-- Bu SQL kodunu Supabase Dashboard > SQL Editor'e yapıştırıp "Run" ile çalıştırın.

-- 1. Satış tablosuna ödenen ve kalan tutar kolonlarını ekle
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_amount numeric DEFAULT 0;

-- Mevcut geçmiş satışları güncelle
UPDATE public.sales 
SET paid_amount = CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END,
    remaining_amount = CASE WHEN payment_status = 'paid' THEN 0 ELSE total_amount END
WHERE paid_amount IS NULL OR remaining_amount IS NULL;

-- 2. Müşteri Veresiye Tahsilatları / Ödemeleri Tablosu
CREATE TABLE IF NOT EXISTS public.customer_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text DEFAULT 'nakit', -- 'nakit', 'kredi_karti', 'havale'
  note text,
  created_at timestamptz DEFAULT now()
);

-- RLS Güvenlik
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own customer payments" ON public.customer_payments;
CREATE POLICY "Users can manage their own customer payments" 
  ON public.customer_payments FOR ALL USING (auth.uid() = user_id);

-- 3. Müşteri Borç Ödemesi Alma & Veresiye Satışlarından Düşme Fonksiyonu
CREATE OR REPLACE FUNCTION record_customer_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'nakit',
  p_note text DEFAULT NULL,
  p_sale_id uuid DEFAULT NULL
) RETURNS json AS $$
DECLARE
  v_payment_id uuid;
  v_remaining_payment numeric := p_amount;
  r_sale RECORD;
  v_sale_debt numeric;
  v_cur_paid numeric;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Ödeme tutarı 0 dan büyük olmalıdır!';
  END IF;

  -- 1. Tahsilat Kaydını Oluştur
  INSERT INTO customer_payments (customer_id, sale_id, amount, payment_method, note)
  VALUES (p_customer_id, p_sale_id, p_amount, COALESCE(p_payment_method, 'nakit'), p_note)
  RETURNING id INTO v_payment_id;

  -- 2. Eğer belirli bir fiş için ödeme yapıldıysa doğrudan o fişten düş
  IF p_sale_id IS NOT NULL THEN
    SELECT total_amount, COALESCE(paid_amount, 0) as paid_amount 
    INTO r_sale
    FROM sales 
    WHERE id = p_sale_id;

    IF FOUND THEN
      v_cur_paid := r_sale.paid_amount + p_amount;
      IF v_cur_paid >= r_sale.total_amount THEN
        UPDATE sales 
        SET paid_amount = total_amount,
            remaining_amount = 0,
            payment_status = 'paid',
            paid_at = now()
        WHERE id = p_sale_id;
      ELSE
        UPDATE sales 
        SET paid_amount = v_cur_paid,
            remaining_amount = total_amount - v_cur_paid,
            payment_status = 'partial'
        WHERE id = p_sale_id;
      END IF;
    END IF;

    RETURN json_build_object(
      'payment_id', v_payment_id,
      'status', 'success',
      'amount', p_amount
    );
  END IF;

  -- 3. Genel Müşteri Borcundan Düşme (Açık veresiye satışlarını en eskiden yeniye doğru kapat)
  FOR r_sale IN 
    SELECT id, total_amount, COALESCE(paid_amount, 0) as paid_amount, 
           GREATEST(0, total_amount - COALESCE(paid_amount, 0)) as debt
    FROM sales 
    WHERE customer_id = p_customer_id 
      AND payment_method = 'veresiye' 
      AND payment_status != 'paid'
    ORDER BY created_at ASC
  LOOP
    IF v_remaining_payment <= 0 THEN
      EXIT;
    END IF;

    IF r_sale.debt <= 0 THEN
      CONTINUE;
    END IF;

    IF v_remaining_payment >= r_sale.debt THEN
      -- Bu satışı tamamen kapat
      UPDATE sales 
      SET paid_amount = total_amount,
          remaining_amount = 0,
          payment_status = 'paid',
          paid_at = now()
      WHERE id = r_sale.id;

      v_remaining_payment := v_remaining_payment - r_sale.debt;
    ELSE
      -- Kısmi ödeme yap
      UPDATE sales 
      SET paid_amount = r_sale.paid_amount + v_remaining_payment,
          remaining_amount = total_amount - (r_sale.paid_amount + v_remaining_payment),
          payment_status = 'partial'
      WHERE id = r_sale.id;

      v_remaining_payment := 0;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'payment_id', v_payment_id,
    'status', 'success',
    'amount', p_amount,
    'unapplied_excess', v_remaining_payment
  );
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
