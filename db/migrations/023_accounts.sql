-- 023_accounts.sql
-- Internal Account Database — the master CRM / mailing record that replaces
-- SimpleCirc. A SUPERSET of everyone we mail to or who has a login, including
-- people with no account at all (weekly mailers, free-physical recipients).
--
-- Sits alongside (does not replace) `profiles` (logins) and `subscription_orders`
-- (the Stripe order ledger); it links to both via nullable columns.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002–022).

CREATE TABLE IF NOT EXISTS public.accounts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type           text NOT NULL CHECK (account_type IN (
                            'digital_only','paid_all_access','paid_yearly',
                            'paid_monthly','free','advertiser','mailer')),
  status                 text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','expired')),
  first_name             text,
  last_name              text,
  company                text,
  address_1              text,
  address_2              text,
  city                   text,
  state                  text,
  zip                    text,          -- may carry the +4 suffix "11763-4019"
  email                  text,
  phone                  text,
  subscription_start     date,          -- paid subscriptions only
  subscription_end       date,          -- paid subscriptions only
  acs_keyline            text,          -- USPS/ACS presort keyline (TBD by editor)
  user_id                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_customer_id     text,
  stripe_subscription_id text,
  source                 text,          -- provenance: signup | subscribe | mailer_import | manual
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounts_type_idx       ON public.accounts (account_type);
CREATE INDEX IF NOT EXISTS accounts_status_idx     ON public.accounts (status);
CREATE INDEX IF NOT EXISTS accounts_last_name_idx  ON public.accounts (lower(last_name));
CREATE INDEX IF NOT EXISTS accounts_user_id_idx    ON public.accounts (user_id);
CREATE INDEX IF NOT EXISTS accounts_stripe_sub_idx ON public.accounts (stripe_subscription_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Admin-only (admin / master admin) manage — reuses the is_credentials_admin
-- SECURITY DEFINER helper from migration 002. The service-role client used by
-- the signup / Stripe wiring and the mailer import bypasses RLS as usual.
DROP POLICY IF EXISTS "admins manage accounts" ON public.accounts;
CREATE POLICY "admins manage accounts" ON public.accounts
  FOR ALL
  USING (public.is_credentials_admin(auth.uid()))
  WITH CHECK (public.is_credentials_admin(auth.uid()));
