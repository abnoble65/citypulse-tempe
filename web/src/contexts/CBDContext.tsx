/**
 * CBDContext.tsx — React context for Community Benefit District portal.
 *
 * Fetches cbd_profiles by slug from Supabase and provides the config
 * to all CBD child components via useCBD() hook.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../services/supabase";

export interface CBDConfig {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  accent_color: string;
  boundary_geojson: { type: string; coordinates: number[][][][] } | null;
  center_lat: number | null;
  center_lng: number | null;
  default_zoom: number;
  executive_director: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  supervisor_district: number | null;
  description: string | null;
  services: string[];
  is_active: boolean;
}

interface CBDContextValue {
  config: CBDConfig | null;
  loading: boolean;
  error: string | null;
}

const CBDContext = createContext<CBDContextValue>({
  config: null,
  loading: true,
  error: null,
});

export function useCBD(): CBDContextValue {
  return useContext(CBDContext);
}

export function CBDProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [config, setConfig] = useState<CBDConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setConfig(null);

    supabase
      .from("cbd_profiles")
      .select("*")
      .eq("slug", slug)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError("CBD profile not found");
          setLoading(false);
          return;
        }
        if (!data.is_active) {
          setError("inactive");
          setLoading(false);
          return;
        }
        const cfg: CBDConfig = {
          id: data.id,
          slug: data.slug,
          name: data.name,
          short_name: data.short_name,
          logo_url: data.logo_url ?? null,
          accent_color: data.accent_color ?? "#E8652D",
          boundary_geojson: data.boundary_geojson ?? null,
          center_lat: data.center_lat ?? null,
          center_lng: data.center_lng ?? null,
          default_zoom: data.default_zoom ?? 16,
          executive_director: data.executive_director ?? null,
          contact_email: data.contact_email ?? null,
          contact_phone: data.contact_phone ?? null,
          website_url: data.website_url ?? null,
          supervisor_district: data.supervisor_district ?? null,
          description: data.description ?? null,
          services: Array.isArray(data.services) ? data.services : [],
          is_active: data.is_active,
        };
        setConfig(cfg);
        setLoading(false);
      });
  }, [slug]);

  return (
    <CBDContext.Provider value={{ config, loading, error }}>
      {children}
    </CBDContext.Provider>
  );
}
