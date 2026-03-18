import type { BuildingEntity } from '../types/building'

/**
 * nextspaceSyncService.ts
 *
 * Phase 1: logs the payload to console. Returns a resolved promise.
 * Phase 2: replace sendToNextspace() body with the real CC3D API call
 *          once Kevin provides the scene credentials endpoint.
 *
 * The interface is fixed now so MapView and AttributeInspector
 * don't need to change when Phase 2 activates.
 */

export interface SyncPayload {
  building_id: string
  scene_id: string               // CC3D scene identifier — Phase 2: from env
  attributes: Record<string, unknown>
  synced_at: string              // ISO timestamp
}

export interface SyncResult {
  success: boolean
  building_id: string
  error?: string
}

/**
 * Extracts only ready + ai_derived fields for the Nextspace payload.
 * Pending and not_sourced fields are intentionally excluded —
 * we never send nulls to Nextspace.
 */
export function buildSyncPayload(entity: BuildingEntity): SyncPayload {
  const attributes: Record<string, unknown> = {}

  for (const [field, status] of Object.entries(entity.field_status)) {
    if (status === 'available' || status === 'ai_derived') {
      const value = (entity as Record<string, unknown>)[field]
      if (value !== null && value !== undefined) {
        attributes[field] = value
      }
    }
  }

  return {
    building_id: entity.building_id,
    scene_id: import.meta.env.VITE_NEXTSPACE_SCENE_ID ?? 'SCENE_ID_PENDING',
    attributes,
    synced_at: new Date().toISOString(),
  }
}

/**
 * Phase 1 — console only.
 * Phase 2 — replace with: await fetch(CC3D_ENDPOINT, { method: 'PATCH', body: JSON.stringify(payload) })
 */
export async function sendToNextspace(payload: SyncPayload): Promise<SyncResult> {
  console.group(`[CityPulse] Nextspace sync — ${payload.building_id}`)
  console.log('Scene:', payload.scene_id)
  console.log('Attribute count:', Object.keys(payload.attributes).length)
  console.log('Payload:', payload)
  console.groupEnd()

  // Phase 2: uncomment and populate
  // const ENDPOINT = `${import.meta.env.VITE_CC3D_API_BASE}/scenes/${payload.scene_id}/entities/${payload.building_id}`
  // const res = await fetch(ENDPOINT, {
  //   method: 'PATCH',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${import.meta.env.VITE_CC3D_API_KEY}`,
  //   },
  //   body: JSON.stringify(payload.attributes),
  // })
  // if (!res.ok) return { success: false, building_id: payload.building_id, error: `HTTP ${res.status}` }

  return { success: true, building_id: payload.building_id }
}

export async function syncBuilding(entity: BuildingEntity): Promise<SyncResult> {
  const payload = buildSyncPayload(entity)
  return sendToNextspace(payload)
}
