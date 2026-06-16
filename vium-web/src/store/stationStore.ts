import { create } from 'zustand';
import type { ChargingStation, ChargerType } from '../types';
import { stationService } from '../services/stationService';
import { FILTER_CONNECTOR_MAP } from '../types/constants';

// 충전소와 관련된 모든 상태를 관리하는 스토어입니다.
// 필터링, 정렬, GPS 정보 등을 한곳에서 관리하면 컴포넌트 구조가 훨씬 깔끔해지더라구요.
interface StationState {
  stations: ChargingStation[];
  activeFilter: ChargerType | 'All';
  selectedConnector: string | 'All';
  onlyAvailable: boolean;
  searchQuery: string;
  isLoading: boolean;
  
  // 현재 선택된 충전소 정보들
  selectedStationId: string | null;
  reportTargetId: string | null;
  summaryStationId: string | null;
  
  // GPS 좌표 및 길찾기 경로 데이터
  userLocation: { lat: number; lng: number } | null;
  routePath: [number, number][]; 
  routeSummary: { distance: number; duration: number; destinationName?: string } | null;
  
  // 각종 상태 변경 액션들
  fetchStations: () => Promise<void>;
  setActiveFilter: (filter: ChargerType | 'All') => void;
  setSelectedConnector: (connector: string | 'All') => void;
  setOnlyAvailable: (available: boolean) => void;
  setSearchQuery: (query: string) => void;
  
  setSelectedStationId: (id: string | null) => void;
  setReportTargetId: (id: string | null) => void;
  setSummaryStationId: (id: string | null) => void;
  
  fetchRoute: (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }, destName?: string) => Promise<void>;
  clearRoute: () => void;
  setUserLocation: (location: { lat: number; lng: number } | null) => void;
  
  // 유틸리티 함수 (현재 이용 가능 대수 계산 등)
  getAvailableSlots: (station: ChargingStation) => number;
  getFilteredStations: () => ChargingStation[];
}

export const useStationStore = create<StationState>((set, get) => ({
  stations: [],
  activeFilter: 'All',
  selectedConnector: 'All',
  onlyAvailable: false,
  searchQuery: '',
  isLoading: false,

  selectedStationId: null,
  reportTargetId: null,
  summaryStationId: null,

  userLocation: null,
  routePath: [],
  routeSummary: null,

  // [사일런트 업데이트] 3초마다 데이터를 새로 가져오는데, 
  // 매번 로딩 스피너를 보여주면 불편하니까 처음 로딩할 때만 isLoading을 true로 바꿉니다.
  fetchStations: async () => {
    const isInitialLoad = get().stations.length === 0;
    if (isInitialLoad) set({ isLoading: true });
    
    try {
      const response = await stationService.getStations();
      if (response.success && response.data) {
        set({ stations: response.data });
      }
    } catch (error) {
      console.error('Failed to fetch stations:', error);
    } finally {
      if (isInitialLoad) set({ isLoading: false });
    }
  },

  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setSelectedConnector: (connector) => set({ selectedConnector: connector }),
  setOnlyAvailable: (available) => set({ onlyAvailable: available }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  setSelectedStationId: (id) => set({ selectedStationId: id }),
  setReportTargetId: (id) => set({ reportTargetId: id }),
  setSummaryStationId: (id) => set({ summaryStationId: id }),

  // 카카오 길찾기 API를 호출해서 내 위치부터 충전소까지의 경로를 가져오는 로직입니다.
  fetchRoute: async (origin, destination, destName) => {
    set({ isLoading: true });
    try {
      const originStr = `${origin.lng},${origin.lat}`;
      const destStr = `${destination.lng},${destination.lat}`;
      const response = await stationService.getDirections(originStr, destStr);
      if (response.success && response.data) {
        set({ 
          routePath: response.data.path,
          routeSummary: { ...response.data.summary, destinationName: destName }
        });
      }
    } catch (error) {
      console.error('Failed to fetch route:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  clearRoute: () => set({ routePath: [], routeSummary: null }),
  setUserLocation: (location) => set({ userLocation: location }),

  getAvailableSlots: (station) => {
    if (!station || !Array.isArray(station.chargers)) return 0;
    return station.chargers.filter(c => c && c.status === 'Available').length;
  },

  // [지능형 필터링 및 정렬] 
  // 사용자가 설정한 필터(급속/완속, 커넥터 등)에 맞춰 데이터를 거르고, 
  // 현재 위치에서 가까운 순서대로 예쁘게 정렬해서 반환해줍니다.
  getFilteredStations: () => {
    const { stations, activeFilter, selectedConnector, onlyAvailable, searchQuery, userLocation } = get();
    if (!Array.isArray(stations)) return [];

    // [하버사인 공식] 구형 지구의 두 지점 간 거리를 계산하는 수학 공식이에요. 
    // 지도 앱처럼 정확한 거리를 보여주기 위해 구현했습니다!
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // 지구 반지름 (km)
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = stations.filter((station) => {
      // 1. 충전기 타입(급속/완속) 필터링
      const typeMatch = activeFilter === 'All' || station.chargers.some(c => c.charger_type === activeFilter);
      
      // 2. 커넥터 모양(DC콤보 등) 필터링
      const connectorMatch = selectedConnector === 'All' || station.chargers.some(c => {
        const allowed = FILTER_CONNECTOR_MAP[selectedConnector] || [];
        return allowed.includes(c.connector_type);
      });
      
      // 3. '지금 바로 충전 가능'한 곳만 보기 필터링
      const availableMatch = !onlyAvailable || station.chargers.some(c => c.status === 'Available');

      if (!(typeMatch && connectorMatch && availableMatch)) return false;
      if (normalizedQuery === '') return true;

      // 4. 검색어 매칭 (충전소 이름이나 주소)
      return station.station_name.toLowerCase().includes(normalizedQuery) || 
             station.address.toLowerCase().includes(normalizedQuery);
    });

    // 정렬 우선순위: 1. 검색어 일치율 (이름 매칭이 우선!) -> 2. 가까운 거리순
    return [...filtered].sort((a, b) => {
      if (normalizedQuery !== '') {
        const aNameMatch = a.station_name.toLowerCase().includes(normalizedQuery) ? 1 : 0;
        const bNameMatch = b.station_name.toLowerCase().includes(normalizedQuery) ? 1 : 0;
        if (aNameMatch !== bNameMatch) return bNameMatch - aNameMatch;
      }

      if (userLocation) {
        const distA = calculateDistance(userLocation.lat, userLocation.lng, Number(a.latitude), Number(a.longitude));
        const distB = calculateDistance(userLocation.lat, userLocation.lng, Number(b.latitude), Number(b.longitude));
        return distA - distB;
      }

      return 0;
    });
  },
}));
