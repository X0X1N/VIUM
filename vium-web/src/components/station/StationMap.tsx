import { useEffect, useRef, useState, useCallback } from "react";
import { Compass, Navigation, Clock, Flag, X, Info } from "lucide-react";
import { useStationStore } from "../../store/stationStore";
import type { ChargingStation } from "../../types";

interface StationMapProps {
  stations: ChargingStation[];
  onMarkerClick: (station) => void;
  onMapClick?: () => void;
  onViewStationInfo?: (stationId: string) => void; 
  isLoading: boolean;
}

declare global {
  interface Window {
    kakao: any;
    focusStationOnMap: (stationId: string) => void;
  }
}

interface MarkerState {
  marker: any;
  uri: string;
}

export function StationMap({ stations, onMarkerClick, onMapClick, onViewStationInfo, isLoading }: StationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const clustererInstance = useRef<any>(null);
  
  // 마커들을 관리할 Map 객체입니다. 
  // 3초마다 데이터를 새로 가져올 때 바뀐 부분만 업데이트해서 화면 깜빡임을 없애려고 도입했어요!
  const markersRef = useRef<Map<string, MarkerState>>(new Map());
  const [isReady, setIsReady] = useState(false);
  
  const [isUserDragging, setIsUserDragging] = useState(false); 
  const { 
    getAvailableSlots, 
    userLocation, 
    routePath, 
    routeSummary, 
    clearRoute, 
    setUserLocation 
  } = useStationStore();

  const userMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // 현재 내 위치를 찾아서 지도의 중심으로 이동시키는 함수입니다.
  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const pos = { lat: latitude, lng: longitude };
        setUserLocation(pos);
        
        if (mapInstance.current) {
          mapInstance.current.setCenter(new window.kakao.maps.LatLng(latitude, longitude));
          mapInstance.current.setLevel(4);
        }
      },
      (error) => console.error(error),
      { enableHighAccuracy: true }
    );
  };

  // [중요] 카카오 지도 SDK는 비동기로 로드되기 때문에, 
  // window.kakao 객체가 준비될 때까지 기다렸다가 지도를 그려야 에러가 안 나더라구요.
  useEffect(() => {
    const initMap = () => {
      window.kakao.maps.load(() => {
        setIsReady(true);
      });
    };

    if (window.kakao && window.kakao.maps) {
      if (window.kakao.maps.Map) {
        setIsReady(true);
      } else {
        initMap();
      }
    } else {
      // SDK가 아직 안 왔다면 300ms 간격으로 계속 체크해줍니다 (폴링 방식)
      const check = setInterval(() => {
        if (window.kakao && window.kakao.maps) {
          initMap();
          clearInterval(check);
        }
      }, 300);
      return () => clearInterval(check);
    }
  }, []);

  // 마커 이미지를 고정된 파일이 아니라 SVG 코드로 직접 그렸습니다.
  // 이렇게 하면 '이용 가능' 대수나 '고장 여부'에 따라 색상을 실시간으로 바꿀 수 있어서 훨씬 유연해요.
  const createSvgMarkerUri = useCallback((available: number, total: number, chargers: any[]) => {
    let color = '#2563eb'; // 기본: 파란색 (여유 있음)
    if (available === 0) {
      const isAllFaulty = chargers.length > 0 && chargers.every(c => c.status === 'Faulty');
      if (isAllFaulty) color = '#ef4444'; // 빨간색 (전체 고장)
      else color = '#f97316'; // 주황색 (모두 사용 중)
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">
        <circle cx="23" cy="23" r="19" fill="rgba(0,0,0,0.1)"/>
        <circle cx="23" cy="23" r="18" fill="white" stroke="rgba(0,0,0,0.05)" stroke-width="1"/>
        <circle cx="23" cy="23" r="15" fill="${color}"/>
        <text x="23" y="27" font-family="Pretendard, sans-serif" font-weight="900" font-size="12" fill="white" text-anchor="middle">
          ${available}<tspan font-size="8" font-weight="400" opacity="0.7">/${total}</tspan>
        </text>
      </svg>
    `.trim();

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, []);

  // 지도를 처음 띄울 때의 설정값과 마커들을 뭉쳐서 보여줄 클러스터러를 초기화합니다.
  useEffect(() => {
    if (!isReady || !container.current) return;

    if (!mapInstance.current) {
      const options = {
        center: new window.kakao.maps.LatLng(37.7853, 127.0457), // 초기 중심 좌표 (양주시 근처)
        level: 8,
        draggable: true,
        scrollwheel: true,
      };
      const map = new window.kakao.maps.Map(container.current, options);
      mapInstance.current = map;

      // 지도를 움직이거나 클릭했을 때의 이벤트를 등록합니다.
      window.kakao.maps.event.addListener(map, 'dragstart', () => setIsUserDragging(true));
      window.kakao.maps.event.addListener(map, 'dragend', () => setIsUserDragging(false));
      window.kakao.maps.event.addListener(map, 'click', () => {
        if (onMapClick) onMapClick();
      });

      // 마커가 너무 많으면 지저분하니까 클러스터링(뭉치기) 기능을 적용했어요.
      const clusterer = new window.kakao.maps.MarkerClusterer({
        map: map,
        averageCenter: true,
        minLevel: 2, 
        styles: [{
          width: '52px', height: '52px',
          background: 'rgba(37, 99, 235, 0.9)',
          color: '#fff',
          textAlign: 'center',
          lineHeight: '52px',
          borderRadius: '26px',
          fontWeight: '900',
          fontSize: '14px',
          boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
          border: '2px solid white',
          backdropFilter: 'blur(4px)'
        }]
      });
      clustererInstance.current = clusterer;

      // 외부(App.tsx 등)에서 특정 충전소 위치로 지도를 이동시키고 싶을 때 호출하는 브릿지 함수입니다.
      window.focusStationOnMap = (stationId: string) => {
        const target = useStationStore.getState().stations.find(s => s.station_id === stationId);
        if (target && mapInstance.current) {
          const lat = Number(target.latitude);
          const lng = Number(target.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            const pos = new window.kakao.maps.LatLng(lat, lng);
            mapInstance.current.setCenter(pos);
            mapInstance.current.setLevel(4);
          }
        }
      };

      // [UX 꿀팁] 사이드바가 열리거나 지도가 커질 때 레이아웃이 깨지지 않도록 강제로 크기를 다시 계산해주는 로직이에요.
      let animationFrame: number;
      let startTime: number;
      
      const syncMapSize = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = timestamp - startTime;
        
        if (mapInstance.current) {
          mapInstance.current.relayout();
          const center = mapInstance.current.getCenter();
          const nudge = (progress % 2 === 0) ? 0.000001 : -0.000001;
          mapInstance.current.setCenter(new window.kakao.maps.LatLng(center.getLat() + nudge, center.getLng()));
        }
        
        if (progress < 600) {
          animationFrame = requestAnimationFrame(syncMapSize);
        } else {
          startTime = 0;
          if (mapInstance.current) mapInstance.current.relayout();
        }
      };

      const resizeObserver = new ResizeObserver(() => {
        if (mapInstance.current) {
          cancelAnimationFrame(animationFrame);
          startTime = 0;
          animationFrame = requestAnimationFrame(syncMapSize);
        }
      });
      resizeObserver.observe(container.current);

      return () => {
        resizeObserver.disconnect();
        cancelAnimationFrame(animationFrame);
      };
    }
  }, [isReady, onMapClick]);

  // [핵심 성능 최적화] 마커 차분 업데이트 (Diffing) 로직입니다.
  // 모든 마커를 매번 새로 지우고 그리면 엄청 느려지거든요. 그래서 변경된 마커만 핀포인트로 수정합니다.
  useEffect(() => {
    if (!mapInstance.current || !clustererInstance.current || !isReady) return;
    
    // 유저가 지도를 드래그하고 있을 때는 마커를 안 바꾸는 게 훨씬 부드러워 보여요.
    if (isUserDragging && markersRef.current.size > 0) return;

    const clusterer = clustererInstance.current;
    const currentMarkersMap = markersRef.current;
    const nextStationIds = new Set(stations.map(s => s.station_id));

    // 4.1 필터링 결과에서 사라진 충전소 마커들을 지도에서 지워줍니다.
    const markersToRemove: any[] = [];
    for (const [id, state] of currentMarkersMap.entries()) {
      if (!nextStationIds.has(id)) {
        markersToRemove.push(state.marker);
        state.marker.setMap(null); 
        currentMarkersMap.delete(id);
      }
    }
    
    if (markersToRemove.length > 0) {
      clusterer.removeMarkers(markersToRemove);
    }

    // 4.2 [좌표 분산(Jittering)] 똑같은 주소에 충전소가 여러 개 있으면 마커가 겹쳐서 안 보이더라구요.
    // 꽃잎처럼 아주 살짝씩 빗겨나게 배치해서 모든 마커가 잘 보이도록 했습니다.
    const markersToAdd: any[] = [];
    const coordCounts = new Map<string, number>();

    stations.forEach(station => {
      const rawLat = Number(station.latitude);
      const rawLng = Number(station.longitude);
      
      if (isNaN(rawLat) || isNaN(rawLng)) return;

      const coordKey = `${rawLat.toFixed(6)},${rawLng.toFixed(6)}`;
      const samePosCount = coordCounts.get(coordKey) || 0;
      coordCounts.set(coordKey, samePosCount + 1);

      let finalLat = rawLat;
      let finalLng = rawLng;

      if (samePosCount > 0) {
        // 황금각(137.5도)을 활용해서 겹치는 마커들을 예쁘게 펴줍니다.
        const angle = (samePosCount * 137.5) * (Math.PI / 180);
        const radius = 0.00004 * Math.sqrt(samePosCount);
        finalLat += radius * Math.cos(angle);
        finalLng += radius * Math.sin(angle);
      }

      const available = getAvailableSlots(station);
      const total = station.chargers.length;
      const markerUri = createSvgMarkerUri(available, total, station.chargers);
      
      const existingState = currentMarkersMap.get(station.station_id);

      if (existingState) {
        // 이미 있는 마커라면, 이미지(색상/숫자)만 바뀌었을 때만 업데이트해줘요.
        if (existingState.uri !== markerUri) {
          const markerImage = new window.kakao.maps.MarkerImage(
            markerUri,
            new window.kakao.maps.Size(46, 46),
            { offset: new window.kakao.maps.Point(23, 23) }
          );
          existingState.marker.setImage(markerImage);
          existingState.uri = markerUri;
        }
        
        const newPos = new window.kakao.maps.LatLng(finalLat, finalLng);
        if (!existingState.marker.getPosition().equals(newPos)) {
          existingState.marker.setPosition(newPos);
        }

        if (existingState.marker.getMap() === null) {
          markersToAdd.push(existingState.marker);
        }
      } else {
        // 새로 등장한 충전소는 마커 객체를 새로 만들어서 Map에 저장합니다.
        const pos = new window.kakao.maps.LatLng(finalLat, finalLng);
        const markerImage = new window.kakao.maps.MarkerImage(
          markerUri,
          new window.kakao.maps.Size(46, 46),
          { offset: new window.kakao.maps.Point(23, 23) }
        );

        const marker = new window.kakao.maps.Marker({
          position: pos,
          image: markerImage,
          zIndex: 3
        });

        window.kakao.maps.event.addListener(marker, 'click', () => {
          onMarkerClick(station);
        });

        currentMarkersMap.set(station.station_id, { marker, uri: markerUri });
        markersToAdd.push(marker);
      }
    });

    if (markersToAdd.length > 0) {
      clusterer.addMarkers(markersToAdd);
    }

    if (markersToRemove.length > 0 || markersToAdd.length > 0) {
      if (clusterer.repaint) clusterer.repaint();
    }

  }, [stations, isReady, onMarkerClick, getAvailableSlots, createSvgMarkerUri, isUserDragging]);

  // 내 위치 표시(펄스 애니메이션)와 길찾기 경로(Polyline)를 그려주는 부분입니다.
  useEffect(() => {
    if (!isReady || !mapInstance.current) return;

    const map = mapInstance.current;

    // 5.1 내 위치 마커 그리기
    if (userLocation) {
      const pos = new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng);
      
      if (!userMarkerRef.current) {
        // 내 위치는 좀 더 눈에 띄게 파란색 원이 깜빡이는 효과를 줬어요.
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="#3b82f6" fill-opacity="0.2">
              <animate attributeName="r" from="8" to="16" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="fill-opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="18" cy="18" r="6" fill="#3b82f6" stroke="white" stroke-width="2" />
          </svg>
        `.trim();
        
        const markerImage = new window.kakao.maps.MarkerImage(
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
          new window.kakao.maps.Size(36, 36),
          { offset: new window.kakao.maps.Point(18, 18) }
        );

        const marker = new window.kakao.maps.Marker({
          position: pos,
          image: markerImage,
          zIndex: 10
        });
        marker.setMap(map);
        userMarkerRef.current = marker;
      } else {
        userMarkerRef.current.setPosition(pos);
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }

    // 5.2 카카오 길찾기 API에서 준 좌표들을 선(Polyline)으로 이어줍니다.
    if (routePath && routePath.length > 0) {
      const path = routePath.map(p => new window.kakao.maps.LatLng(p[1], p[0]));
      
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }

      const polyline = new window.kakao.maps.Polyline({
        path: path,
        strokeWeight: 6,
        strokeColor: '#6366f1',
        strokeOpacity: 0.9,
        strokeStyle: 'solid'
      });
      
      polyline.setMap(map);
      polylineRef.current = polyline;

      // 경로가 화면에 한눈에 들어오도록 지도의 줌 레벨과 중심을 자동으로 맞춰줍니다.
      const bounds = new window.kakao.maps.LatLngBounds();
      path.forEach(pos => bounds.extend(pos));
      map.setBounds(bounds, 80, 80, 80, 80); 
    } else if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

  }, [isReady, userLocation, routePath]);

  return (
    <div className="w-full h-full relative" style={{ minHeight: '300px' }}>
      <div 
        ref={container} 
        className="w-full h-full" 
        style={{ 
          width: '100%', 
          height: '100%', 
          background: '#f8fafc',
          willChange: 'transform',
          transform: 'translateZ(0)' 
        }} 
      />
      
      {/* 지도 로딩 중일 때 보여줄 예쁜 스켈레톤 UI입니다. */}
      {!isReady && (
        <div className="absolute inset-0 bg-gray-50 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Map Loading...</p>
          </div>
        </div>
      )}

      {/* 내 위치로 지도를 돌리는 Compass 버튼입니다. */}
      <button 
        onClick={handleMyLocation}
        className="absolute bottom-24 md:bottom-6 right-6 z-30 w-12 h-12 bg-white rounded-2xl shadow-xl border border-gray-100 flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-all active:scale-95"
        title="내 위치 찾기"
      >
        <Compass size={24} />
      </button>

      {/* 길찾기 정보(시간, 거리)를 보여주는 상단 바입니다. */}
      {routeSummary && (
        <div className="absolute bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-24px)] max-w-sm bg-gray-900/95 backdrop-blur-xl rounded-[24px] shadow-2xl border border-white/10 p-3 md:p-4 animate-in slide-in-from-bottom-5 duration-500 text-white">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
              <Navigation size={20} fill="currentColor" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">경로 안내</span>
                <span className="truncate text-[10px] font-bold text-gray-400">to {routeSummary.destinationName}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Clock size={12} className="text-blue-400" />
                  <span className="text-base font-black tracking-tight">{Math.round(routeSummary.duration / 60)}분</span>
                </div>
                <div className="w-1 h-1 bg-gray-700 rounded-full" />
                <div className="flex items-center gap-1">
                  <Flag size={12} className="text-emerald-400" />
                  <span className="text-base font-black tracking-tight">{(routeSummary.distance / 1000).toFixed(1)}km</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => {
                  const target = stations.find(s => s.station_name === routeSummary.destinationName);
                  if (target && onViewStationInfo) {
                    clearRoute();
                    onViewStationInfo(target.station_id);
                  }
                }}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all active:scale-90"
                title="상세 정보"
              >
                <Info size={18} />
              </button>
              <button 
                onClick={clearRoute}
                className="w-10 h-10 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl flex items-center justify-center transition-all active:scale-90"
                title="안내 종료"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
