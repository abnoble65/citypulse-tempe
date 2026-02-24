-- Run this in the Supabase SQL editor.
--
-- Creates a SECURITY DEFINER function that upserts a public_sentiment row.
-- Using RPC instead of direct table insert bypasses the PostgREST schema cache,
-- so we don't need to reload the cache every time we ALTER the table.

CREATE OR REPLACE FUNCTION upsert_sentiment(
  p_hearing_id      uuid,
  p_clip_id         text,
  p_speakers        int,
  p_for_project     int,
  p_against_project int,
  p_neutral         int,
  p_top_themes      text[],
  p_notable_quotes  text[],
  p_source          text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public_sentiment (
    hearing_id,
    clip_id,
    speakers,
    for_project,
    against_project,
    neutral,
    top_themes,
    notable_quotes,
    source,
    processed_at
  ) VALUES (
    p_hearing_id,
    p_clip_id,
    p_speakers,
    p_for_project,
    p_against_project,
    p_neutral,
    p_top_themes,
    p_notable_quotes,
    p_source,
    NOW()
  )
  ON CONFLICT (hearing_id) DO UPDATE SET
    clip_id         = EXCLUDED.clip_id,
    speakers        = EXCLUDED.speakers,
    for_project     = EXCLUDED.for_project,
    against_project = EXCLUDED.against_project,
    neutral         = EXCLUDED.neutral,
    top_themes      = EXCLUDED.top_themes,
    notable_quotes  = EXCLUDED.notable_quotes,
    source          = EXCLUDED.source,
    processed_at    = EXCLUDED.processed_at;
END;
$$;
