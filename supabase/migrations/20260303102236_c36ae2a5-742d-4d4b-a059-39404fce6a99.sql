
-- ============================================================
-- Cleanup function for expired/stale data
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_instances int;
  v_stale_orders int;
  v_synced_instances int;
BEGIN
  -- 1. Sync: mark instances as expired if expires_at has passed
  UPDATE quest_instances
  SET status = 'expired'
  WHERE expires_at < now()
    AND status NOT IN ('expired', 'completed');
  GET DIAGNOSTICS v_synced_instances = ROW_COUNT;

  -- 2. Delete expired instances older than 7 days
  DELETE FROM quest_instances
  WHERE status = 'expired'
    AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_expired_instances = ROW_COUNT;

  -- 3. Delete pending orders older than 7 days (no payment)
  DELETE FROM orders
  WHERE status = 'pending'
    AND payment_status = 'stub'
    AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_stale_orders = ROW_COUNT;

  RETURN jsonb_build_object(
    'synced_instances', v_synced_instances,
    'deleted_instances', v_expired_instances,
    'deleted_orders', v_stale_orders
  );
END;
$$;
