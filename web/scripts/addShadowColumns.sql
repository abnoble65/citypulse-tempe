-- Add shadow-specific columns to the projects table.
-- Non-destructive: adds nullable columns with defaults, no data loss.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS shadow_flag boolean DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS shadow_details text;
