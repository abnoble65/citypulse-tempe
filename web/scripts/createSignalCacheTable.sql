-- CityPulse — signal_cache table
-- Run this in the Supabase SQL editor before using the Signals page.
-- Stores AI-generated signals so repeat visits load instantly
-- without re-calling the Claude API.

CREATE TABLE IF NOT EXISTS signal_cache (
  cache_key    text PRIMARY KEY,            -- "districtNumber:zip" e.g. "3:94133" or "3:all"
  signals      jsonb        NOT NULL,        -- Signal[] array
  generated_at timestamptz  DEFAULT now()
);

-- Index for time-ordered lookups (used when pruning old rows)
CREATE INDEX IF NOT EXISTS signal_cache_generated_at_idx
  ON signal_cache (generated_at DESC);

-- Optional: auto-delete rows older than 7 days via pg_cron or a scheduled function.
-- For now, the client enforces a 24-hour TTL and overwrites stale rows on upsert.
