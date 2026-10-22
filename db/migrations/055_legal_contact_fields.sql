-- 055_legal_contact_fields.sql (idempotent, manual-apply in the Supabase SQL editor)
--
-- Per-legal contact fields on the Legal Database record (publisher direction
-- 2026-10-21). Customer-filed legals auto-fill these from the customer's
-- billing profile at save; staff-entered legals type them in.

alter table public.customer_legals
  add column if not exists contact_name  text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

notify pgrst, 'reload schema';
