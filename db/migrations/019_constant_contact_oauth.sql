-- 019_constant_contact_oauth.sql
-- ----------------------------------------------------------------------------
-- Server-side OAuth token store for the Constant Contact integration (Email
-- Briefings sign-up pushes contacts to a CC list).
--
-- CC API v3 uses OAuth2 with ROTATING refresh tokens — each refresh returns a
-- new refresh token that must be persisted — so a static env var won't do. This
-- single-row table holds the current access + refresh token. RLS is enabled
-- with NO policies, so only the service-role admin client (the CC client +
-- the OAuth callback) can read/write it; tokens are never exposed to readers.
--
-- Idempotent + manual-apply (Supabase SQL editor), same style as 006/016–018.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.constant_contact_oauth (
  id            int PRIMARY KEY DEFAULT 1,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT constant_contact_oauth_singleton CHECK (id = 1)
);

ALTER TABLE public.constant_contact_oauth ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: anon/authenticated get zero access; the service-role
-- client (used only in server code) bypasses RLS to read/refresh the token.
