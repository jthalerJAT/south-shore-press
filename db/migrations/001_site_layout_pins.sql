-- Site Layout Pins
-- =================
-- Lets editors pin specific stories to specific slots on the public site
-- (homepage hero / top stories / video vault / section rails, and section
-- index pages). Unfilled slots fall back to recency-based defaults at
-- render time.
--
-- slot_key convention (use hyphens to match section slugs):
--   home.hero            -- homepage hero carousel (positions 1-5)
--   home.top-stories     -- homepage Top Stories rail (1-10)
--   home.video-vault     -- homepage Video Vault rail (1-4)
--   home.local           -- homepage Local rail (1-4)
--   home.sports          -- homepage Sports rail (1-4)
--   home.opinion         -- homepage Opinion rail (1-4)
--   home.national        -- homepage Nation rail (1-4)
--   section.local        -- /local page top stories (1-3)
--   section.state        -- /state page top stories (1-3)
--   section.national     -- /national page top stories (1-3)
--   section.world        -- /world page top stories (1-3)
--   section.sports       -- /sports page top stories (1-3)
--   section.crime        -- /crime page top stories (1-3)
--   section.opinion      -- /opinion page top stories (1-3)
--   section.legals       -- /legals page top stories (1-3)
--   section.video-vault  -- /video-vault page top stories (1-3)
--
-- Run this entire block in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS site_layout_pins (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key    text NOT NULL,
  position    int  NOT NULL CHECK (position > 0),
  story_id    uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES profiles(id),
  -- Only one story can be pinned to a given (slot, position) at a time.
  -- The editor flow upserts on this constraint to swap stories.
  UNIQUE (slot_key, position)
);

-- Fast lookup by slot_key + position for the homepage/section reads.
CREATE INDEX IF NOT EXISTS site_layout_pins_slot_idx
  ON site_layout_pins (slot_key, position);

-- Row-Level Security
-- ------------------
-- SELECT: anyone (the public reader site needs to read pins to render
--   the homepage; pins don't expose anything not already public).
-- INSERT/UPDATE/DELETE: editor / admin / master admin only.
ALTER TABLE site_layout_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read site layout pins" ON site_layout_pins;
CREATE POLICY "anyone can read site layout pins"
  ON site_layout_pins
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "editors can manage site layout pins" ON site_layout_pins;
CREATE POLICY "editors can manage site layout pins"
  ON site_layout_pins
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND lower(profiles.role) IN ('editor', 'admin', 'master admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND lower(profiles.role) IN ('editor', 'admin', 'master admin')
    )
  );
