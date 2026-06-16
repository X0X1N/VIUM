import React from 'react';
import { 
  X, Zap, Coins, TrendingDown, Sun,
  ShieldCheck, CreditCard, ChevronRight,
  FileText, Moon
} from 'lucide-react';

interface PolicyModalProps {
  onClose: () => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-end lg:items-center justify-center p-0 lg:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl h-[90dvh] lg:h-auto lg:max-h-[90vh] rounded-t-[40px] lg:rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 lg:slide-in-from-bottom-0 lg:zoom-in-95 duration-500 flex flex-col">
        
        {/* Header */}
        <div className="p-6 lg:p-8 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-100">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg lg:text-xl font-black text-gray-900 leading-tight">VIUM 서비스 이용 정책</h2>
              <p className="text-[10px] lg:text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">운영 및 마일리지 정책 2026</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-all active:scale-90">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-10 no-scrollbar">
          
          {/* 1. Pricing Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
              <h3 className="text-lg font-black text-gray-900">2026 가변 요금표</h3>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-[32px] overflow-hidden shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100/50 text-[10px] uppercase font-black text-gray-400 tracking-tighter border-b border-gray-100">
                    <th className="py-3 px-2">요금 구간</th>
                    <th className="py-3">완속</th>
                    <th className="py-3 text-blue-600 font-black">급속</th>
                    <th className="py-3">초급속</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[10px] md:text-xs text-gray-500 font-bold text-center bg-white">
                  <tr>
                    <td className="py-4 px-2 text-blue-500 flex items-center justify-center gap-1 font-black">
                      <TrendingDown size={12} /> 에코
                    </td>
                    <td className="py-4 italic">160원</td>
                    <td className="py-4 font-black text-blue-600">280원</td>
                    <td className="py-4">340원</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-2 text-gray-600 flex items-center justify-center gap-1 font-black">
                      <Sun size={12} /> 평균
                    </td>
                    <td className="py-4 italic">240원</td>
                    <td className="py-4 font-black text-gray-900">340원</td>
                    <td className="py-4">390원</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-2 text-red-500 flex items-center justify-center gap-1 font-black">
                      <Zap size={12} fill="currentColor" /> 피크
                    </td>
                    <td className="py-4 italic">290원</td>
                    <td className="py-4 font-black text-gray-900">390원</td>
                    <td className="py-4">450원</td>
                  </tr>
                </tbody>
              </table>
              <div className="p-4 bg-blue-50/30 border-t border-blue-50">
                <p className="text-[10px] text-blue-700/60 font-medium leading-relaxed">
                  * <strong>에코 시간대:</strong> 심야(23~09시) 및 낮(11~15시)<br/>
                  * <strong>피크 시간대:</strong> 저녁(18~22시)
                </p>
              </div>
            </div>
          </section>

          {/* 2. Mileage Reward Rules */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-4 bg-green-500 rounded-full"></div>
              <h3 className="text-lg font-black text-gray-900">마일리지 보상 규칙</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 80% Eco Reward */}
              <div className="bg-green-50/50 p-6 rounded-[32px] border border-green-100 relative overflow-hidden group transition-all hover:shadow-md">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-green-500 rounded-xl text-white shadow-lg shadow-green-100">
                    <Zap size={18} fill="currentColor" />
                  </div>
                  <span className="text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-100 px-2 py-1 rounded-md">Best Choice</span>
                </div>
                <h4 className="text-base font-black text-gray-900 mb-1">80% 에코 제한 충전</h4>
                <p className="text-xs text-gray-500 font-medium leading-relaxed mb-4">
                  목표 80% 설정 시 <strong>기본 300P</strong>를 즉시 지급하며, 회전율 향상에 기여합니다.
                </p>
                <div className="flex items-center gap-2">
                   <div className="px-3 py-1 bg-green-500 text-white rounded-full text-[10px] font-black">추천</div>
                   <span className="text-green-600 font-black text-sm">+300P ~ 600P</span>
                </div>
              </div>

