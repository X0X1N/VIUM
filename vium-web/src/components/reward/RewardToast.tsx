import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface RewardToastProps {
  show: boolean;
  amount: number;
}

export const RewardToast: React.FC<RewardToastProps> = ({ show, amount }) => {
  if (!show) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md animate-in fade-in zoom-in slide-in-from-top-4 duration-500">
      <div className="bg-white rounded-3xl p-5 shadow-2xl border-2 border-green-500 flex items-center gap-4">
        <div className="bg-green-100 p-3 rounded-full text-green-600 animate-bounce">
          <CheckCircle2 size={32} />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-400">매너 출차 보상 완료!</p>
          <p className="text-xl font-black text-gray-800">
            <span className="text-green-600">+{amount} P</span> 가 적립되었습니다.
          </p>
        </div>
      </div>
    </div>
  );
};
