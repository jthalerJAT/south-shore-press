-- 039_ad_clients_files.sql
-- Ad Database v2: clients + a file system per client.
--
-- The original `ads` table (012) mixed advertiser identity with ONE copy file,
-- ONE insert order and ONE contract per row, so repeat advertisers piled up as
-- duplicate rows ("an endless stream of random ads"). The new model:
--
--   ad_clients — one row per advertiser account (business + contact details)
--   ad_files   — every uploaded document, kind ∈ copy | insert_order | contract,
--                with copy_size on copy files (full/half/third/quarter)
--
-- The backfill below folds ALL existing data into the new tables:
--   * one client per distinct business name (case/whitespace-insensitive),
--     contacts taken from that business's most recent ads row
--   * every ads.copy_storage_path        → ad_files kind='copy' (+ copy_size)
--   * every ads.insert_order_path        → ad_files kind='insert_order'
--   * every ads.contract_path            → ad_files kind='contract'
--   * every ad_runs.insert_order_path    → ad_files kind='insert_order'
--   File dates inherit the source row's created_at so reverse-chron listings
--   reflect when the document actually arrived.
--
-- `ads` / `ad_runs` are kept (not dropped): placed newspaper ads snapshot
-- their data and only reference ad ids informationally, and run/billing data
-- is retained for a future billing view. No code writes to them after this.
--
-- Idempotent; apply manually in the Supabase SQL editor (same as 002-038).

CREATE TABLE IF NOT EXISTS public.ad_clients (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name  text NOT NULL,
  contact_name   text,
  contact_phone  text,
  contact_email  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid
);
CREATE INDEX IF NOT EXISTS ad_clients_name_idx ON public.ad_clients (lower(business_name));

CREATE TABLE IF NOT EXISTS public.ad_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.ad_clients(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('copy', 'insert_order', 'contract')),
  storage_path  text NOT NULL,
  file_name     text,
  copy_size     text,          -- 'full' | 'half' | 'third' | 'quarter'; copy only
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid
);
CREATE INDEX IF NOT EXISTS ad_files_client_kind_idx
  ON public.ad_files (client_id, kind, created_at DESC);

-- RLS: editor-tier manages both (matching the ads tables); the service-role
-- client used in server actions bypasses RLS.
ALTER TABLE public.ad_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editors manage ad_clients" ON public.ad_clients;
CREATE POLICY "editors manage ad_clients"
  ON public.ad_clients
  FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));

DROP POLICY IF EXISTS "editors manage ad_files" ON public.ad_files;
CREATE POLICY "editors manage ad_files"
  ON public.ad_files
  FOR ALL
  USING (public.is_editor_tier(auth.uid()))
  WITH CHECK (public.is_editor_tier(auth.uid()));

-- ── Backfill ────────────────────────────────────────────────────────────────

-- 1) One client per distinct business name; contact details from the most
--    recent ads row bearing that name. Skips names that already exist in
--    ad_clients (re-run safe).
INSERT INTO public.ad_clients (business_name, contact_name, contact_phone, contact_email, created_at, created_by)
SELECT DISTINCT ON (lower(trim(a.business_name)))
       trim(a.business_name),
       a.contact_name,
       a.contact_phone,
       a.contact_email,
       min(a.created_at) OVER (PARTITION BY lower(trim(a.business_name))),
       a.created_by
FROM public.ads a
WHERE trim(a.business_name) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.ad_clients c
    WHERE lower(trim(c.business_name)) = lower(trim(a.business_name))
  )
ORDER BY lower(trim(a.business_name)), a.created_at DESC;

-- 2) Copy files.
INSERT INTO public.ad_files (client_id, kind, storage_path, file_name, copy_size, created_at, created_by)
SELECT c.id, 'copy', a.copy_storage_path, a.copy_file_name, a.copy_size, a.created_at, a.created_by
FROM public.ads a
JOIN public.ad_clients c
  ON lower(trim(c.business_name)) = lower(trim(a.business_name))
WHERE a.copy_storage_path IS NOT NULL
  AND a.copy_storage_path <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.ad_files f
    WHERE f.storage_path = a.copy_storage_path AND f.kind = 'copy'
  );

-- 3) Advertiser-level insert orders.
INSERT INTO public.ad_files (client_id, kind, storage_path, file_name, created_at, created_by)
SELECT c.id, 'insert_order', a.insert_order_path, a.insert_order_file_name, a.created_at, a.created_by
FROM public.ads a
JOIN public.ad_clients c
  ON lower(trim(c.business_name)) = lower(trim(a.business_name))
WHERE a.insert_order_path IS NOT NULL
  AND a.insert_order_path <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.ad_files f
    WHERE f.storage_path = a.insert_order_path AND f.kind = 'insert_order'
  );

-- 4) Contracts.
INSERT INTO public.ad_files (client_id, kind, storage_path, file_name, created_at, created_by)
SELECT c.id, 'contract', a.contract_path, a.contract_file_name, a.created_at, a.created_by
FROM public.ads a
JOIN public.ad_clients c
  ON lower(trim(c.business_name)) = lower(trim(a.business_name))
WHERE a.contract_path IS NOT NULL
  AND a.contract_path <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.ad_files f
    WHERE f.storage_path = a.contract_path AND f.kind = 'contract'
  );

-- 5) Run-level insert orders (migration 012 kept one per scheduled run).
INSERT INTO public.ad_files (client_id, kind, storage_path, file_name, created_at)
SELECT c.id, 'insert_order', r.insert_order_path, r.insert_order_file_name, r.created_at
FROM public.ad_runs r
JOIN public.ads a ON a.id = r.ad_id
JOIN public.ad_clients c
  ON lower(trim(c.business_name)) = lower(trim(a.business_name))
WHERE r.insert_order_path IS NOT NULL
  AND r.insert_order_path <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.ad_files f
    WHERE f.storage_path = r.insert_order_path AND f.kind = 'insert_order'
  );

-- ── Verify ──────────────────────────────────────────────────────────────────
-- SELECT c.business_name,
--        count(*) FILTER (WHERE f.kind = 'copy')          AS copies,
--        count(*) FILTER (WHERE f.kind = 'insert_order')  AS insert_orders,
--        count(*) FILTER (WHERE f.kind = 'contract')      AS contracts
-- FROM public.ad_clients c
-- LEFT JOIN public.ad_files f ON f.client_id = c.id
-- GROUP BY c.business_name
-- ORDER BY lower(c.business_name);
