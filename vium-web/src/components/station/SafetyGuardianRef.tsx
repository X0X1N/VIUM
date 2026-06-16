import React, { useState } from 'react';
import { ShieldAlert, Eye, Cable, Plug2, CheckCircle2, ArrowLeft } from 'lucide-react';

/**
 * [Reference Only] SafetyGuardianRef Component
 * 
 * This file preserves the 3-step safety check logic that was previously 
 * part of the ChargingFlowModal. It can be used for documentation 
 * or as a basis for a future standalone safety feature.
 */

export const SafetyGuardianRef: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const [safetyStep, setSafetyStep] = useState(0);

  const safetyItems = [
    { 
      id: 'surroundings', 
      title: '주변 환경 점검', 
      desc: '바닥에 물기나 가연성 물질이 없는지 확인해 주세요.', 
      icon: <Eye className="text-blue-500" size={32} /> 
    },
    { 
      id: 'cable', 
      title: '케이블 상태 확인', 
      desc: '충전 케이블의 피복이 벗겨지거나 꼬여있지 않나요?', 
      icon: <Cable className="text-orange-500" size={32} /> 
    },
    { 
      id: 'connector', 
      title: '커넥터 체결 준비', 
      desc: '커넥터 내부에 이물질이 없는지 육안으로 확인하세요.', 
      icon: <Plug2 className="text-green-500" size={32} /> 
    }
  ];

  const handleSafetyConfirm = () => {
    if (safetyStep < safetyItems.length - 1) {
      setSafetyStep(prev => prev + 1);
    } else {
      if (onComplete) onComplete();
      alert("모든 안전 점검이 완료되었습니다.");
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-[40px] shadow-xl overflow-hidden border border-gray-100">
      <div className="p-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-gray-900 leading-tight">안전 가디언 점검</h3>
            <p className="text-gray-400 text-xs mt-1">충전 전 3단계를 신중하게 확인해 주세요.</p>
          </div>
          <ShieldAlert className="text-red-500 animate-pulse" size={28} />
        </div>
        
        {/* Progress Bar */}
        <div className="flex gap-2">
          {safetyItems.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i <= safetyStep ? 'bg-blue-600' : 'bg-gray-100'
              }`} 
            />
          ))}
        </div>

        {/* Interaction Card */}
        <div 
          key={safetyStep} 
          className="bg-gray-50 rounded-[40px] p-8 border border-gray-100 flex flex-col items-center justify-center text-center space-y-6 animate-in slide-in-from-right-10 duration-500 min-h-[300px]"
        >
          <div className="w-24 h-24 rounded-full bg-white shadow-sm border border-gray-50 flex items-center justify-center shrink-0">
            {safetyItems[safetyStep].icon}
          </div>
          <div className="space-y-3">
            <h4 className="text-xl font-black text-gray-800">{safetyItems[safetyStep].title}</h4>
            <p className="text-sm text-gray-500 font-medium break-keep max-w-[240px]">
              {safetyItems[safetyStep].desc}
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="space-y-4">
          <button 
            onClick={handleSafetyConfirm} 
            className="w-full bg-gray-900 text-white py-5 rounded-3xl text-lg font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <CheckCircle2 size={20} className="text-blue-400" />
            {safetyStep === safetyItems.length - 1 ? '모든 점검 완료' : '확인했습니다'}
          </button>
          
          {safetyStep > 0 && (
            <button 
              onClick={() => setSafetyStep(prev => prev - 1)} 
              className="w-full text-gray-400 text-sm font-bold hover:text-gray-600 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft size={14} /> 이전 항목 다시 보기
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SafetyGuardianRef;
