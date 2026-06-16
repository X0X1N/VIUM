import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, Clock, 
  MapPin, XCircle,
  Activity, X, Wrench, MessageSquare, EyeOff, RotateCcw,
  Image as ImageIcon, Video, VideoOff, User, Star
} from 'lucide-react';
import { useStationStore } from '../../store/stationStore';
import { useUserStore } from '../../store/userStore';
import { stationService } from '../../services/stationService';
import { useNotificationStore } from '../../store/notificationStore';
import type { Review } from '../../types';

// [환경 자동 감지] 로컬 개발 환경인지, 실제 배포된 서버인지 확인해서 이미지 주소를 맞춰줍니다.
// 이렇게 해두면 매번 주소를 안 바꿔도 돼서 정말 편해요!
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const SERVER_ROOT = isLocalhost ? 'http://localhost:8000' : 'https://vium-project.duckdns.org';

export const AdminDashboard: React.FC = () => {
  const { stations, fetchStations } = useStationStore();
  const { fetchUser } = useUserStore();
  const { addNotification } = useNotificationStore();
  
  const [reports, setReports] = useState<any[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  
  const [processingId, setProcessingId] = useState<number | string | null>(null);
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'MAINTENANCE' | 'REVIEWS' | 'CCTV_MONITOR'>('REPORTS');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // [CCTV 관제] 라즈베리파이에서 송출 중인 실시간 영상을 관리자 화면에서 확인할 수 있게 해줍니다.
  // 팀원들이 ngrok으로 뚫어준 주소를 활용해서 라이브로 관찰하고 있어요.
  const cameras = [
    { id: 1, label: "CAM-01", station_id: "3682", station_name: "양주시 신도8차 아파트 1호기", url: "https://vium-camera.ngrok.app/video/0" },
    { id: 2, label: "CAM-02", station_id: "3683", station_name: "양주시 신도8차 아파트 2호기", url: "https://vium-camera.ngrok.app/video/2" }
  ];
  
  const [selectedCamId, setSelectedCamId] = useState<number>(1);
  const [cctvKey, setCctvKey] = useState<number>(Date.now()); // 캐시 무효화로 항상 최신 화면을 보장해요!
  const [cameraStatus, setCameraStatus] = useState<Record<number, boolean>>({ 1: true, 2: true });

  const selectedCam = cameras.find(c => c.id === selectedCamId) || cameras[0];

  const setOnlineStatus = (id: number, status: boolean) => {
    setCameraStatus(prev => ({ ...prev, [id]: status }));
  };

  // 이미지 로딩에 실패했을 때 나타날 '예외 처리' 로직입니다.
  // 외부 서비스에 의존하지 않고 우리 프로젝트만의 깔끔한 대체 화면(Fallback)을 그려줍니다.
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.currentTarget;
    target.style.display = 'none'; // 깨진 이미지 아이콘은 숨기고
    
    const parent = target.parentElement;
    if (parent && !parent.querySelector('.image-fallback')) {
      const fallback = document.createElement('div');
      fallback.className = "image-fallback w-full h-full flex flex-col items-center justify-center bg-gray-100 rounded-2xl border border-gray-200 text-gray-400 gap-2 animate-in fade-in duration-300";
      fallback.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/><path d="m11 13 1.586-1.586a2 2 0 0 1 2.828 0L18 14"/></svg>
        <span class="text-[10px] font-black uppercase tracking-tighter">Image Not Found</span>
      `;
      parent.appendChild(fallback);
    }
  };

  // 관리자용 모든 데이터(제보, 리뷰 등)를 한꺼번에 서버에서 가져오는 함수입니다.
  const loadAdminData = async () => {
    try {
      const [reportsRes, reviewsRes] = await Promise.all([
        stationService.getReports(),
        stationService.getAllReviews()
      ]);
      
      if (reportsRes.success && reportsRes.data) setReports(reportsRes.data);
      if (reviewsRes.success && reviewsRes.data) setAllReviews(reviewsRes.data);
      
      await fetchStations();
      await fetchUser();
    } catch (error) {
      console.error('관리자 데이터 로드 실패:', error);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // [제보 처리] 사용자가 보낸 고장 제보를 승인하거나 반려합니다.
  // 승인 시 보상이 지급되고, 반려 시 신뢰도 점수가 깎이는 게 시스템의 핵심이에요!
  const handleProcessReport = async (reportId: number, status: 'APPROVED' | 'REJECTED') => {
    if (processingId) return;
    setProcessingId(reportId);
    try {
      const response = await stationService.updateReportStatus(reportId, status);
      if (response.success) {
        addNotification({
          role: 'USER',
          type: status === 'APPROVED' ? 'SUCCESS' : 'INFO',
          title: status === 'APPROVED' ? '제보 승인 완료! 🎉' : '제보 반려 안내 ℹ️',
          message: status === 'APPROVED' ? `제보가 승인되어 보상이 지급되었습니다.` : `제보가 반려되었습니다.`
        });
        await loadAdminData();
      }
    } catch (error) {
      console.error('제보 처리 중 오류 발생:', error);
    } finally {
      setProcessingId(null);
    }
  };

  // 점검 중이던 충전기의 수리가 끝나면 다시 '이용 가능' 상태로 복구시켜줍니다.
  const handleRepairComplete = async (chargerId: string) => {
    if (processingId) return;
    setProcessingId(chargerId);
    try {
      const response = await stationService.updateChargerStatus(chargerId, 'Available');
      if (response.success) {
        addNotification({
          role: 'ADMIN',
          type: 'SUCCESS',
          title: '점검 완료 및 서비스 재개 🛠️',
          message: `${chargerId}번 충전기가 정상 가동 상태로 변경되었습니다.`
        });
        await loadAdminData();
      }
    } catch (error) {
      console.error('수리 완료 처리 중 오류:', error);
    } finally {
      setProcessingId(null);
    }
  };

  // [리뷰 관리] 부적절한 리뷰를 숨기거나 다시 공개합니다. 
  // 클린한 서비스 환경을 위해 관리자가 꼭 필요한 기능이라 생각했습니다.
  const handleToggleReviewStatus = async (reviewId: number, currentStatus: string) => {
    const nextStatus = currentStatus === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE';
    const actionText = nextStatus === 'HIDDEN' ? '숨김 처리하고 패널티를 부여' : '다시 노출하고 점수를 복구';
    
    if (processingId || !window.confirm(`해당 리뷰를 ${actionText}하시겠습니까?`)) return;
    
    setProcessingId(`review_${reviewId}`);
    try {
      const response = await stationService.updateReviewStatus(reviewId, nextStatus);
      if (response.success) {
        addNotification({
          role: 'ADMIN',
          type: 'SUCCESS',
          title: nextStatus === 'HIDDEN' ? '리뷰 차단 완료 🛡️' : '리뷰 복구 완료 ✅',
          message: nextStatus === 'HIDDEN' ? '부적절한 리뷰가 가려졌습니다.' : '리뷰가 다시 유저들에게 공개되었습니다.'
        });
        await loadAdminData();
      }
    } catch (error) {
      console.error('리뷰 상태 변경 실패:', error);
    } finally {
      setProcessingId(null);
    }
  };

  // 렌더링에 필요한 각종 필터링 및 카운팅 데이터들입니다.
  const faultyChargersList = stations.flatMap(s => 
    s.chargers.filter(c => c.status === 'Faulty').map(c => ({ ...c, station_name: s.station_name }))
  );

  const totalFaulty = faultyChargersList.length;
  const pendingReports = reports.filter(r => r.status === 'PENDING').length;
  const visibleReviewsCount = allReviews.filter(r => r.status === 'VISIBLE').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* 고장 제보 시 찍은 사진을 크게 보여주는 모달입니다. */}
      {selectedImage && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in zoom-in duration-300" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
            <img 
              src={`${SERVER_ROOT}${selectedImage}`} 
              alt="Full Report Proof" 
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" 
              onError={handleImageError}
            />
            <button className="absolute -top-12 right-0 text-white flex items-center gap-2 font-black text-sm hover:text-red-400 transition-colors">
              <X size={24} /> 닫기
            </button>
          </div>
        </div>
      )}

      {/* 대시보드 상단의 핵심 지표 카드들 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4">
        {[
          { label: '전체 충전소', value: stations.length, icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '점검 중 충전기', value: totalFaulty, icon: Clock, color: 'text-red-600', bg: 'bg-red-50' },
          { label: '대기 중 제보', value: pendingReports, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: '정상 노출 리뷰', value: visibleReviewsCount, icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-3 md:p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
            <div className={`${stat.bg} ${stat.color} w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0`}><stat.icon size={16} className="md:w-5 md:h-5" /></div>
            <div className="min-w-0">
              <p className="text-gray-400 text-[8px] md:text-[10px] font-black uppercase truncate">{stat.label}</p>
              <p className="text-base md:text-xl font-black text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
        {/* 탭 네비게이션: 관제, 제보, 점검, 리뷰 중 원하는 항목을 골라볼 수 있습니다. */}
        <div className="p-2 bg-gray-50/50 flex gap-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('CCTV_MONITOR')} className={`shrink-0 px-6 py-4 rounded-[32px] text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'CCTV_MONITOR' ? 'bg-gray-900 shadow-md text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            <Video size={16} className={activeTab === 'CCTV_MONITOR' ? 'text-red-500 animate-pulse' : ''} />
            CCTV 실시간 관제
          </button>
          <button onClick={() => setActiveTab('REPORTS')} className={`shrink-0 px-6 py-4 rounded-[32px] text-sm font-black transition-all ${activeTab === 'REPORTS' ? 'bg-white shadow-md text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}>
            제보 승인 대기 ({pendingReports})
          </button>
          <button onClick={() => setActiveTab('MAINTENANCE')} className={`shrink-0 px-6 py-4 rounded-[32px] text-sm font-black transition-all ${activeTab === 'MAINTENANCE' ? 'bg-white shadow-md text-red-600' : 'text-gray-400 hover:bg-gray-100'}`}>
            고장 충전기 관리 ({totalFaulty})
          </button>
          <button onClick={() => setActiveTab('REVIEWS')} className={`shrink-0 px-6 py-4 rounded-[32px] text-sm font-black transition-all ${activeTab === 'REVIEWS' ? 'bg-white shadow-md text-purple-600' : 'text-gray-400 hover:bg-gray-100'}`}>
            리뷰 관제실 ({allReviews.length})
          </button>
        </div>

        {/* 탭별 실제 상세 내용 렌더링 영역 */}
        <div className="p-2 md:p-6 min-h-[400px]">
          {activeTab === 'CCTV_MONITOR' && (
            <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* CCTV 화면: 실시간 스트리밍 데이터를 스캔라인 효과와 함께 멋지게 보여줍니다. */}
              <div className="relative w-full max-w-5xl mx-auto aspect-video bg-gray-950 rounded-[48px] p-4 shadow-2xl ring-1 ring-white/10 group">
                <div className="relative w-full h-full rounded-[34px] overflow-hidden bg-black shadow-inner">
                  {cameraStatus[selectedCamId] !== false ? (
                    <img 
                      key={`${cctvKey}-${selectedCamId}`}
                      src={`${selectedCam.url}?t=${cctvKey}`} 
                      alt={selectedCam.label} 
                      onError={() => setOnlineStatus(selectedCamId, false)}
                      onLoad={() => setOnlineStatus(selectedCamId, true)}
                      className="w-full h-full object-cover animate-in fade-in duration-700"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-900/60 backdrop-blur-md">
                      <VideoOff size={64} className="mb-6 opacity-30 text-red-500" />
                      <p className="font-black text-2xl text-gray-200">연결 오프라인</p>
                      <button onClick={() => { setCctvKey(Date.now()); setOnlineStatus(selectedCamId, true); }} className="mt-10 px-10 py-4 bg-white/10 border border-white/10 rounded-2xl hover:bg-white/20 text-white text-sm font-black flex items-center gap-2 transition-all active:scale-95 shadow-2xl backdrop-blur-xl">
                        <RotateCcw size={18} /> 재연결 시도
                      </button>
                    </div>
                  )}

                  {/* LIVE 방송 배지 효과 */}
                  <div className="absolute top-4 left-4 md:top-8 md:left-8 bg-black/50 backdrop-blur-2xl px-3 py-1.5 md:px-5 md:py-2.5 rounded-full flex items-center gap-2 md:gap-3 border border-white/20 shadow-2xl">
                    <span className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${cameraStatus[selectedCamId] !== false ? 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]' : 'bg-gray-500'}`}></span>
                    <span className="text-white text-[8px] md:text-[11px] font-black tracking-widest uppercase">LIVE STREAMING</span>
                  </div>
                  
                  {/* 스캔라인 레이어 (분위기 담당!) */}
                  <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,3px_100%] opacity-30"></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'REPORTS' && (
            <div className="divide-y divide-gray-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* 제보 리스트: 사용자가 올린 증거 사진과 내용을 보고 판단합니다. */}
              {reports.map((report) => (
                <div key={report.report_id} className="p-6 hover:bg-gray-50 transition-colors flex items-start gap-4">
                  <div className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${report.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : report.status === 'APPROVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {report.status === 'PENDING' ? <Clock size={18} /> : report.status === 'APPROVED' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-gray-900 truncate">제보된 충전기: {report.charger_id}번</h4>
                      <span className="text-[10px] text-gray-400">{new Date(report.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{report.content}</p>
                    
                    {report.image_url && (
                      <div className="mb-4 relative w-32 h-32 group">
                        <img src={`${SERVER_ROOT}${report.image_url}`} alt="Proof" className="w-32 h-32 object-cover rounded-2xl border border-gray-100 cursor-pointer shadow-sm group-hover:scale-105 transition-transform" onClick={() => setSelectedImage(report.image_url)} onError={handleImageError} />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center pointer-events-none transition-opacity"><ImageIcon className="text-white" size={20} /></div>
                      </div>
                    )}

                    {report.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleProcessReport(report.report_id, 'APPROVED')} className="px-6 py-2 bg-green-600 text-white rounded-xl text-xs font-black shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all">승인 (+5점)</button>
                        <button onClick={() => handleProcessReport(report.report_id, 'REJECTED')} className="px-6 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 active:scale-95 transition-all">반려 (-5점)</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'MAINTENANCE' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* 고장 목록: 현재 고장 처리된 충전기들을 모아서 한꺼번에 보여줍니다. */}
              {faultyChargersList.map((charger) => (
                <div key={charger.charger_id} className="bg-red-50 border border-red-100 p-6 rounded-[32px] flex flex-col justify-between gap-4">
                  <div>
                    <div className="bg-red-100 text-red-600 w-10 h-10 rounded-xl flex items-center justify-center mb-3"><Wrench size={20} /></div>
                    <h4 className="font-black text-red-900">{charger.station_name}</h4>
                    <p className="text-xs font-bold text-red-600 mt-1">{charger.charger_id}번 기기 고장</p>
                  </div>
                  <button onClick={() => handleRepairComplete(charger.charger_id)} className="w-full bg-white text-red-600 py-3 rounded-2xl text-xs font-black shadow-sm border border-red-200 hover:bg-red-100 transition-all flex items-center justify-center gap-2 active:scale-95">
                    <CheckCircle2 size={14} /> 수리 완료 및 복구
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'REVIEWS' && (
            <div className="p-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* 리뷰 관리: 부적절한 언행이나 허위 사실이 담긴 리뷰를 걸러내는 곳입니다. */}
              {allReviews.map((review) => (
                <div key={review.id} className={`rounded-[32px] border p-6 flex flex-col md:flex-row gap-6 ${review.status === 'HIDDEN' ? 'bg-gray-50 border-gray-200 grayscale' : 'bg-white border-gray-100 shadow-sm'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-black text-blue-600">@{review.user_name}</span>
                      <span className="text-[10px] text-gray-400 font-bold">{new Date(review.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium leading-relaxed">{review.content}</p>
                  </div>
                  <div className="shrink-0 flex items-center">
                    <button onClick={() => handleToggleReviewStatus(review.id, review.status || "VISIBLE")} className={`px-5 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border active:scale-95 ${review.status === 'HIDDEN' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-red-500 border-red-100 hover:bg-red-50'}`}>
                      {review.status === 'HIDDEN' ? '다시 공개' : '차단하기'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
