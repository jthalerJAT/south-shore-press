-- 056_legal_payment_link.sql (idempotent, manual-apply in the Supabase SQL editor)
--
-- Stripe payment link per legal (publisher direction 2026-10-22): staff
-- create a card-payment link for the quoted amount from the legal record;
-- accounting attaches the URL to QuickBooks invoices. Links are durable
-- (no expiry); replacing one deactivates the old link in Stripe.

alter table public.customer_legals
  add column if not exists payment_link_id     text,
  add column if not exists payment_link_url    text,
  add column if not exists payment_link_amount integer; -- cents

notify pgrst, 'reload schema';
