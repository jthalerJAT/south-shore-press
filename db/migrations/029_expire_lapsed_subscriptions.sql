-- 029_expire_lapsed_subscriptions.sql
-- Auto-expire paid subscribers whose subscription end date has passed: flip
-- status active -> expired so they drop out of the "active accounts only"
-- mailing export. Only paid tiers are affected — mailers/free keep their status
-- regardless of any imported expiration date (this week's mailer list is current
-- no matter what SimpleCirc's old expiration said).
--
-- Called on load of the Account Database + Subscriber View (and safe to run from
-- a daily cron). Returns how many it expired.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–028).

CREATE OR REPLACE FUNCTION public.expire_lapsed_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  WITH updated AS (
    UPDATE public.accounts
      SET status = 'expired', updated_at = now()
      WHERE status = 'active'
        AND account_type IN ('paid_all_access', 'paid_yearly', 'paid_monthly')
        AND subscription_end IS NOT NULL
        AND subscription_end < current_date
      RETURNING 1
  )
  SELECT count(*) INTO n FROM updated;
  RETURN n;
END;
$$;
