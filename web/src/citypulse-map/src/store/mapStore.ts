import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import type { BuildingEntity, UnknownParcel } from '../types/building'

export type ViewMode = '2d' | '3d'
export type ReadinessFilter = 'all' | 'PRIME' | 'HIGH' | 'WATCH' | 'LOW'

interface MapState {
  // Selection — kept in URL too, see useMapUrl.ts
  selectedBuildingId: string | null
  selectedBuilding: BuildingEntity | null

  // View
  viewMode: ViewMode
  readinessFilter: ReadinessFilter
  showPendingFields: boolean

  // Unknown parcel (clicked outside known buildings)
  unknownParcel: UnknownParcel | null

  // Buildings list (set by useBuildings hook)
  buildings: BuildingEntity[] | null

  // Sync
  syncQueue: string[]   // BuildingIDs queued for Nextspace
  lastSyncAt: Date | null

  // Actions
  selectBuilding: (id: string | null, entity: BuildingEntity | null) => void
  selectUnknownParcel: (parcel: UnknownParcel | null) => void
  setBuildings: (buildings: BuildingEntity[]) => void
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
      unknownParcel: null,
      buildings: null,
      viewMode: '3d',
      readinessFilter: 'all',
      showPendingFields: true,
      syncQueue: [],
      lastSyncAt: null,

      selectBuilding: (id, entity) =>
        set({ selectedBuildingId: id, selectedBuilding: entity, unknownParcel: null }, false, 'selectBuilding'),

      selectUnknownParcel: (parcel) =>
        set({ unknownParcel: parcel, selectedBuildingId: null, selectedBuilding: null }, false, 'selectUnknownParcel'),

      setBuildings: (buildings) =>
        set({ buildings }, false, 'setBuildings'),

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
