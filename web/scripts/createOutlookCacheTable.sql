-- CityPulse — outlook_cache table
-- Run this in the Supabase SQL editor before using the Outlook page.
-- Stores AI-generated outlook data so repeat visits load instantly
-- without re-calling the Claude API.

CREATE TABLE IF NOT EXISTS outlook_cache (
  cache_key    text PRIMARY KEY,            -- "districtNumber:zip" e.g. "3:94133" or "3:all"
  outlook      jsonb        NOT NULL,        -- OutlookData object {events, risks, engagement}
  generated_at timestamptz  DEFAULT now()
);

-- Index for time-ordered lookups (used when pruning old rows)
CREATE INDEX IF NOT EXISTS outlook_cache_generated_at_idx
  ON outlook_cache (generated_at DESC);

-- Optional: auto-delete rows older than 7 days via pg_cron or a scheduled function.
-- For now, the client enforces a 24-hour TTL and overwrites stale rows on upsert.
