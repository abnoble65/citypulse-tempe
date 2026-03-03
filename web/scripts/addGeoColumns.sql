-- Run this once in the Supabase Dashboard → SQL Editor
-- https://app.supabase.com/project/tgokablobqwaswilidyp/editor

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS lat         double precision,
  ADD COLUMN IF NOT EXISTS lng         double precision,
  ADD COLUMN IF NOT EXISTS parcel_apn  text;

-- Verify:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'projects'
  AND column_name IN ('lat','lng','parcel_apn')
ORDER BY column_name;
