-- Drop and recreate public_sentiment with the correct schema.
-- Run this in the Supabase SQL editor.

DROP TABLE IF EXISTS public_sentiment;

CREATE TABLE public_sentiment (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hearing_id       uuid        NOT NULL REFERENCES hearings(id) ON DELETE CASCADE,
  clip_id          text,
  speakers         integer     NOT NULL DEFAULT 0,
  for_project      integer     NOT NULL DEFAULT 0,
  against_project  integer     NOT NULL DEFAULT 0,
  neutral          integer     NOT NULL DEFAULT 0,
  top_themes       text[]      NOT NULL DEFAULT '{}',
  notable_quotes   text[]      NOT NULL DEFAULT '{}',
  source           text        NOT NULL DEFAULT 'sfgovtv_captions',
  processed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hearing_id)
);

CREATE INDEX IF NOT EXISTS sentiment_hearing_id_idx ON public_sentiment(hearing_id);

ALTER TABLE public_sentiment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read sentiment"
  ON public_sentiment FOR SELECT USING (true);
