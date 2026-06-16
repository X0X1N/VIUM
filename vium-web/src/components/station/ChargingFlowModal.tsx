import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Zap, Loader2, Car, Plug2, BatteryFull, CreditCard, ShieldCheck } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { stationService } from '../../services/stationService';
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import type { ChargingStation } from '../../types';

const TOSS_CLIENT_KEY = "test_ck_DnyRpQWGrNlgeqqGLm5L3Kwv1M9E";

// 충전 프로세스를 6가지 단계로 정의해서 관리합니다. 
// 이렇게 상태를 나눠놓아야 복잡한 흐름을 제어하기 편하더라구요.
type FlowStep = 'CONNECTION_PROMPT' | 'CONFIRM_CHARGE' | 'CHARGING' | 'BILLING' | 'WAITING_EXIT' | 'SUCCESS';

interface ChargingFlowModalProps {
  station: ChargingStation;
  onClose: () => void;
  onComplete: (amount: number) => void;
  initialStep?: 'CONNECTION_PROMPT' | 'CONFIRM_CHARGE' | 'BILLING';
}

export const ChargingFlowModal: React.FC<ChargingFlowModalProps> = ({ 
  station, 
  onClose, 
  onComplete,
  initialStep = 'CONNECTION_PROMPT'
}) => {
  const { user, fetchUser } = useUserStore();
  const [step, setStep] = useState<FlowStep>(initialStep);
  const [currentSoc] = useState(30); // 현재 배터리 상태
  const [targetSoc, setTargetSoc] = useState(80); // 사용자가 설정한 목표치
  const [progress, setProgress] = useState(30); // 시각적인 충전 진행률
  const [usedMileage, setUsedMileage] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  
  // 토스 결제 후 돌아왔을 때 이전 상태를 복구하기 위해 세션 스토리지를 활용합니다.
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    return sessionStorage.getItem('vium_last_order_id');
  });

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isConnectorDisconnected, setIsConnectorDisconnected] = useState(false);
  
  const isConfirmingRef = useRef(false);
  const hasSyncedInitialBattery = useRef(false);
  const chargerIdRef = useRef<string | null>(null);

  // 현재 내가 사용 중인 충전기(호기)가 무엇인지 식별하는 로직입니다.
  useEffect(() => {
    const myCharger = station.chargers.find(c => 
      (c.active_user_id && user?.user_id && Number(c.active_user_id) === Number(user.user_id)) ||
      (c.active_session_id && c.active_session_id === activeOrderId)
    );
    if (myCharger) {
      chargerIdRef.current = myCharger.charger_id;
    }
  }, [station, user, activeOrderId]);

  // [단계 1] 사용자가 차량에 커넥터를 실제로 꽂았는지 감시합니다.
  // 아두이노 센서가 'Charging' 상태를 보내면 자동으로 다음 설정 화면으로 넘어가요!
  useEffect(() => {
    if (step !== 'CONNECTION_PROMPT') return;

    const interval = setInterval(async () => {
      try {
        const response = await stationService.getStations();
        if (response.success && response.data) {
          const currentStation = response.data.find(s => s.station_id === station.station_id);
          if (currentStation) {
            // 내가 찜한 충전기에서 신호가 오는지 체크합니다.
            const charger = currentStation.chargers.find(c => 
              c.active_user_id && user?.user_id && 
              Number(c.active_user_id) === Number(user.user_id)
            );
            
            if (charger?.status === 'Charging' && !hasSyncedInitialBattery.current) {
              if (currentStation.current_battery !== undefined) {
                const initialSoc = Math.round(currentStation.current_battery);
                setTargetSoc(Math.min(100, Math.max(initialSoc + 10, 80)));
                setProgress(initialSoc);
                hasSyncedInitialBattery.current = true;
              }
              setStep('CONFIRM_CHARGE');
              console.log("🔋 [Modal] Connection detected. Syncing Battery:", currentStation.current_battery);
            }
          }
        }
      } catch (e) {
        console.error("Hardware monitoring failed", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [station, user, step]);

  // 충전 중에는 서버 데이터가 내 화면의 애니메이션을 방해하지 못하도록 가드를 쳐줍니다.
  useEffect(() => {
    if (step === 'CHARGING' || step === 'BILLING' || step === 'WAITING_EXIT' || step === 'SUCCESS') return;
    if (station.current_battery !== undefined && !hasSyncedInitialBattery.current) {
      const val = Math.round(station.current_battery);
      setProgress(val);
    }
  }, [station.current_battery, step]);

  // [단계 3] 충전 시뮬레이션 애니메이션입니다.
  // 실제 충전 속도보다는 시각적인 피드백을 위해 조금 더 빠르게 차오르도록 설정했어요.
  useEffect(() => {
    if (step === 'CHARGING') {
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= targetSoc) {
            clearInterval(interval);
            
            // 목표치 도달 시 브라우저 알림을 띄워줍니다.
            if (Notification.permission === "granted") {
                new Notification(`✅ 목표 충전(${targetSoc}%) 도달`, {
                    body: `${user?.nickname || '회원'}님, 설정하신 목표치까지 충전이 완료되었습니다.`,
                    icon: '/favicon.svg'
                });
            }

            // 충전량에 따라 요금을 계산해서 정산 단계로 넘깁니다.
            const chargedPercent = targetSoc - Math.round(progress);
            const calculatedPrice = Math.max(0, chargedPercent * 340);
            setTotalPrice(calculatedPrice);
            setStep('BILLING');
            return targetSoc;
          }
          return p + 0.5;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [step, targetSoc, user]);

  // [단계 4] 결제 후 차를 빼는 과정을 모니터링합니다.
  // 커넥터를 뽑고 차가 주차 구역을 벗어나면('Available') 최종 성공 화면으로 바뀝니다.
  useEffect(() => {
    if (step !== 'WAITING_EXIT') return;

    const interval = setInterval(async () => {
      const response = await stationService.getStations();
      if (response.success && response.data) {
        const currentStation = response.data.find(s => s.station_id === station.station_id);
        if (currentStation) {
          const charger = currentStation.chargers.find(c => c.charger_id === chargerIdRef.current);
          if (charger) {
            if (charger.status === 'Occupied' && !isConnectorDisconnected) {
              setIsConnectorDisconnected(true);
            }
            if (charger.status === 'Available') {
              setStep('SUCCESS');
              clearInterval(interval);
              
              // 출차가 확인되면 4초 뒤에 기분 좋게 보상을 띄우며 모달을 닫아줍니다.
              setTimeout(() => {
                const finalReward = (targetSoc === 80 ? 500 : 300) + 100;
                onComplete(finalReward);
                onClose();
              }, 4000);
            }
          }
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [step, station.station_id, targetSoc, onComplete, onClose, isConnectorDisconnected]);

  // [결제 복구 로직] 토스페이먼츠 결제 성공 리다이렉트 시 실행됩니다.
  // 새로고침된 페이지에서도 '결제 완료'임을 인지하고 흐름을 이어가게 해주는 아주 중요한 코드예요!
  useEffect(() => {
    if (initialStep === 'BILLING' && step === 'BILLING') {
      const params = new URLSearchParams(window.location.search);
      const paymentKey = params.get('paymentKey');
      const orderId = params.get('orderId');
      const amount = params.get('amount');

      if (paymentKey && orderId && amount) {
        if (isConfirmingRef.current) return;
        
        const confirmedKey = `vium_confirmed_${orderId}`;
        if (sessionStorage.getItem(confirmedKey)) {
            setStep('WAITING_EXIT');
            return;
        }

        isConfirmingRef.current = true;
        
        (async () => {
          setIsProcessingPayment(true);
          try {
            const res = await stationService.confirmPayment({
              paymentKey, orderId, amount: parseInt(amount)
            });
            if (res.success) {
              sessionStorage.setItem(confirmedKey, 'true');
              await fetchUser(); // 마일리지가 차감됐을 테니 유저 정보도 갱신해줍니다.
              setStep('WAITING_EXIT');
              window.history.replaceState({}, '', '/'); // URL 지저분한 파라미터들 청소!
            }
          } catch (e) {
            console.error("Payment confirmation failed", e);
          } finally {
            setIsProcessingPayment(false);
          }
        })();
      }
    }
  }, [initialStep, step, fetchUser]);

  // 충전 시작 버튼 클릭 시 서버에 '충전 세션'을 먼저 만들어둡니다.
  const handleStartChargingFlow = async () => {
    try {
      const myCharger = station.chargers.find(c => c.active_user_id && user?.user_id && Number(c.active_user_id) === Number(user.user_id));
      const response = await stationService.createPaymentSession({
        station_id: station.station_id,
        charger_id: myCharger?.charger_id || '',
        total_price: 0,
        used_mileage: 0,
        final_amount: 0,
        target_soc: targetSoc
      });

      if (response.success && response.data) {
        const orderId = response.data.order_id;
        setActiveOrderId(orderId);
        sessionStorage.setItem('vium_last_order_id', orderId);
        sessionStorage.setItem('vium_last_charging_id', station.station_id);
        setStep('CHARGING');
      }
    } catch (e) {
      console.error("Session creation failed", e);
      setStep('CHARGING');
    }
  };

  // 실제 결제 요청을 토스 서버에 보냅니다.
  const handlePayment = async () => {
    if (!activeOrderId) return;
    setIsProcessingPayment(true);
    try {
      const chargedPercent = targetSoc - Math.round(progress);
      const calculatedPrice = Math.max(0, chargedPercent * 340);
      const finalAmount = Math.max(0, calculatedPrice - usedMileage);

      const myCharger = station.chargers.find(c => c.active_user_id && user?.user_id && Number(c.active_user_id) === Number(user.user_id));

      // 결제 직전 최종 금액과 마일리지 사용액을 서버에 동기화해둡니다.
      await stationService.updatePaymentSession(activeOrderId, {
        station_id: station.station_id,
        charger_id: myCharger?.charger_id || '',
        total_price: calculatedPrice,
        used_mileage: usedMileage,
        final_amount: finalAmount,
        target_soc: targetSoc
      });

      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey: user?.email || "anonymous" });
      
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: finalAmount },
        orderId: activeOrderId,
        orderName: `${station.station_name} 충전 요금`,
        successUrl: window.location.origin + "/?payment_success=true",
        failUrl: window.location.origin + "/?payment_fail=true",
      });
    } catch (e) {
      console.error("Payment request failed", e);
      setIsProcessingPayment(false);
    }
  };

  // 정책에 따른 예상 보상을 실시간으로 계산해줍니다. (80% 에코 보너스 + 매너 보너스)
  const reward = useMemo(() => {
    const base = targetSoc === 80 ? 500 : 300;
    const manner = 100;
    return {
      base, manner,
      total: base + manner
    };
  }, [targetSoc]);

  // 모든 과정이 끝났을 때 보여주는 성공 화면입니다.
  if (step === 'SUCCESS') {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 overflow-hidden">
        <div className="w-24 h-24 bg-green-600 rounded-[32px] flex items-center justify-center mb-8 shadow-2xl shadow-green-200 rotate-3">
          <Car size={48} className="text-white -rotate-3" />
        </div>
        <h2 className="text-4xl font-black text-gray-900 tracking-tighter italic uppercase mb-2">Exit Complete!</h2>
        <p className="text-gray-500 font-bold mb-12 leading-relaxed">
          출차가 완료되었습니다.<br/>
          오늘도 VIUM과 함께 쾌적한 드라이빙 되세요.
        </p>

        <div className="w-full max-w-sm bg-blue-50 rounded-[40px] border border-blue-100 p-10 mb-12">
          <p className="text-blue-400 font-black uppercase text-xs tracking-widest mb-2">Total Earned Mileage</p>
          <div className="flex items-center justify-center gap-2">
            <Zap size={24} className="text-blue-600 fill-blue-600" />
            <span className="text-5xl font-black text-blue-600 tracking-tighter">{reward.total.toLocaleString()} P</span>
          </div>
        </div>

        <button 
          onClick={() => { onComplete(reward.total); onClose(); }}
          className="w-full max-w-sm py-6 bg-gray-900 text-white rounded-[28px] font-black text-lg shadow-xl active:scale-95 transition-all hover:bg-black"
        >
          확인
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in duration-500 overflow-hidden lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[450px] lg:h-[90vh] lg:rounded-[40px] lg:shadow-2xl lg:border lg:border-gray-100">
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10">
        
        {/* 단계별 UI 렌더링 - 가독성을 위해 테일윈드 클래스로 예쁘게 꾸몄습니다! */}
        {step === 'CONNECTION_PROMPT' && (
          <div className="space-y-10 text-center animate-in zoom-in-95 duration-500">
            <div className="relative">
              <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center mx-auto relative z-10 animate-bounce">
                <Plug2 size={64} className="text-blue-500" />
              </div>
              <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-10"></div>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">커넥터를 연결해 주세요</h2>
              <p className="text-gray-500 font-bold leading-relaxed px-4">차량에 충전 커넥터를 연결하면<br/>자동으로 충전 설정을 시작합니다.</p>
            </div>
            <div className="pt-4">
              <button onClick={onClose} className="text-gray-400 font-black text-sm uppercase tracking-widest hover:text-gray-600 transition-colors">Cancel Connection</button>
            </div>
          </div>
        )}

        {step === 'CONFIRM_CHARGE' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
            <div className="text-center space-y-2">
              <BatteryFull size={48} className="text-indigo-500 mx-auto mb-4" />
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">차량 연결 확인됨</h2>
              <p className="text-gray-500 font-bold">충전 목표를 설정하고 시작 버튼을 눌러주세요.</p>
            </div>

            <div className="bg-gray-50 p-8 rounded-[40px] border border-gray-100 space-y-8">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-black uppercase text-xs tracking-widest">현재 배터리</span>
                <span className="text-2xl font-black text-indigo-600 italic">{Math.round(progress)}%</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-black uppercase text-xs tracking-widest">목표 충전량</span>
                  <span className="text-3xl font-black text-gray-900 italic">{targetSoc}%</span>
                </div>
                <input 
                  type="range" 
                  min={Math.max(Math.round(progress), 10)} 
                  max="100" 
                  step="1"
                  value={targetSoc} 
                  onChange={(e) => setTargetSoc(Number(e.target.value))}
                  className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest">예상 보상</span>
                  <span className="text-lg font-black text-blue-600">+{reward.total}P</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleStartChargingFlow}
              className="w-full py-6 bg-indigo-600 text-white rounded-[32px] font-black text-xl shadow-2xl shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Zap size={24} fill="currentColor" /> 충전 시작하기
            </button>
          </div>
        )}

        {step === 'CHARGING' && (
          <div className="space-y-12 text-center animate-in zoom-in-95 duration-500">
            <div className="relative w-64 h-64 mx-auto">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="128" cy="128" r="110" className="stroke-gray-100" strokeWidth="20" fill="none" />
                <circle cx="128" cy="128" r="110" className="stroke-blue-500 transition-all duration-300 ease-out" strokeWidth="20" fill="none" strokeDasharray="691.15" strokeDashoffset={691.15 * (1 - progress / 100)} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Zap className="text-blue-500 mb-2 animate-pulse" size={32} />
                <span className="text-6xl font-black text-gray-900 tracking-tighter italic">{Math.round(progress)}%</span>
              </div>
            </div>
            
            <div className="bg-blue-50/50 p-8 rounded-[40px] border border-blue-100 space-y-2">
              <p className="text-blue-600 text-sm font-black uppercase italic animate-pulse tracking-widest">Charging in progress...</p>
              <p className="text-gray-500 font-bold text-xs leading-relaxed break-keep">실시간 하드웨어 센서가 차량의 전압과 배터리 상태를 모니터링 중입니다.</p>
            </div>
          </div>
        )}

        {step === 'BILLING' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
            <div className="text-center space-y-1">
              <h3 className="text-3xl font-black text-gray-900 uppercase italic tracking-tighter">Billing</h3>
              <p className="text-xs text-gray-400 font-black uppercase tracking-widest">Transaction Summary</p>
            </div>

            <div className="bg-gray-50 p-8 rounded-[40px] border-2 border-dashed border-gray-200 space-y-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 font-black uppercase tracking-widest">충전 요금 (단가 340원)</span>
                <span className="font-black text-gray-900 italic">{totalPrice.toLocaleString()}원</span>
              </div>
              
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-black uppercase text-xs tracking-widest">마일리지 사용</span>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" 
                      value={usedMileage}
                      onChange={(e) => setUsedMileage(Math.max(0, Math.min(user?.mileage_balance || 0, Number(e.target.value))))}
                      className="w-24 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-right font-black text-blue-600"
                    />
                    <span className="text-xs font-bold text-gray-400">P</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <span className="text-[10px] font-bold text-gray-400">보유 잔액: {user?.mileage_balance.toLocaleString()}P</span>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <div className="flex justify-between items-end">
                  <span className="text-gray-900 font-black text-xl uppercase italic">최종 결제 금액</span>
                  <span className="text-4xl font-black text-blue-600 tracking-tighter">{(totalPrice - usedMileage).toLocaleString()}원</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handlePayment} 
                disabled={isProcessingPayment}
                className="w-full py-6 bg-blue-600 text-white rounded-[32px] font-black text-xl shadow-2xl shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:bg-gray-300"
              >
                {isProcessingPayment ? <Loader2 className="animate-spin" size={24} /> : <><CreditCard size={24} /> 결제 및 정산하기</>}
              </button>
            </div>
          </div>
        )}

        {step === 'WAITING_EXIT' && (
          <div className="space-y-12 text-center animate-in fade-in duration-500">
            <div className="relative">
              <div className="w-32 h-32 bg-green-50 rounded-full flex items-center justify-center mx-auto relative z-10 border border-green-100">
                <ShieldCheck size={64} className="text-green-500 animate-pulse" />
              </div>
              <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-10"></div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-3xl font-black text-gray-900 tracking-tight">결제 승인 완료!</h3>
              <div className={`p-6 rounded-[32px] border transition-all ${!isConnectorDisconnected ? 'bg-orange-50 border-orange-200 animate-pulse' : 'bg-blue-50 border-blue-200'}`}>
                <p className={`font-black text-sm uppercase flex items-center justify-center gap-2 ${!isConnectorDisconnected ? 'text-orange-600' : 'text-blue-600'}`}>
                  {!isConnectorDisconnected ? <><Plug2 size={20} /> 차량에서 커넥터를 분리해 주세요</> : <><Car size={20} /> 안전하게 출차해 주세요</>}
                </p>
              </div>
            </div>
            
            <div className="w-full bg-gray-50 p-5 rounded-[24px] flex items-center justify-center gap-3 font-black text-gray-300 uppercase text-xs tracking-widest border border-gray-100 italic">
              <Loader2 className="animate-spin" size={14} /> H/W Sensor Live Monitoring
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
