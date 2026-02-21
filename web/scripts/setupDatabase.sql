-- SF Planning Commission Minutes Database
-- Run this in the Supabase SQL editor to initialise the schema.

create table if not exists hearings (
  id            uuid primary key default gen_random_uuid(),
  hearing_date  date        not null unique,
  pdf_url       text        not null,
  processed_at  timestamptz not null default now()
);

create table if not exists projects (
  id                  uuid primary key default gen_random_uuid(),
  hearing_id          uuid        not null references hearings(id) on delete cascade,
  case_number         text,
  address             text,
  district            text,
  project_description text,
  action              text,
  motion_number       text
);

create table if not exists votes (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  commissioner_name  text not null,
  vote               text not null  -- e.g. 'aye', 'nay', 'absent', 'recused'
);

create table if not exists commissioner_comments (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  commissioner_name text not null,
  comment_text      text not null
);

-- Indexes for common query patterns
create index if not exists projects_hearing_id_idx      on projects(hearing_id);
create index if not exists votes_project_id_idx         on votes(project_id);
create index if not exists comments_project_id_idx      on commissioner_comments(project_id);
create index if not exists hearings_hearing_date_idx    on hearings(hearing_date);
create index if not exists projects_case_number_idx     on projects(case_number);
create index if not exists projects_address_idx         on projects(address);
