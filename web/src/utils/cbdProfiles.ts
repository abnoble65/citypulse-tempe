import { supabase } from "../services/supabase";
import type { CBDConfig } from "../contexts/CBDContext";

export type CBDListItem = Pick<CBDConfig,
  "id" | "slug" | "name" | "short_name" | "accent_color" | "is_active" | "description">;

export async function fetchAllCBDProfiles(): Promise<CBDListItem[]> {
  console.log("[cbdProfiles] fetching from cbd_profiles...");
  const { data, error } = await supabase
    .from("cbd_profiles")
    .select("id, slug, name, short_name, accent_color, is_active, description")
    .order("name");
  if (error) { console.warn("[cbdProfiles] query error:", error.message, error); return []; }
  const active = (data ?? []).filter((d: any) => d.is_active);
  console.log("[cbdProfiles] total:", data?.length, "active:", active.length, data);
  return (data ?? []) as CBDListItem[];
}
