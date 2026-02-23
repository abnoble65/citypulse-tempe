-- public_sentiment table
-- Run this in the Supabase SQL editor.
--
-- One row per hearing. Stores aggregated public comment sentiment
-- extracted from SFGovTV / Granicus caption transcripts.

create table if not exists public_sentiment (
  id               uuid        primary key default gen_random_uuid(),
  hearing_id       uuid        not null references hearings(id) on delete cascade,
  clip_id          text,                         -- Granicus clip_id used as source
  speakers         integer     not null default 0,
  for_project      integer     not null default 0,
  against_project  integer     not null default 0,
  neutral          integer     not null default 0,
  top_themes       text[]      not null default '{}',
  notable_quotes   text[]      not null default '{}',
  source           text        not null default 'sfgovtv_captions',
  processed_at     timestamptz not null default now(),

  unique (hearing_id)
);

create index if not exists sentiment_hearing_id_idx on public_sentiment(hearing_id);

-- Grant anon read access (matches existing table pattern)
alter table public_sentiment enable row level security;
create policy "anon can read sentiment"
  on public_sentiment for select using (true);
