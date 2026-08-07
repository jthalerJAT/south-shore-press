-- 040_customer_portals.sql
-- Customer-facing Ad Portal + Legal Portal.
--
--   1. Two new CUSTOMER credentials live in profiles.roles[]: 'advertiser'
--      and 'legal'. They are text[] values only — the legacy `role` enum
--      column is never written with them (customers stay 'reader' there),
--      so v1 and every RLS policy keep working unchanged.
--   2. profiles.ad_client_id — the "Link User to Advertiser File" pointer:
--      which Ad Database client file this user's uploads land in.
--   3. customer_profiles — the Billing Information block both portals edit
--      (customer/business name + contact + mailing address incl. a second
--      street line the signup form doesn't collect).
--   4. ad_files.notes — the "Other Notes" text captured with a customer
--      ad upload (≤500 words, enforced in the app).
--   5. customer_legals + the L-number sequence. L#s start at L40001 and
--      count up; nextval() makes concurrent submissions collision-proof.
--      Each legal snapshots its run dates (all Wednesdays in range).
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002-039).

-- ── 1/2. Advertiser-file link ───────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ad_client_id uuid REFERENCES public.ad_clients(id) ON DELETE SET NULL;

-- ── 3. Customer billing profiles ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  user_id        uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name  text,
  contact_name   text,
  contact_phone  text,
  contact_email  text,
  street         text,
  street2        text,
  city           text,
  state          text,
  zip            text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own customer profile" ON public.customer_profiles;
CREATE POLICY "own customer profile"
  ON public.customer_profiles
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "editors read customer profiles" ON public.customer_profiles;
CREATE POLICY "editors read customer profiles"
  ON public.customer_profiles
  FOR SELECT
  USING (public.is_editor_tier(auth.uid()));

-- ── 4. Notes on ad files ────────────────────────────────────────────────────
ALTER TABLE public.ad_files
  ADD COLUMN IF NOT EXISTS notes text;

-- ── 5. Legal submissions + L-number sequence ────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.legal_number_seq START WITH 40001;

-- Server-side reservation of the next L#. SECURITY DEFINER so the portal can
-- reserve a number under the caller's auth without sequence grants.
CREATE OR REPLACE FUNCTION public.next_legal_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'L' || nextval('public.legal_number_seq')::text;
$$;

CREATE TABLE IF NOT EXISTS public.customer_legals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name    text,
  header           text NOT NULL,
  body             text NOT NULL,
  l_number         text NOT NULL UNIQUE,
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  run_dates        date[] NOT NULL,
  notary_required  boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_legals_created_idx ON public.customer_legals (created_at DESC);
CREATE INDEX IF NOT EXISTS customer_legals_user_idx ON public.customer_legals (user_id, created_at DESC);

ALTER TABLE public.customer_legals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own customer legals" ON public.customer_legals;
CREATE POLICY "own customer legals"
  ON public.customer_legals
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "editors read customer legals" ON public.customer_legals;
CREATE POLICY "editors read customer legals"
  ON public.customer_legals
  FOR SELECT
  USING (public.is_editor_tier(auth.uid()));

-- Inserts happen exclusively through the portal's server action using the
-- service-role client (validated + L# assigned there) — no INSERT policy.

-- ── Verify ──────────────────────────────────────────────────────────────────
-- SELECT public.next_legal_number();          -- → L40001 (consumes a number)
-- SELECT * FROM public.customer_legals LIMIT 5;
