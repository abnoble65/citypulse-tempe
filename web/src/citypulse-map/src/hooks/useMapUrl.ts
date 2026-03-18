import { useEffect } from 'react'
import { useMapStore } from '../store/mapStore'

/**
 * Syncs selectedBuildingId to/from the URL query string.
 *
 * ?building=CC3D-0667001
 *
 * This is what makes Phase 2 shareable — Kevin receives a URL
 * pointing directly to a building during a demo call.
 *
 * Mount once at the top of MapView.
 */
export function useMapUrl() {
  const { selectedBuildingId, selectBuilding } = useMapStore()

  // On mount: read initial building from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('building')
    if (id && !selectedBuildingId) {
      // Entity will be hydrated by useBuildingById in the parent
      useMapStore.getState().selectBuilding(id, null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On selection change: write to URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (selectedBuildingId) {
      params.set('building', selectedBuildingId)
    } else {
      params.delete('building')
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`
    window.history.replaceState(null, '', newUrl)
  }, [selectedBuildingId])
}
