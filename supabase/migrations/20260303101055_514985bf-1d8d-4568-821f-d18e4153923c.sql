-- Add payment/status columns to orders (idempotent with IF NOT EXISTS approach)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='status') THEN
    ALTER TABLE public.orders ADD COLUMN status text NOT NULL DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='payment_status') THEN
    ALTER TABLE public.orders ADD COLUMN payment_status text NOT NULL DEFAULT 'stub';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='amount_total') THEN
    ALTER TABLE public.orders ADD COLUMN amount_total integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='currency') THEN
    ALTER TABLE public.orders ADD COLUMN currency text NOT NULL DEFAULT 'MAD';
  END IF;
END $$;

-- Add validation trigger instead of CHECK constraint (for safety on restore)
CREATE OR REPLACE FUNCTION public.validate_order_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'paid', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Invalid order status: %', NEW.status;
  END IF;
  IF NEW.payment_status NOT IN ('stub', 'stripe', 'cash') THEN
    RAISE EXCEPTION 'Invalid payment_status: %', NEW.payment_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_order_status_trigger ON public.orders;
CREATE TRIGGER validate_order_status_trigger
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status();

-- Backfill existing orders
UPDATE public.orders SET status = 'pending' WHERE status IS NULL OR status = '';
UPDATE public.orders SET payment_status = 'stub' WHERE payment_status IS NULL OR payment_status = '';
UPDATE public.orders SET currency = 'MAD' WHERE currency IS NULL OR currency = '';