-- setupCBDProfiles.sql — CityPulse CBD Portal schema
-- Run manually: paste into Supabase SQL Editor

CREATE TABLE IF NOT EXISTS cbd_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  short_name text NOT NULL,
  logo_url text,
  accent_color text DEFAULT '#E8652D',
  boundary_geojson jsonb,
  center_lat double precision,
  center_lng double precision,
  default_zoom int DEFAULT 16,
  executive_director text,
  contact_email text,
  contact_phone text,
  website_url text,
  supervisor_district int,
  description text,
  services jsonb DEFAULT '[]',
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cbd_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cbd_slug text REFERENCES cbd_profiles(slug),
  content_type text NOT NULL,
  content text,
  data_snapshot jsonb,
  created_at timestamptz DEFAULT now()
);
