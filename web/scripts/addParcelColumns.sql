-- addParcelColumns.sql — Add parcel enrichment columns to projects table.
-- Run via Supabase SQL Editor.
--
-- Source: DataSF Parcels API (acdm-wktn) — no zoning field available,
-- so we store planning_district as the zoning proxy.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS block               text,
  ADD COLUMN IF NOT EXISTS lot                 text,
  ADD COLUMN IF NOT EXISTS parcel_centroid_lat  double precision,
  ADD COLUMN IF NOT EXISTS parcel_centroid_lng  double precision,
  ADD COLUMN IF NOT EXISTS zoning              text;
