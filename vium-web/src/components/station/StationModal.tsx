import React, { useMemo } from 'react';
import { 
  X, MapPin, Zap, ShieldAlert, Navigation, Star, TrendingUp, 
  MessageSquare, Car, Activity, Power, Wrench
} from 'lucide-react';
import type { ChargingStation, StationStatus } from '../../types';
import { useStationStore } from '../../store/stationStore';
import { useUserStore } from '../../store/userStore';
import { apiClient } from '../../services/apiClient';
import { getConnectorName } from '../../types/constants';

interface StationModalProps {
  station: ChargingStation | null;
  onClose: () => void;
  onShowOnMap: () => void; 
  onReport?: () => void; 
}

// 충전기를 마지막으로 쓴 게 언제인지 알려주는 함수입니다.
// '10분 전', '방금 전' 처럼 친근하게 표시해야 유저들이 안심하고 방문할 것 같아서 만들었어요!
const formatRelativeTime = (dateString?: string) => {
  if (!dateString) return "점검 완료";
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "방금 전";
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}시간 전`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}일 전`;
};

export const StationModal: React.FC<StationModalProps> = ({ station, onClose, onShowOnMap, onReport }) => {
  if (!station) return null;

  const { isAuthenticated } = useUserStore();

  const { 
    getAvailableSlots, 
    userLocation, 
    fetchRoute, 
    routeSummary, 
    clearRoute,
    setUserLocation, 
    isLoading: isRouteLoading 
  } = useStationStore();

  // [시연용 비밀 트리거] 하드웨어가 "누가 꽂았는지" 자동으로 알아채기 전에, 
  // 앱에서 미리 이 충전기를 내가 쓸 거라고 서버에 살짝 알려주는 단계입니다. 
  // 실제 서비스라면 PnC(Plug & Charge) 같은 복잡한 보안 로직이 들어갈 부분이에요!
  const handleHiddenClaim = async (chargerId: string) => {
    try {
      await apiClient.post(`/hardware/claim?charger_id=${chargerId}`, {});
      console.log("🤫 [Secret Claim Initiated]", chargerId);
    } catch (e) {
      // 시연용이므로 에러가 나도 조용히 넘어갑니다.
    }
  };

  const availableSlots = getAvailableSlots(station);
  const totalSlots = station.chargers.length;

  // [하버사인 공식 적용] 지도 앱처럼 내 위치와 충전소 사이의 직선 거리를 계산해줍니다.
  // 위경도 좌표로 거리를 구하는 게 생각보다 까다로웠지만, 정확한 정보를 위해 꼭 넣고 싶었던 로직이에요.
  const calculatedDistance = useMemo(() => {
    if (!userLocation || !station.latitude || !station.longitude) return null;
    
    const lat1 = userLocation.lat;
    const lon1 = userLocation.lng;
    const lat2 = Number(station.latitude);
    const lon2 = Number(station.longitude);
    
    const R = 6371; // 지구 반지름 (km)
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; 
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  }, [userLocation, station.latitude, station.longitude]);

  // 카카오 모빌리티 API를 써서 실제 도로 기반의 경로를 찾아주는 함수입니다.
  const handleGetDirections = () => {
    if (!navigator.geolocation) {
      alert("이 브라우저에서는 GPS를 지원하지 않습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const origin = { lat: latitude, lng: longitude };
        
        setUserLocation(origin);
        // 백엔드 프록시 서버를 통해 안전하게 카카오 API 정보를 가져옵니다.
        await fetchRoute(
          origin, 
          { lat: Number(station.latitude), lng: Number(station.longitude) },
          station.station_name
        );
        
        onShowOnMap(); // 경로가 생기면 지도로 화면을 전환!
        onClose();
      },
      (error) => {
        console.error("Geolocation Error:", error);
        alert("위치 정보를 가져오는데 실패했습니다. 권한 설정을 확인해주세요.");
      },
      { enableHighAccuracy: true }
    );
  };

  const handleClose = () => {
    clearRoute();
    onClose();
  };

  // [요금 리얼리즘] 한전 API에서 실시간 요금 추이를 안 줘서, 직접 24시간 부하 모델링을 했어요!
  // 밤에는 싸고, 낮 피크 시간에는 비싼 실제 전기 요금 체계를 흉내 내서 그래프를 그립니다.
  const displayPriceHistory = useMemo(() => {
    let history = station.priceHistory;
    if (typeof history === 'string') {
      try { history = JSON.parse(history); } catch (e) { history = []; }
    }
    if (!Array.isArray(history) || history.length < 24) {
      const base = station.price || 340;
      return Array.from({ length: 24 }, (_, i) => {
        if (i >= 23 || i <= 7) return base - 70; // 심야 (저렴!)
        if ((i >= 11 && i <= 13) || (i >= 18 && i <= 20)) return base + 60; // 피크 타임 (비쌈 ㅠㅠ)
        return base + (i % 2 === 0 ? 5 : -5); // 평시
      });
    }
    return history;
  }, [station.priceHistory, station.price]);

  const minPrice = Math.min(...displayPriceHistory);
  const maxPrice = Math.max(...displayPriceHistory);
  const priceRange = (maxPrice - minPrice) || 100;

  // 리뷰도 최신순으로 정렬해서 보여줘야 유저들이 가장 따끈따끈한 정보를 보겠죠?
  const sortedReviews = useMemo(() => {
    if (!station.reviews) return [];
    return [...station.reviews]
      .filter(review => review.status === 'VISIBLE')
      .sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }, [station.reviews]);

  const avgRating = useMemo(() => {
    if (sortedReviews.length === 0) return "0.0";
    const total = sortedReviews.reduce((acc, r) => acc + r.rating, 0);
    return (total / sortedReviews.length).toFixed(1);
  }, [sortedReviews]);

  // 하드웨어 신호에 따라 충전기의 4가지 상태를 정의했습니다.
  const statusConfig: Record<StationStatus, { label: string, color: string, bg: string, icon: any, anim?: string }> = {
    'Available': { label: '사용 가능', color: 'text-green-600', bg: 'bg-green-50', icon: Power },
    'Occupied': { label: '주차 중 (비충전)', color: 'text-orange-500', bg: 'bg-orange-50', icon: Car },
    'Charging': { label: '충전 중', color: 'text-blue-600', bg: 'bg-blue-50', icon: Zap, anim: 'animate-pulse' },
    'Faulty': { label: '점검 중', color: 'text-red-600', bg: 'bg-red-50', icon: Wrench }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      {/* 바텀 시트 스타일의 상세 정보 모달 */}
      <div className="bg-white w-full max-w-lg h-[100dvh] lg:h-auto lg:max-h-[95vh] rounded-t-[40px] lg:rounded-[40px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 lg:slide-in-from-bottom-0 lg:zoom-in-95 duration-500 flex flex-col">
        
        {/* 상단 헤더: 그라데이션을 줘서 고급스럽게 뽑아봤어요. */}
        <div className="relative min-h-[140px] lg:min-h-[160px] bg-gradient-to-br from-blue-600 to-indigo-700 p-6 lg:p-8 flex flex-col justify-end shrink-0">
          <button onClick={handleClose} className="absolute top-4 right-4 lg:top-6 lg:right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all z-10"><X size={20} /></button>
          <div className="space-y-2 pr-10">
            <h2 className="text-xl lg:text-2xl font-black text-white leading-tight break-keep">{station.station_name}</h2>
            <p className="text-blue-100/80 text-[10px] lg:text-xs flex items-start gap-1.5 leading-relaxed">
              <MapPin size={14} className="shrink-0 mt-0.5" /> 
              <span>{station.address}</span>
            </p>
          </div>
        </div>

        {/* 메인 콘텐츠 영역: 스크롤이 가능하게 설정했습니다. */}
        <div className="p-6 space-y-6 overflow-y-auto no-scrollbar flex-1 pb-32 lg:pb-8">
          {/* 핵심 요약 지표 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100 flex flex-col items-center">
              <Zap className="text-blue-600 mb-1" size={18} />
              <p className="text-[9px] font-bold text-blue-400 uppercase">잔여석</p>
              <p className="text-sm font-black text-blue-700">{availableSlots}/{totalSlots}</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-2xl border border-orange-100 flex flex-col items-center">
              <Star className="text-orange-500 mb-1" size={18} fill="currentColor" />
              <p className="text-[9px] font-bold text-orange-400 uppercase">평점</p>
              <p className="text-sm font-black text-orange-700">{avgRating}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-2xl border border-green-100 flex flex-col items-center">
              <Navigation className="text-green-600 mb-1" size={18} />
              <p className="text-[9px] font-bold text-green-400 uppercase">거리</p>
              <p className="text-sm font-black text-green-700">{calculatedDistance || station.distance || '-'}</p>
            </div>
          </div>

          {/* 충전기별 실시간 개별 상태 카드 */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 px-1">
              <Activity size={16} className="text-blue-500" /> 실시간 충전기 현황
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {station.chargers.map((c) => {
                const config = statusConfig[c.status as StationStatus] || statusConfig['Faulty'];
                const StatusIcon = config.icon;
                
                return (
                  <div 
                    key={c.charger_id} 
                    onClick={() => handleHiddenClaim(c.charger_id)}
                    className={`p-4 rounded-[24px] border transition-all ${config.bg} ${c.status === 'Available' ? 'border-green-100 shadow-sm' : 'border-transparent opacity-80'}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-0.5">CHARGER ID</span>
                        <span className="text-xs font-black text-gray-900">{c.charger_id.split('_').pop()}호기</span>
                      </div>
                      <div className={`${config.color} ${config.anim}`}>
                        <StatusIcon size={20} />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-500">{c.charger_type} • {getConnectorName(c.connector_type)}</p>
                      <div className="flex justify-between items-center">
                        <p className={`text-xs font-black ${config.color}`}>{config.label}</p>
                        {c.last_used_at && (
                          <span className="text-[9px] font-bold text-gray-400 px-1.5 py-0.5 bg-gray-100/50 rounded-md">
                            최근: {formatRelativeTime(c.last_used_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 요금 추이 그래프: 막대 그래프 형식으로 시각화했습니다. */}
          <div className="space-y-4 bg-gray-50 p-5 rounded-[32px] border border-gray-100">
            <div className="flex justify-between items-end">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2"><TrendingUp size={16} className="text-blue-500" /> 24시간 요금 추이</h3>
              <p className="text-lg font-black text-blue-600">{station.price}원<span className="text-[10px] font-normal text-gray-400 ml-1">/kWh</span></p>
            </div>
            
            <div className="h-28 flex items-end justify-between gap-[2px] px-1 pt-2">
              {displayPriceHistory.map((p, i) => {
                const rawHeight = ((p - minPrice) / priceRange) * 100;
                const heightValue = Math.max(Math.floor(rawHeight), 8); 
                const isCurrentHour = i === new Date().getHours();
                
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    <div 
                      style={{ 
                        height: `${heightValue}%`,
                        backgroundColor: isCurrentHour ? '#2563eb' : '#bfdbfe',
                        width: '100%',
                        minWidth: '4px'
                      }} 
                      className={`rounded-t-sm transition-all duration-500 ${isCurrentHour ? 'shadow-[0_-2px_8px_rgba(37,99,235,0.4)]' : 'hover:bg-blue-300'}`}
                    ></div>
                    {[0, 6, 12, 18, 23].includes(i) && (
                      <span className="absolute -bottom-5 text-[9px] font-black text-gray-400">
                        {i.toString().padStart(2, '0')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="h-2"></div>
          </div>

          {/* 리뷰 목록: 실제 유저들이 남긴 소중한 후기들입니다. */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 px-1">
              <MessageSquare size={16} className="text-blue-500" /> 커뮤니티 리뷰 ({sortedReviews.length})
            </h3>
            
            <div className="space-y-3">
              {sortedReviews.length > 0 ? (
                sortedReviews.map((review, idx) => (
                  <div key={idx} className="bg-gray-50 p-5 rounded-[28px] border border-gray-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star 
                              key={i} 
                              size={10} 
                              className={i < review.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} 
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-black text-gray-400 tracking-tighter italic">@{review.user_name || '익명회원'}</span>
                      </div>
                      <span className="text-[9px] font-bold text-gray-300">{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs font-bold text-gray-700 leading-relaxed break-keep">{review.content}</p>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-100">
                  <p className="text-xs font-bold text-gray-400">아직 작성된 리뷰가 없습니다.</p>
                  <p className="text-[10px] text-gray-300 mt-1">첫 번째 생생한 리뷰를 남겨보세요!</p>
                </div>
              )}
            </div>
          </div>

          {/* 하단 플로팅 액션 버튼바 */}
          <div className="flex gap-2 pt-2">
            <button 
              onClick={onShowOnMap}
              className="flex-1 bg-blue-50 border-2 border-blue-100 text-blue-600 py-4 rounded-2xl text-[11px] font-black flex flex-col items-center justify-center gap-1 hover:bg-blue-100 transition-all"
            >
              <MapPin size={16} /> 위치확인
            </button>

            <button 
              onClick={handleGetDirections}
              disabled={isRouteLoading}
              className={`flex-[2] ${routeSummary ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-indigo-100 text-indigo-600'} border-2 py-4 rounded-2xl text-[11px] font-black flex flex-col items-center justify-center gap-1 hover:opacity-90 transition-all disabled:opacity-50`}
            >
              {isRouteLoading ? (
                <div className="w-4 h-4 border-2 border-indigo-200 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Navigation size={16} /> {routeSummary ? '경로 재탐색' : '길찾기 시작'}
                </>
              )}
            </button>

            {/* 고장 제보 버튼: 비로그인 상태면 로그인 창을 띄워줍니다. */}
            <button 
              onClick={() => {
                if (!isAuthenticated) {
                  if ((window as any).openAuthModal) {
                    (window as any).openAuthModal();
                  }
                  return;
                }
                if (onReport) {
                  onReport();
                } else if ((window as any).openReportModal) {
                  (window as any).openReportModal(station.station_id);
                }
              }} 
              className="flex-1 bg-white border-2 border-red-100 text-red-500 py-4 rounded-2xl text-[11px] font-black flex flex-col items-center justify-center gap-1 hover:bg-red-50 transition-all"
            >
              <ShieldAlert size={16} /> 제보
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
