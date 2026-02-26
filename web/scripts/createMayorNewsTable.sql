-- CityPulse — Mayor's Office news table
-- Run this in the Supabase SQL editor before running ingestMayorNews.ts

CREATE TABLE IF NOT EXISTS mayor_news (
  id         serial PRIMARY KEY,
  title      text        NOT NULL,
  date       date        NOT NULL,
  summary    text,                          -- first ~500 chars of article body
  ai_summary text,                          -- Claude-generated 2-sentence summary
  url        text,
  districts  text[],                        -- e.g. {"3","5","citywide"}
  topics     text[],                        -- e.g. {"housing","transit"}
  created_at timestamptz DEFAULT now(),
  UNIQUE (title, date)
);

-- Index for fast date-ordered reads
CREATE INDEX IF NOT EXISTS mayor_news_date_idx ON mayor_news (date DESC);

-- Index for district filtering (GIN on text array)
CREATE INDEX IF NOT EXISTS mayor_news_districts_idx ON mayor_news USING GIN (districts);

-- Index for topic filtering
CREATE INDEX IF NOT EXISTS mayor_news_topics_idx ON mayor_news USING GIN (topics);
