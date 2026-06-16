import React, { useState } from 'react';
import { 
  Coins, ShieldCheck, 
  LogOut, Trash2, Clock, CheckCircle2, XCircle, Edit3, BellRing, Loader2, BellOff
} from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { usePushNotification } from '../../hooks/usePushNotification';
import { ReviewModal } from '../station/ReviewModal';
import type { Review } from '../../types';

interface MyPageProps {
  onClose: () => void;
}

// 마이페이지의 세 가지 탭(마일리지, 제보, 리뷰)을 정의합니다.
type TabType = 'MILEAGE' | 'REPORTS' | 'REVIEWS';

export const MyPage: React.FC<MyPageProps> = ({ onClose }) => {
  const { user, withdrawAccount, logout, isLoading, deleteReview } = useUserStore();
  const [activeTab, setActiveTab] = useState<TabType>('MILEAGE');
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const { subscribe, unsubscribe, isSubscribing, isPushEnabled } = usePushNotification();

  // [회원 탈퇴] 정말 아쉽지만 서비스를 떠나는 유저의 데이터를 정리합니다.
  const handleWithdrawal = async () => {
    if (window.confirm('정말로 탈퇴하시겠습니까? 모든 활동 내역과 마일리지가 영구 삭제됩니다.')) {
      const result = await withdrawAccount();
      if (result.success) {
        alert('그동안 VIUM을 이용해 주셔서 감사합니다.');
        onClose();
      } else {
        alert(result.error || '탈퇴 처리 중 오류가 발생했습니다.');
      }
    }
  };

  // [리뷰 삭제] 리뷰를 지우면 지급됐던 보상 포인트도 회수하는 정책을 세웠습니다.
  // 어뷰징을 막기 위해 서버와 클라이언트 모두에서 꼼꼼하게 처리해주고 있어요!
  const handleDeleteReview = async (reviewId: number) => {
    if (window.confirm('리뷰를 삭제하시겠습니까? 삭제 시 지급되었던 100P가 회수됩니다.')) {
      const result = await deleteReview(reviewId);
      if (result.success) {
        alert('리뷰가 삭제되었습니다.');
      } else {
        alert(result.error || '삭제 처리 중 오류가 발생했습니다.');
      }
    }
  };

  // 웹 푸시 알림 설정을 끄고 켜는 핸들러입니다.
  const handlePushToggle = async () => {
    if (isPushEnabled) {
      if (window.confirm('알림 구독을 해지하시겠습니까?')) {
        await unsubscribe();
      }
    } else {
      await subscribe();
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* 리뷰 수정 버튼을 누르면 나타나는 모달입니다. */}
      {editingReview && (
        <ReviewModal 
          station={{ station_id: editingReview.station_id, station_name: '내가 작성한 리뷰' } as any}
          editReview={editingReview}
          onClose={() => setEditingReview(null)}
        />
      )}

      {/* 모바일에서는 아래에서 위로 올라오는 바텀 시트 스타일로 디자인해봤어요. */}
      <div className="relative bg-white w-full max-w-4xl h-[100dvh] md:h-[85vh] rounded-t-[40px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0 md:zoom-in-95 duration-500">
        
        {/* 상단 프로필 영역: 내 닉네임과 레벨, 그리고 가장 중요한 마일리지/신뢰도를 보여줍니다. */}
        <div className="p-5 md:p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shrink-0">
          <div className="flex justify-between items-start mb-4 md:mb-6">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-white/20 rounded-2xl md:rounded-3xl backdrop-blur-md flex items-center justify-center text-2xl md:text-3xl font-black text-white/90">
                {user.nickname[0]}
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black">{user.nickname}님</h2>
                <p className="text-blue-100 text-[10px] md:text-sm font-medium opacity-80">{user.level}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-white/10 rounded-full transition-colors">
              <XCircle size={20} className="md:w-6 md:h-6" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="bg-white/10 rounded-xl md:rounded-2xl p-3 md:p-4 backdrop-blur-sm border border-white/10">
              <p className="text-blue-100 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-0.5 md:mb-1">Total Mileage</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl md:text-2xl font-black">{user.mileage_balance.toLocaleString()}</span>
                <span className="text-xs font-bold opacity-80">P</span>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl md:rounded-2xl p-3 md:p-4 backdrop-blur-sm border border-white/10">
              <p className="text-blue-100 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-0.5 md:mb-1">Trust Score</p>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-green-300 md:w-5 md:h-5" />
                <span className="text-xl md:text-2xl font-black">{user.trust_score || 100}</span>
                <span className="text-xs font-bold opacity-80">점</span>
              </div>
            </div>
          </div>
        </div>

        {/* 활동 내역 탭: 정보가 많아서 탭으로 분류해두는 게 깔끔하더라구요. */}
        <div className="flex border-b border-gray-100 bg-gray-50/50 px-4 shrink-0 overflow-x-auto no-scrollbar">
          {(['MILEAGE', 'REPORTS', 'REVIEWS'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 text-xs font-black transition-all border-b-2 ${
                activeTab === tab 
                  ? 'border-blue-600 text-blue-600 bg-white' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab === 'MILEAGE' && '마일리지 내역'}
              {tab === 'REPORTS' && `나의 제보 (${(user.reports || []).length})`}
              {tab === 'REVIEWS' && `나의 리뷰 (${(user.reviews || []).length})`}
            </button>
          ))}
        </div>

        {/* 탭별 상세 내용 렌더링 */}
        <div className="flex-1 overflow-y-auto p-5 md:p-8 no-scrollbar pb-32">
          {activeTab === 'MILEAGE' && (
            <div className="space-y-3 md:space-y-4">
              {/* 마일리지 로그: 언제 어떤 이유로 포인트가 오르내렸는지 투명하게 보여줍니다. */}
              {(user.mileage_logs || []).length > 0 ? user.mileage_logs.map((log) => (
                <div key={log.log_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl ${log.amount > 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                      <Coins size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{log.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-black ${log.amount > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString()} P
                  </span>
                </div>
              )) : (
                <div className="text-center py-20 text-gray-400 italic text-sm">마일리지 적립 내역이 없습니다.</div>
              )}
            </div>
          )}

          {activeTab === 'REPORTS' && (
            <div className="space-y-3 md:space-y-4">
              {/* 내 제보 현황: 내가 올린 고장 제보가 승인됐는지 반려됐는지 한눈에 파악해요. */}
              {(user.reports || []).length > 0 ? user.reports!.map((report) => (
                <div key={report.report_id} className="p-4 md:p-5 border border-gray-100 rounded-3xl bg-white shadow-sm flex items-start gap-4">
                  <div className={`mt-1 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 ${
                    report.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 
                    report.status === 'APPROVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {report.status === 'PENDING' ? <Clock size={16} /> : 
                     report.status === 'APPROVED' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-bold text-gray-900 truncate">충전기 {report.charger_id}</h4>
                      <span className="text-[10px] text-gray-400">{new Date(report.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[10px] text-blue-600 font-bold mb-1">{report.keyword}</p>
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">{report.content}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 text-gray-400 italic text-sm">신고한 제보 내역이 없습니다.</div>
              )}
            </div>
          )}

          {activeTab === 'REVIEWS' && (
            <div className="space-y-3 md:space-y-4">
              {/* 내 리뷰 관리: 내가 쓴 리뷰를 직접 수정하거나 삭제할 수 있는 관리 영역입니다. */}
              {(user.reviews || []).length > 0 ? user.reviews!.map((review) => (
                <div key={review.id} className="p-4 md:p-5 border border-gray-100 rounded-3xl bg-white shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={`text-[10px] ${i < review.rating ? 'fill-current font-black' : 'text-gray-200'}`}>★</span>
                        ))}
                      </div>
                      <span className="text-[9px] text-gray-400">{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditingReview(review)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all active:scale-90" title="수정"><Edit3 size={16} /></button>
                      <button onClick={() => handleDeleteReview(review.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all active:scale-90" title="삭제"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-700 mb-3 break-keep leading-relaxed">{review.content}</p>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${
                    review.status === 'VISIBLE' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {review.status === 'VISIBLE' ? '정상 노출 중' : '비공개 처리됨'}
                  </span>
                </div>
              )) : (
                <div className="text-center py-20 text-gray-400 italic text-sm">작성한 리뷰가 없습니다.</div>
              )}
            </div>
          )}
        </div>

        {/* 설정 및 하단 액션: 알림 설정, 로그아웃, 탈퇴 등 중요한 버튼들을 모아뒀습니다. */}
        <div className="p-5 pb-28 md:pb-6 bg-gray-50 border-t border-gray-100 flex flex-col gap-2 md:rounded-b-[40px] shrink-0">
          <div className="flex gap-2">
            <button onClick={handlePushToggle} disabled={isSubscribing} className={`flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black transition-all active:scale-95 ${isPushEnabled ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border border-gray-200 text-blue-600'}`}>
              {isSubscribing ? <Loader2 size={14} className="animate-spin" /> : (isPushEnabled ? <BellRing size={14} /> : <BellOff size={14} />)}
              {isPushEnabled ? '실시간 알림 ON' : '실시간 알림 OFF'}
            </button>
            <button onClick={() => { logout(); onClose(); }} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl text-[10px] font-black active:scale-95">
              <LogOut size={14} /> 로그아웃
            </button>
          </div>
          <button onClick={handleWithdrawal} disabled={isLoading} className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-500 rounded-2xl text-[10px] font-black active:scale-95 disabled:opacity-50">
            <Trash2 size={14} /> 회원 탈퇴
          </button>
        </div>

      </div>
    </div>
  );
};
