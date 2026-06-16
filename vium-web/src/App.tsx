import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Maximize2, Minimize2, ArrowRight, Filter, SlidersHorizontal, X
} from 'lucide-react';

import { useStationStore } from './store/stationStore';
import { useUserStore } from './store/userStore';
import { useNotificationStore } from './store/notificationStore';
import { useMileage } from './hooks/useMileage';
import { usePushNotification } from './hooks/usePushNotification';

import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { StationCard } from './components/station/StationCard';
import { StationModal } from './components/station/StationModal';
import { StationMap } from './components/station/StationMap';
import { PillFilter } from './components/station/PillFilter';
import { ReportModal } from './components/station/ReportModal';
import { ReviewModal } from './components/station/ReviewModal';
import { AuthModal } from './components/layout/AuthModal';
import { MyPage } from './components/user/MyPage';
import { RewardToast } from './components/reward/RewardToast';
import { NotificationOverlay } from './components/reward/NotificationOverlay';
import { StationSummaryOverlay } from './components/station/StationSummaryOverlay';
import { ChargingFlowModal } from './components/station/ChargingFlowModal';
import { GuestChargePage } from './components/guest/GuestChargePage';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { PolicyModal } from './components/layout/PolicyModal';
import type { ChargingStation } from './types';

function App() {
  // 전역 상태들을 가져옵니다. Zustand를 써서 Props 지옥을 피하려고 노력했어요!
  const store = useStationStore();
  const { 
    stations, 
    fetchStations, 
    selectedStationId,
    setSelectedStationId,
    reportTargetId,
    setReportTargetId,
    summaryStationId,
    setSummaryStationId,
    routeSummary,
    isLoading: isStationsLoading
  } = store;

  const { 
    user, 
    isAuthenticated, 
    fetchUser, 
    pendingReviewStation,
    setPendingReview 
  } = useUserStore();

  const { addNotification } = useNotificationStore();
  const { rewardToast, triggerRewardAnimation } = useMileage();
  
  // 웹 푸시 권한을 요청하고 구독 정보를 관리하는 훅이에요.
  usePushNotification();

  // [알림 센터 브릿지] 서비스 워커(sw.js)에서 온 푸시 알림을 리액트 앱 안의 '알림 목록'에 넣어줍니다.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'PUSH_RECEIVED') {
          const { title, body, type, role, tag, session_id, user_id } = event.data.payload;
          
          const currentGuestOrderId = sessionStorage.getItem('vium_guest_active_order_id');
          
          // [개인정보 보호] 내 알림이 맞는지 꼼꼼하게 대조합니다. 남의 충전 소식이 내 폰에 뜨면 안 되니까요!
          const isMyUserNoti = user_id && user && Number(user_id) === Number(user.user_id);
          const isMyGuestNoti = session_id && currentGuestOrderId && session_id === currentGuestOrderId;

          if (isMyUserNoti || isMyGuestNoti) {
            console.log("📥 [App] Push message matched and added to store.");
            addNotification({
              id: tag, 
              role: role || 'USER',
              type: type || 'INFO',
              title: title || '⚡ VIUM 알림',
              message: body || '새로운 소식이 도착했습니다.'
            });
          } else {
            console.log("🛡️ [App] Push message ignored (Ownership mismatch).");
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, [addNotification, user, isAuthenticated]);

  // 앱이 켜지면 유저의 현재 위치를 파악해서 지도와 정렬에 반영합니다.
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          store.setUserLocation({ lat: latitude, lng: longitude });
        },
        (error) => {
          console.warn("Geolocation not available or denied:", error);
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // UI의 각종 모달과 상태들을 관리합니다.
  const [visibleCount, setVisibleCount] = useState(12);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMyPageOpen, setIsMyPageOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [chargingTargetId, setChargingTargetId] = useState<string | null>(null);
  const [chargingInitialStep, setChargingInitialStep] = useState<'CONNECTION_PROMPT' | 'CONFIRM_CHARGE' | 'BILLING'>('CONNECTION_PROMPT');
  const [guestChargerId, setGuestChargerId] = useState<string | null>(null);

  const mapSectionRef = useRef<HTMLDivElement>(null);
  const processedOrderIds = useRef<Set<string>>(new Set());

  // 현재 선택된 충전소 객체를 실시간으로 찾아옵니다. ID 기반 조회라 데이터가 항상 최신이에요.
  const selectedStation = useMemo(() => 
    selectedStationId ? stations.find(s => s.station_id === selectedStationId) : null
  , [selectedStationId, stations]);

  const reportTarget = useMemo(() => 
    reportTargetId ? stations.find(s => s.station_id === reportTargetId) : null
  , [reportTargetId, stations]);

  const summaryStation = useMemo(() => 
    summaryStationId ? stations.find(s => s.station_id === summaryStationId) : null
  , [summaryStationId, stations]);

  const filteredStations = useMemo(() => {
    return store.getFilteredStations() || [];
  }, [stations, store]);

  // URL 파라미터를 분석해서 비회원 QR 접속인지, 결제 성공 리다이렉트인지 판단합니다.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const guestId = params.get('guest_charger_id');
    if (guestId) setGuestChargerId(guestId);

    // 결제 성공 후 돌아왔다면, 하던 충전을 마저 계속할 수 있도록 모달을 다시 띄워줘요.
    if (params.get('payment_success') === 'true') {
      const lastStationId = sessionStorage.getItem('vium_last_charging_id');
      if (lastStationId) {
        setChargingTargetId(lastStationId);
        setChargingInitialStep('BILLING');
      }
    }
  }, []);

  const chargingTarget = useMemo(() => 
    chargingTargetId ? stations.find(s => s.station_id === chargingTargetId) : null
  , [chargingTargetId, stations]);

  // [데이터 실시간성] 3초마다 서버에서 최신 충전소 정보를 가져옵니다. 
  // 다른 사람이 충전을 시작하거나 고장이 나면 즉시 내 화면에 반영되어야 하니까요!
  useEffect(() => {
    fetchStations();
    if (isAuthenticated) fetchUser();
    const interval = setInterval(() => fetchStations(), 3000);
    return () => clearInterval(interval);
  }, [fetchStations, fetchUser, isAuthenticated]);

  // [매직 모먼트] 아두이노 센서 신호를 감지해서 자동으로 충전 화면을 띄워주는 로직입니다.
  // 사용자가 충전기를 꽂기만 해도 화면이 알아서 바뀌는 게 우리 프로젝트의 핵심 재미 요소예요!
  useEffect(() => {
    const currentGuestOrderId = sessionStorage.getItem('vium_guest_active_order_id');

    if (!chargingTargetId) {
      stations.forEach(station => {
        station.chargers.forEach(charger => {
          if (charger.status === 'Charging') {
            // 내가 주인이 맞는지 확인합니다 (로그인 유저 ID 또는 비회원 주문 번호 대조)
            const isMyUserCharge = isAuthenticated && user && charger.active_user_id && Number(charger.active_user_id) === Number(user.user_id);
            const isMyGuestCharge = !isAuthenticated && currentGuestOrderId && charger.active_session_id === currentGuestOrderId;

            if (isMyUserCharge || isMyGuestCharge) {
              const guardKey = charger.active_session_id || `pending-${charger.charger_id}`;
              
              // 팝업이 중복으로 여러 번 뜨지 않게 방어막을 쳐줍니다.
              if (!processedOrderIds.current.has(guardKey)) {
                processedOrderIds.current.add(guardKey);
                setChargingTargetId(station.station_id);
                // 이미 하드웨어에서 충전이 시작됐으니 안내 단계는 건너뛰고 바로 배터리 설정 단계로!
                setChargingInitialStep(charger.status === 'Charging' ? 'CONFIRM_CHARGE' : 'CONNECTION_PROMPT');
                console.log("⚡ [App] Mapping Detected. Triggering Modal (Fast-Track).");
              }
            }
          }
        });
      });
    }
  }, [stations, isAuthenticated, user, chargingTargetId]);

  const handleStationCardClick = useCallback((station: ChargingStation) => {
    setSelectedStationId(station.station_id);
  }, [setSelectedStationId]);

  const handleMarkerClick = useCallback((station: ChargingStation) => {
    setSummaryStationId(station.station_id);
  }, [setSummaryStationId]);

  const handleMapClick = useCallback(() => {
    setSummaryStationId(null);
  }, [setSummaryStationId]);

  // 리스트에서 '지도에서 보기'를 눌렀을 때 지도를 확장하고 해당 위치로 줌인하는 함수입니다.
  const handleShowOnMap = (id: string) => {
    setSelectedStationId(null);
    setSummaryStationId(id); 
    setIsMapExpanded(true);
    if (mapSectionRef.current) {
      mapSectionRef.current.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        if (window.focusStationOnMap) window.focusStationOnMap(id);
      }, 400); 
    }
  };

  // 지도 위(카카오 HTML)에서 리액트의 모달을 열고 싶을 때 사용하는 전역 브릿지 함수입니다.
  useEffect(() => {
    (window as any).openReportModal = (id: string) => setReportTargetId(id);
    (window as any).openAuthModal = () => setIsAuthModalOpen(true);
    return () => { 
      delete (window as any).openReportModal;
      delete (window as any).openAuthModal;
    };
  }, [setReportTargetId]);

  // 충전이 완전히 끝났을 때 마일리지를 정산하고 리뷰 작성을 유도하는 최종 마무리 단계예요.
  const handleChargingComplete = async (amount: number) => {
    const finishedStationId = chargingTargetId;
    if (!finishedStationId) return;
    const finishedStation = stations.find(s => s.station_id === finishedStationId);
    setChargingTargetId(null);
    setChargingInitialStep('CONNECTION_PROMPT');
    if (!isAuthenticated) return;
    
    // 서버에 정산 요청을 보냅니다.
    const success = await useUserStore.getState().completeCharging(finishedStationId, amount);
    if (success) {
      triggerRewardAnimation(amount); // 기분 좋게 포인트 팡팡 터지는 애니메이션!
      if (finishedStation) setPendingReview(finishedStation); // 나중에 리뷰 쓸 수 있게 배너 띄워주기
      fetchStations();
    }
  };

  // 나머지 렌더링 부분은 가독성을 위해 각 컴포넌트로 분리하고 Props를 통해 상태를 공유합니다.
  const pagedStations = useMemo(() => {
    return filteredStations.slice(0, visibleCount);
  }, [filteredStations, visibleCount]);

  const hasMore = filteredStations.length > visibleCount;

  // 관리자 모드 보안 강화: 관리자 권한이 없으면 대시보드에서 자동으로 쫓아냅니다.
  useEffect(() => {
    if (isAdminMode && (!user || !user.is_admin)) {
      setIsAdminMode(false);
    }
  }, [isAdminMode, user]);

  const handleNavClick = useCallback((action: () => void) => {
    setSelectedStationId(null);
    setSummaryStationId(null);
    setReportTargetId(null);
    setIsMyPageOpen(false);
    setIsPolicyModalOpen(false);
    setIsFilterSheetOpen(false);
    action();
  }, [setSelectedStationId, setSummaryStationId, setReportTargetId]);

  return (
    <div className="flex flex-col min-h-[100dvh] bg-gray-50 text-gray-900 font-sans">
      {/* 알림 및 보상 토스트 오버레이 */}
      <RewardToast show={rewardToast.show} amount={rewardToast.amount} />
      <NotificationOverlay isAdminMode={isAdminMode} />
      
      {/* 팝업 모달들 */}
      {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} />}
      {isMyPageOpen && <MyPage onClose={() => setIsMyPageOpen(false)} />}
      {isPolicyModalOpen && <PolicyModal onClose={() => setIsPolicyModalOpen(false)} />}
      
      {/* 모바일용 바텀 시트 필터 */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 animate-in fade-in duration-300 md:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsFilterSheetOpen(false)}></div>
          <div className="relative bg-white w-full rounded-t-[40px] shadow-2xl p-8 animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-gray-900">검색 및 필터</h3>
              <button onClick={() => setIsFilterSheetOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-400"><X size={18} /></button>
            </div>
            <PillFilter />
            <button 
              onClick={() => setIsFilterSheetOpen(false)}
              className="w-full bg-blue-600 text-white py-4 rounded-3xl font-black mt-8 shadow-xl shadow-blue-100 active:scale-95 transition-all"
            >
              필터 적용하기
            </button>
          </div>
        </div>
      )}

      {/* [비회원 QR 모드]와 [일반 서비스 모드]를 분기해서 렌더링합니다. */}
      {guestChargerId ? (
        <GuestChargePage chargerId={guestChargerId} />
      ) : (
        <>
          {/* 메인 충전소 상세 정보 모달 */}
          {selectedStation && (
            <StationModal 
              station={selectedStation} 
              onClose={() => setSelectedStationId(null)} 
              onShowOnMap={() => handleShowOnMap(selectedStation.station_id)}
              onReport={() => setReportTargetId(selectedStation.station_id)}
            />
          )}
          {reportTarget && <ReportModal station={reportTarget} onClose={() => setReportTargetId(null)} />}
          
          {/* 실시간 충전 시퀀스 모달 (가장 복잡하고 중요한 녀석!) */}
          {chargingTarget && (
            <ChargingFlowModal 
              station={chargingTarget} 
              onClose={() => { setChargingTargetId(null); setChargingInitialStep('CONNECTION_PROMPT'); }} 
              onComplete={handleChargingComplete} 
              initialStep={chargingInitialStep} 
            />
          )}

          {/* 충전 직후 '나중에 쓰기' 버튼을 눌렀던 리뷰 퀘스트 모달 */}
          {isReviewModalOpen && pendingReviewStation && (
            <ReviewModal 
              station={pendingReviewStation} 
              onClose={() => { setIsReviewModalOpen(false); setPendingReview(null); }} 
            />
          )}
          
          <Header 
            isAdmin={isAdminMode} 
            onToggleAdmin={() => handleNavClick(() => setIsAdminMode(!isAdminMode))} 
            onOpenAuth={() => setIsAuthModalOpen(true)} 
            onOpenMyPage={() => handleNavClick(() => setIsMyPageOpen(true))} 
            onOpenPolicy={() => handleNavClick(() => setIsPolicyModalOpen(true))}
          />
          
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 md:py-10">
            {isAdminMode && user?.is_admin ? <AdminDashboard /> : (
              <div className="flex flex-col gap-8">
                {/* 지도 및 검색 결과 리스트 레이아웃 */}
                <div className="space-y-6">
                  {/* 반응형 지도 컨테이너 */}
                  <div ref={mapSectionRef} className={`bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden relative z-0 transition-all duration-500 ${isMapExpanded ? 'h-[600px]' : 'h-64 md:h-80'}`}>
                    <div className="absolute inset-0 z-0">
                      <StationMap 
                        stations={filteredStations} 
                        onMarkerClick={handleMarkerClick} 
                        onMapClick={handleMapClick} 
                        onViewStationInfo={(id) => setSummaryStationId(id)}
                        isLoading={isStationsLoading} 
                      />
                    </div>
                    
                    {/* 마커 클릭 시 나타나는 간단 정보 오버레이 */}
                    {summaryStation && !routeSummary && (
                      <StationSummaryOverlay 
                        station={summaryStation} 
                        onClose={() => setSummaryStationId(null)} 
                        onViewDetail={() => { setSummaryStationId(null); setSelectedStationId(summaryStation.station_id); }} 
                      />
                    )}
                    
                    {/* 지도 컨트롤 버튼들 */}
                    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                      <button onClick={() => setIsMapExpanded(!isMapExpanded)} className="bg-white/95 backdrop-blur shadow-2xl border border-gray-200 p-3 rounded-2xl text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        {isMapExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                      </button>
                    </div>

                    {/* 로그인 유도 및 리뷰 퀘스트 플로팅 배너 */}
                    {!isAuthenticated && !routeSummary && !summaryStation && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[calc(100%-120px)] sm:max-w-xs px-4 z-10">
                        <button onClick={() => setIsAuthModalOpen(true)} className="bg-gray-900/90 backdrop-blur-xl text-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 shadow-2xl w-full flex items-center justify-between group hover:bg-black transition-all">
                          <div className="text-left">
                            <p className="font-black text-xs sm:text-sm">지금 가입하고 혜택 받기 🎉</p>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 sm:mt-1 font-bold">1,000P 및 실시간 연동</p>
                          </div>
                          <div className="bg-blue-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl group-hover:scale-110 transition-transform">
                            <ArrowRight size={16} className="sm:w-5 sm:h-5" />
                          </div>
                        </button>
                      </div>
                    )}
                    {isAuthenticated && pendingReviewStation && !routeSummary && !summaryStation && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[calc(100%-120px)] sm:max-w-xs px-4 z-10 md:bottom-auto md:top-24 md:right-4 md:left-auto md:translate-x-0">
                        <button onClick={() => setIsReviewModalOpen(true)} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-[24px] sm:rounded-[32px] p-4 sm:p-6 shadow-2xl w-full flex items-center justify-between group transition-all">
                          <div className="text-left">
                            <p className="font-black text-xs sm:text-sm italic">리뷰 퀘스트 진행 중 🎁</p>
                            <p className="text-[9px] sm:text-[10px] text-white/70 mt-0.5 sm:mt-1 font-bold">리뷰 남기고 보너스 받기</p>
                          </div>
                          <div className="bg-white/20 p-2 sm:p-3 rounded-xl sm:rounded-2xl">
                            <ArrowRight size={16} className="sm:w-5 sm:h-5" />
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 충전소 탐색 및 필터링 영역 */}
                  <div className="space-y-6">
                    <div className="hidden md:flex flex-col items-start gap-6 px-8 py-8 bg-white rounded-[32px] border border-gray-100 shadow-sm">
                      <div><h3 className="text-2xl font-black text-gray-900 tracking-tight">충전소 탐색</h3><p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Yangju Network ({filteredStations.length})</p></div>
                      <div className="w-full"><PillFilter /></div>
                    </div>
                    
                    {/* 하단 충전소 카드 리스트 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20 md:pb-0">{pagedStations.map((station) => (<StationCard key={station.station_id} station={station} onClick={handleStationCardClick} />))}</div>
                    {hasMore && (<div className="flex justify-center pt-4 pb-24 md:pb-10"><button onClick={() => setVisibleCount(prev => prev + 12)} className="bg-white border-2 border-gray-100 px-8 py-4 rounded-3xl text-sm font-black text-gray-600 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">더보기</button></div>)}
                  </div>
                </div>
              </div>
            )}
          </main>
        </>
      )}
      
      {/* 모바일 전용 하단 네비게이션 */}
      {!guestChargerId && (
        <MobileNav 
          onOpenMyPage={() => handleNavClick(() => setIsMyPageOpen(true))} 
          onOpenPolicy={() => handleNavClick(() => setIsPolicyModalOpen(true))}
          isAdminMode={isAdminMode}
          onToggleAdmin={() => handleNavClick(() => setIsAdminMode(!isAdminMode))}
          onStationClick={() => handleNavClick(() => setIsAdminMode(false))}
        />
      )}
    </div>
  );
}

export default App;
