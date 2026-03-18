import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import type { BuildingEntity } from '../types/building'

export type ViewMode = '2d' | '2.5d' | '3d'
export type ReadinessFilter = 'all' | 'PRIME' | 'HIGH' | 'WATCH' | 'LOW'

interface MapState {
  // Selection — kept in URL too, see useMapUrl.ts
  selectedBuildingId: string | null
  selectedBuilding: BuildingEntity | null

  // View
  viewMode: ViewMode
  readinessFilter: ReadinessFilter
  showPendingFields: boolean

  // Sync
  syncQueue: string[]   // BuildingIDs queued for Nextspace
  lastSyncAt: Date | null

  // Actions
  selectBuilding: (id: string | null, entity: BuildingEntity | null) => void
  setViewMode: (mode: ViewMode) => void
  setReadinessFilter: (filter: ReadinessFilter) => void
  togglePendingFields: () => void
  queueForSync: (id: string) => void
  clearSyncQueue: () => void
  markSynced: () => void
}

export const useMapStore = create<MapState>()(
  devtools(
    subscribeWithSelector((set) => ({
      selectedBuildingId: null,
      selectedBuilding: null,
      viewMode: '2.5d',
      readinessFilter: 'all',
      showPendingFields: true,
      syncQueue: [],
      lastSyncAt: null,

      selectBuilding: (id, entity) =>
        set({ selectedBuildingId: id, selectedBuilding: entity }, false, 'selectBuilding'),

      setViewMode: (mode) =>
        set({ viewMode: mode }, false, 'setViewMode'),

      setReadinessFilter: (filter) =>
        set({ readinessFilter: filter }, false, 'setReadinessFilter'),

      togglePendingFields: () =>
        set((s) => ({ showPendingFields: !s.showPendingFields }), false, 'togglePendingFields'),

      queueForSync: (id) =>
        set((s) => ({
          syncQueue: s.syncQueue.includes(id) ? s.syncQueue : [...s.syncQueue, id]
        }), false, 'queueForSync'),

      clearSyncQueue: () =>
        set({ syncQueue: [] }, false, 'clearSyncQueue'),

      markSynced: () =>
        set({ syncQueue: [], lastSyncAt: new Date() }, false, 'markSynced'),
    })),
    { name: 'CityPulse/MapStore' }
  )
)