              {/* 100% Full Mode */}
              <div className="bg-indigo-50/30 p-6 rounded-[32px] border border-indigo-50 relative overflow-hidden group transition-all hover:shadow-md">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-100">
                    <BatteryFull size={18} />
                  </div>
                </div>
                <h4 className="text-base font-black text-gray-900 mb-1">100% 완충 모드</h4>
                <p className="text-xs text-gray-500 font-medium leading-relaxed mb-4">
                  기본 보상은 없으나, 완충까지 소요된 <strong>총 시간</strong>에 비례하여 마일리지를 차등 지급합니다.
                </p>
                <div className="flex items-center gap-2">
                   <div className="px-3 py-1 bg-indigo-500 text-white rounded-full text-[10px] font-black">장거리</div>
                   <span className="text-indigo-600 font-black text-sm">시간 비례 정산</span>
                </div>
              </div>
            </div>

            {/* Additional TOU Bonus */}
            <div className="bg-blue-50/50 p-6 rounded-[32px] border border-blue-100 space-y-4">
              <div className="flex items-center gap-2 text-blue-600 font-black text-sm">
                <Coins size={18} /> 시간대별 에코 보너스
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-blue-50">
                  <p className="text-[11px] font-black text-gray-900 mb-1 flex items-center gap-1.5"><Sun size={14} className="text-orange-400" /> 낮 피크 에코 (11:00 ~ 15:00)</p>
                  <p className="text-[10px] text-gray-500 font-medium">해당 시간 내 출차 시 <strong>200P 추가</strong></p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-blue-50">
                  <p className="text-[11px] font-black text-gray-900 mb-1 flex items-center gap-1.5"><Moon size={14} className="text-indigo-400" /> 심야/주말 보너스</p>
                  <p className="text-[10px] text-gray-500 font-medium">저렴한 전력 시간대 이용 시 <strong>200P 추가</strong></p>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Manner Exit System */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
              <h3 className="text-lg font-black text-gray-900">매너 출차 시스템</h3>
            </div>
            <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm">
              <div className="relative flex justify-between before:absolute before:left-0 before:right-0 before:top-4 before:h-1 before:bg-gray-100">
                <div className="relative flex flex-col items-center gap-2 group">
                  <div className="w-8 h-8 rounded-full bg-green-500 border-4 border-white shadow-md z-10"></div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">골든타임</p>
                    <p className="text-[9px] font-bold text-green-500">10분 내 (100%)</p>
                  </div>
                </div>
                <div className="relative flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-orange-400 border-4 border-white shadow-md z-10"></div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">주의</p>
                    <p className="text-[9px] font-bold text-orange-400">15분 내 (-30%)</p>
                  </div>
                </div>
                <div className="relative flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-orange-600 border-4 border-white shadow-md z-10"></div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">경고</p>
                    <p className="text-[9px] font-bold text-orange-600">20분 내 (-50%)</p>
                  </div>
                </div>
                <div className="relative flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-500 border-4 border-white shadow-md z-10"></div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">보상 소멸</p>
                    <p className="text-[9px] font-bold text-red-500">20분 초과 (0%)</p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 font-medium text-center mt-8">
                * 충전 완료 후 자리를 비워주는 속도에 따라 보상이 차등 지급됩니다.
              </p>
            </div>
          </section>

          {/* 4. Financial Policy */}
          <section className="bg-gray-900 p-8 rounded-[40px] text-white space-y-4 shadow-xl shadow-gray-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-blue-400" size={24} />
              <h3 className="text-lg font-black italic">마일리지 운영 및 정산</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">마일리지 유효기간</p>
                <p className="text-sm font-bold">적립일로부터 1년 (365일)</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">최소 사용 단위</p>
                <p className="text-sm font-bold">10P 단위 즉시 사용 가능</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-gray-400" />
                <span className="text-xs font-bold text-gray-400">결제 시 마일리지 차감 할인 적용</span>
              </div>
              <ChevronRight size={18} className="text-gray-600" />
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 lg:p-8 bg-white border-t border-gray-100 shrink-0">
          <button 
            onClick={onClose}
            className="w-full bg-gray-900 text-white py-5 rounded-[24px] text-base font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            내용을 모두 확인했습니다 <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

// 미사용 아이콘 및 타입 에러 방지용 (BatteryFull 임포트 추가 필요 시)
const BatteryFull = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"></rect><line x1="22" y1="11" x2="22" y2="13"></line><line x1="6" y1="11" x2="6" y2="13"></line><line x1="10" y1="11" x2="10" y2="13"></line><line x1="14" y1="11" x2="14" y2="13"></line></svg>
);
