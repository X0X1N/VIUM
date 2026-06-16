import React, { useState, useEffect } from 'react';
import { Star, X, CheckCircle2, Loader2, Send } from 'lucide-react';
import type { ChargingStation, Review } from '../../types';
import { useStationStore } from '../../store/stationStore';
import { useUserStore } from '../../store/userStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useMileage } from '../../hooks/useMileage';
import { stationService } from '../../services/stationService';

interface ReviewModalProps {
  station: ChargingStation | null;
  editReview?: Review | null; // [수정 모드 지원] 마이페이지에서 리뷰를 수정할 때도 이 컴포넌트를 재사용합니다.
  onClose: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ station, editReview, onClose }) => {
  const { fetchStations } = useStationStore();
  const { fetchUser, updateReview: updateReviewAction } = useUserStore();
  const { addNotification } = useNotificationStore();
  const { triggerRewardAnimation } = useMileage();
  
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 현재 이 모달이 '신규 등록'인지 '기존 수정'인지 판별하는 플래그예요.
  const isEditMode = !!editReview;

  // 수정 모드일 경우, 유저가 썼던 기존 데이터를 불러와서 폼을 채워줍니다.
  useEffect(() => {
    if (editReview) {
      setRating(editReview.rating);
      setContent(editReview.content);
    }
  }, [editReview]);

  if (!station) return null;

  // 최소 5자 이상은 써야 등록이 가능하게끔 간단한 유효성 검사를 넣었습니다.
  const isValid = content.trim().length >= 5;

  const handleSubmit = async () => {
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (isEditMode && editReview) {
        // --- 1. 리뷰 수정 분기 ---
        const response = await updateReviewAction(editReview.id, rating, content.trim());
        if (response.success) {
          addNotification({
            role: 'USER',
            type: 'SUCCESS',
            title: '리뷰 수정 완료 ✨',
            message: '리뷰가 성공적으로 업데이트되었습니다.'
          });
          onClose();
        } else {
          alert(response.error || '리뷰 수정 중 오류가 발생했습니다.');
        }
      } else {
        // --- 2. 신규 리뷰 등록 분기 ---
        const response = await stationService.submitReview(station.station_id, {
          rating,
          content: content.trim()
        } as any);

        if (response.success) {
          // 데이터가 바뀌었으니 내 정보와 지도 정보를 실시간으로 다시 불러옵니다.
          await Promise.all([fetchUser(), fetchStations()]);
          
          // 포인트 적립 애니메이션과 알림을 동시에 띄워 성취감을 줍니다!
          triggerRewardAnimation(100);
          addNotification({
            role: 'USER',
            type: 'SUCCESS',
            title: '리뷰 보너스 적립! 🎁',
            message: '소중한 리뷰 감사합니다. 100P가 적립되었습니다.'
          });

          setIsSubmitted(true);
          setTimeout(() => { 
            setIsSubmitted(false); 
            onClose(); 
            setContent('');
            setRating(5);
          }, 2000);
        } else {
          alert('리뷰 등록 중 오류가 발생했습니다.');
        }
      }
    } catch (error) {
      console.error('리뷰 처리 실패:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500 max-h-[90vh] flex flex-col">
        
        {!isSubmitted ? (
          <>
            <div className="flex justify-between items-start px-8 pt-8 pb-6">
              <div>
                <h3 className="text-xl font-black text-gray-900">
                  {isEditMode ? '나의 리뷰 수정' : '현장 리뷰 남기기'}
                </h3>
                <p className="text-gray-400 text-xs mt-1">{station.station_name}</p>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 text-gray-300 hover:text-gray-500 transition-colors"
                disabled={isSubmitting}
              ><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 space-y-6 no-scrollbar">
              {/* 별점 선택 UI: 직관적으로 터치해서 바꿀 수 있게 만들었어요. */}
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    onClick={() => !isSubmitting && setRating(star)} 
                    className="transition-transform active:scale-90"
                    disabled={isSubmitting}
                  >
                    <Star 
                      size={40} 
                      className={star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-200'} 
                    />
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="예: 주차가 편해요, 주변에 카페가 있어요 등"
                  disabled={isSubmitting}
                  className="w-full h-40 bg-gray-50 border border-gray-100 rounded-[32px] p-6 text-base font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none disabled:opacity-50"
                ></textarea>
              </div>
            </div>

            <div className="p-8 bg-gray-50/50 border-t border-gray-50">
              <button 
                disabled={!isValid || isSubmitting}
                onClick={handleSubmit}
                className={`w-full ${isEditMode ? 'bg-indigo-600 shadow-indigo-100' : 'bg-blue-600 shadow-blue-100'} disabled:bg-gray-200 text-white py-5 rounded-3xl text-lg font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95`}
              >
                {isSubmitting ? (
                  <><Loader2 size={20} className="animate-spin" /> {isEditMode ? '수정 내용 저장 중' : '리뷰 등록 중'}</>
                ) : (
                  <>{isEditMode ? <Send size={20} /> : null} {isEditMode ? '수정 내용 저장하기' : '리뷰 등록 및 보상 받기'}</>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="py-16 flex flex-col items-center text-center animate-in zoom-in px-8">
            <div className="bg-green-100 p-6 rounded-full text-green-600 mb-6">
              <CheckCircle2 size={56} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">리뷰 등록 완료!</h3>
            <p className="text-gray-400 text-sm font-medium">소중한 피드백 감사합니다.<br />마일리지가 지급되었습니다.</p>
            <button onClick={onClose} className="w-full bg-gray-900 text-white py-5 rounded-3xl text-lg font-black mt-10 shadow-xl transition-all active:scale-95">닫기</button>
          </div>
        )}
      </div>
    </div>
  );
};
