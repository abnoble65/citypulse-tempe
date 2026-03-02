-- CityPulse — briefing_overview_cache table
-- Run this in the Supabase SQL editor before using the dynamic overview.
-- Stores AI-generated morning-briefing paragraphs so repeat visits load
-- instantly without re-calling the Claude API.

CREATE TABLE IF NOT EXISTS briefing_overview_cache (
  cache_key    text PRIMARY KEY,            -- "districtNumber:zip" e.g. "3:94133" or "3:all"
  overview     text         NOT NULL,       -- plain-text 3–4 sentence paragraph
  generated_at timestamptz  DEFAULT now()
);

-- Index for time-ordered lookups (used when pruning old rows)
CREATE INDEX IF NOT EXISTS briefing_overview_cache_generated_at_idx
  ON briefing_overview_cache (generated_at DESC);

-- Optional: auto-delete rows older than 7 days via pg_cron or a scheduled function.
-- For now, the client enforces a 24-hour TTL and overwrites stale rows on upsert.
