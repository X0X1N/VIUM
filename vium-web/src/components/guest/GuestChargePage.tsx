import React, { useState, useEffect, useRef } from 'react';
import { Zap, CheckCircle2, Loader2, Car, Plug2, BatteryFull, Bell, BellRing, X } from 'lucide-react';
import { stationService } from '../../services/stationService';
import { apiClient } from '../../services/apiClient';
import { usePushNotification } from '../../hooks/usePushNotification';
import { useNotificationStore } from '../../store/notificationStore';
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import type { ChargingStation } from '../../types';

const TOSS_CLIENT_KEY = "test_ck_DnyRpQWGrNlgeqqGLm5L3Kwv1M9E";

// 비회원 충전 과정을 6단계로 관리합니다. 
// 회원가입 없이 QR로 바로 들어온 분들이라, 안내 문구 하나하나에 신경을 많이 썼어요!
type FlowStep = 'CONNECTION_PROMPT' | 'CONFIRM_CHARGE' | 'CHARGING' | 'BILLING' | 'WAITING_EXIT' | 'SUCCESS';

interface GuestChargePageProps {
  chargerId: string;
}

export const GuestChargePage: React.FC<GuestChargePageProps> = ({ chargerId }) => {
  const [station, setStation] = useState<ChargingStation | null>(null);
  const { addNotification } = useNotificationStore();
  const [step, setStep] = useState<FlowStep>('CONNECTION_PROMPT');
  const [currentSoc, setCurrentSoc] = useState(30);
  const [targetSoc, setTargetSoc] = useState(80);
  const [progress, setProgress] = useState(30);
  const [totalPrice, setTotalPrice] = useState(0);
  
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('orderId') || sessionStorage.getItem('vium_guest_active_order_id');
  });

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isConnectorDisconnected, setIsConnectorDisconnected] = useState(false);
  
  const [isSubscribed, setIsSubscribed] = useState(() => {
    return sessionStorage.getItem('vium_guest_is_subscribed') === 'true';
  });
  
  const isConfirmingRef = useRef(false);
  const isPushMappingRef = useRef(false);
  const hasSyncedInitialBattery = useRef(false);

  const { subscribe, unsubscribe, isSubscribing } = usePushNotification();

  const handlePushToggle = async () => {
    if (isSubscribed) {
        await unsubscribe();
        setIsSubscribed(false);
        sessionStorage.setItem('vium_guest_is_subscribed', 'false');
    } else {
        const success = await subscribe(activeOrderId || undefined);
        if (success) {
            setIsSubscribed(true);
            sessionStorage.setItem('vium_guest_is_subscribed', 'true');
        }
    }
  };

  const handleExit = () => {
    if (window.confirm('충전 페이지를 나가시겠습니까?')) {
        window.location.href = '/';
    }
  };

  useEffect(() => {
    const loadStation = async () => {
      try {
        const res = await stationService.getStations();
        if (res.success && res.data) {
          const foundStation = res.data.find(s => s.chargers.some(c => c.charger_id === chargerId));
          if (foundStation) {
            setStation(foundStation);
            apiClient.post(`/hardware/claim?charger_id=${chargerId}`, {}).catch(() => {});
            console.log("🤫 [Guest Auto-Claim] Charger ID:", chargerId);
          }
        }
      } catch (e) {
        console.error("Failed to load station for guest:", e);
      }
    };
    loadStation();
  }, [chargerId]);

  useEffect(() => {
    if (!station) return;
    const interval = setInterval(async () => {
      const res = await stationService.getStations();
      if (res.success && res.data) {
        const currentStation = res.data.find(s => s.station_id === station.station_id);
        if (currentStation) {
          const charger = currentStation.chargers.find(c => c.charger_id === chargerId);
          if (charger) {
             if (step === 'CONNECTION_PROMPT' && charger.status === 'Charging' && !hasSyncedInitialBattery.current) {
                if (currentStation.current_battery !== undefined) {
                    const initialSoc = Math.round(currentStation.current_battery);
                    setCurrentSoc(initialSoc);
                    setProgress(initialSoc);
                    hasSyncedInitialBattery.current = true;
                }
                setStep('CONFIRM_CHARGE');
             }
             if ((step === 'WAITING_EXIT' || step === 'SUCCESS') && charger.status === 'Occupied' && !isConnectorDisconnected) {
                 setIsConnectorDisconnected(true);
                 if (isSubscribed) {
                   addNotification({
                     id: activeOrderId ? `disconnect-${activeOrderId}` : `disconnect-guest-${Date.now()}`,
                     role: 'USER',
                     type: 'INFO',
                     title: '🔌 커넥터 분리 확인',
                     message: '비회원 고객님, 커넥터가 안전하게 분리되었습니다. 이제 출차해 주세요.'
                   });
                 }
             }
             if ((step === 'WAITING_EXIT' || step === 'SUCCESS') && charger.status === 'Available' && step !== 'SUCCESS') {
                 setStep('SUCCESS');
                 sessionStorage.removeItem('vium_guest_active_order_id');
                 sessionStorage.removeItem('vium_guest_is_subscribed');
                 
                 if (isSubscribed) {
                   addNotification({
                     id: activeOrderId ? `exit-${activeOrderId}` : `exit-guest-${Date.now()}`,
                     role: 'USER',
                     type: 'SUCCESS',
                     title: '🚗 출차 확인 완료',
                     message: '비회원 고객님, 안전하게 출차되었습니다. 오늘도 즐거운 드라이빙 되세요!'
                   });
                 }
             }
          }
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [station, step, chargerId, addNotification, activeOrderId, isConnectorDisconnected, isSubscribed]);

  useEffect(() => {
    if (step === 'CHARGING') {
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= targetSoc) {
            clearInterval(interval);
            
            if (isSubscribed) {
              addNotification({
                id: activeOrderId ? `done-${activeOrderId}` : `done-guest-${Date.now()}`,
                role: 'USER',
                type: 'SUCCESS',
                title: `✅ 목표 충전(${targetSoc}%) 도달`,
                message: `비회원 고객님, 설정하신 ${targetSoc}% 충전이 완료되었습니다. 결제 후 안전하게 출차해 주세요.`
              });
            }

            const chargedPercent = targetSoc - Math.round(currentSoc);
            const calculatedPrice = Math.max(0, chargedPercent * 340);
            setTotalPrice(calculatedPrice);
            setStep('BILLING');
            return targetSoc;
          }
          return p + 1;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [step, targetSoc, currentSoc, activeOrderId, addNotification, isSubscribed]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderIdFromUrl = params.get('orderId');
    
    if (orderIdFromUrl && !activeOrderId) {
        setActiveOrderId(orderIdFromUrl);
        sessionStorage.setItem('vium_guest_active_order_id', orderIdFromUrl);
    }

    if (params.get('payment_success') === 'true' && (orderIdFromUrl || activeOrderId)) {
       const finalOrderId = orderIdFromUrl || activeOrderId;
       const savedContext = sessionStorage.getItem('vium_guest_charging_context');
       if (savedContext) {
           try {
             const context = JSON.parse(savedContext);
             setTotalPrice(context.totalPrice);
             setCurrentSoc(context.currentSoc);
             setTargetSoc(context.targetSoc);
             setProgress(context.targetSoc);
           } catch (e) {
             console.error("Context restore failed", e);
           }
       }

       if (!isPushMappingRef.current && isSubscribed && finalOrderId) {
           isPushMappingRef.current = true;
           subscribe(finalOrderId, true).then(success => {
               if (success) console.log("✅ 비회원 알림 매핑 성공 (Silent)");
           });
       }

       if (isConfirmingRef.current) return;
       isConfirmingRef.current = true;

       const processedKey = "vium_guest_confirmed_" + finalOrderId;
       if (sessionStorage.getItem(processedKey)) {
         setStep('WAITING_EXIT');
         return;
       }

       (async () => {
         setIsProcessingPayment(true);
         try {
           const response = await stationService.confirmPayment({
             paymentKey: params.get('paymentKey')!,
             orderId: finalOrderId!,
             amount: parseInt(params.get('amount')!)
           });
           
           if (response.success) {
             if (isSubscribed) {
               addNotification({
                 id: `paid-${finalOrderId}`,
                 role: 'USER',
                 type: 'SUCCESS',
                 title: '💳 결제 및 충전 승인 완료',
                 message: '비회원 고객님, 안전하게 충전이 완료되었습니다. 이용해 주셔서 감사합니다!'
               });
             }

             sessionStorage.setItem(processedKey, 'true'); 
             setStep('WAITING_EXIT');
             window.history.replaceState({}, '', window.location.origin + window.location.pathname + "?guest_charger_id=" + chargerId);
           }
         } catch (error) {
            console.error("Payment Confirmation Error:", error);
            setStep('BILLING');
         } finally {
            setIsProcessingPayment(false);
         }
       })();
    }
  }, [chargerId, isSubscribed, subscribe, addNotification, activeOrderId]);

  const handleStartCharging = async () => {
    if (!station) return;

    try {
      const response = await stationService.createPaymentSession({
        station_id: station.station_id,
        charger_id: chargerId,
        total_price: 0, 
        used_mileage: 0,
        final_amount: 0,
        target_soc: targetSoc
      });

      if (response.success && response.data) {
        const orderId = response.data.order_id;
        setActiveOrderId(orderId);
        sessionStorage.setItem('vium_guest_active_order_id', orderId);
        
        if (isSubscribed) {
          addNotification({
            id: `start-${orderId}`,
            role: 'USER',
            type: 'INFO',
            title: '⚡ 충전 시작',
            message: `비회원 고객님, ${station.station_name}에서 충전이 시작되었습니다. 안전하게 충전해 드릴게요!`
          });

          await subscribe(orderId, true);
          console.log("🔗 비회원 알림 매핑 완료 (충전 시작 즉시, Silent)");
        }
        
        setStep('CHARGING');
      }
    } catch (e) {
      console.error("Failed to pre-create session:", e);
      setStep('CHARGING');
    }
  };

  const handlePayment = async () => {
    if (!station || !activeOrderId) return;
    setIsProcessingPayment(true);
    try {
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const customerKey = "GUEST_" + Math.random().toString(36).substring(2, 12);
      const payment = tossPayments.payment({ customerKey });

      sessionStorage.setItem('vium_guest_active_order_id', activeOrderId);
      sessionStorage.setItem('vium_guest_charging_context', JSON.stringify({
        totalPrice, currentSoc, targetSoc
      }));
      
      await payment.requestPayment({
        method: "CARD", 
        amount: { currency: "KRW", value: totalPrice },
        orderId: activeOrderId,
        orderName: "VIUM 비회원 충전 요금",
        successUrl: window.location.origin + window.location.pathname + "?guest_charger_id=" + chargerId + "&payment_success=true",
        failUrl: window.location.origin + window.location.pathname + "?guest_charger_id=" + chargerId + "&payment_fail=true",
      });
    } catch (e) {
      console.error("Payment Request Error:", e);
      setIsProcessingPayment(false);
    }
  };

  if (!station) {
      return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col font-sans text-gray-900 overflow-hidden">
      <div className={`flex-1 w-full max-w-md mx-auto bg-white shadow-xl flex flex-col relative`}>
        
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center shrink-0 relative">
            <button 
              onClick={handleExit}
              className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all active:scale-90"
            >
              <X size={20} />
            </button>
            <h2 className="text-2xl font-black text-white tracking-tight">비회원 충전 결제</h2>
            <p className="text-blue-100 mt-2 text-sm font-medium">{station.station_name} - {chargerId.split('_').pop()}호기</p>
        </div>
        
        <div className="p-6 md:p-8 flex-1 flex flex-col overflow-y-auto no-scrollbar pb-12">
            {step === 'CONNECTION_PROMPT' && (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto animate-bounce">
                        <Plug2 size={48} className="text-blue-500" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-gray-900">차량에 커넥터를 연결해주세요</h3>
                        <p className="text-sm text-gray-500 font-medium break-keep">커넥터가 연결되면 자동으로 차량 상태를 확인하고 충전 목표 설정 화면으로 이동합니다.</p>
                    </div>
                </div>
            )}

            {step === 'CONFIRM_CHARGE' && (
                <div className="flex-1 flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center pt-2">
                        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <BatteryFull size={32} className="text-indigo-500" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900">차량 연결 확인됨</h3>
                        <p className="text-sm text-gray-500 mt-1 font-medium">현재 배터리 잔량과 목표를 확인해 주세요.</p>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-500">현재 배터리</span>
                            <span className="text-xl font-black text-indigo-600">{Math.round(currentSoc)}%</span>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-500">목표 충전량</span>
                                <span className="text-xl font-black text-gray-900">{targetSoc}%</span>
                            </div>
                            <input 
                                type="range" 
                                min={Math.max(Math.round(currentSoc), 10)} 
                                max="100" 
                                step="1" 
                                value={targetSoc} 
                                onChange={(e) => setTargetSoc(Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <div className="flex justify-between text-[10px] text-gray-400 font-bold px-1 uppercase tracking-tighter">
                                <span>{Math.max(Math.round(currentSoc), 10)}%</span>
                                <span>100%</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto space-y-3 pt-4">
                        <button
                            onClick={handlePushToggle}
                            disabled={isSubscribing}
                            className={`w-full py-4 border-2 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 ${
                                isSubscribed 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' 
                                : 'bg-white border-indigo-100 text-indigo-600 hover:bg-indigo-50'
                            }`}
                        >
                            {isSubscribing ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : isSubscribed ? (
                                <BellRing size={14} className="animate-bounce" />
                            ) : (
                                <Bell size={14} />
                            )}
                            {isSubscribed ? '알림 신청 완료 (누르면 취소)' : '충전 완료 알림 받기 (권장)'}
                        </button>

                        <button 
                            onClick={handleStartCharging} 
                            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all flex justify-center items-center gap-2"
                        >
                            <Zap size={20} fill="currentColor" /> 충전 시작하기
                        </button>
                    </div>
                </div>
            )}

            {step === 'CHARGING' && (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-95 duration-500">
                    <div className="relative w-48 h-48 mx-auto">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="96" cy="96" r="88" className="stroke-gray-100" strokeWidth="16" fill="none" />
                            <circle cx="96" cy="96" r="88" className="stroke-blue-500 transition-all duration-300 ease-out" strokeWidth="16" fill="none" strokeDasharray="552.92" strokeDashoffset={552.92 * (1 - progress / 100)} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <Zap className="text-blue-500 mb-1 animate-pulse" size={24} />
                            <span className="text-4xl font-black text-gray-900 tracking-tighter">{Math.round(progress)}%</span>
                        </div>
                    </div>
                    
                    <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                        <p className="text-blue-600 text-sm font-black animate-pulse uppercase italic">Charging in progress...</p>
                        <p className="text-xs text-gray-500 mt-2 font-medium break-keep">안전한 충전을 위해 차량과 커넥터의 연결 상태를 실시간 모니터링 중입니다.</p>
                    </div>
                </div>
            )}

            {step === 'BILLING' && (
                <div className="flex-1 flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center space-y-1">
                        <h3 className="text-2xl font-black text-gray-900 uppercase italic tracking-tighter">Billing</h3>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Guest Receipt</p>
                    </div>

                    <div className="bg-gray-50 p-8 rounded-[40px] border-2 border-dashed border-gray-200 space-y-5">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400 font-bold">충전 진행</span>
                            <span className="font-black text-gray-900">{Math.round(currentSoc)}% ➔ {targetSoc}%</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400 font-bold">순수 충전량</span>
                            <span className="font-black text-indigo-600">+{targetSoc - Math.round(currentSoc)}%</span>
                        </div>
                        <div className="h-px bg-gray-200 my-2"></div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-gray-900 font-black text-lg">최종 결제 금액</span>
                            <span className="font-black text-blue-600 text-3xl">{totalPrice.toLocaleString()}원</span>
                        </div>
                    </div>

                    <div className="mt-auto pt-4 space-y-3 pb-8">
                        <button 
                            onClick={handlePayment} 
                            disabled={isProcessingPayment}
                            className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black shadow-xl shadow-blue-100 active:scale-95 transition-all flex justify-center items-center gap-3 disabled:bg-gray-300"
                        >
                            {isProcessingPayment ? <Loader2 className="animate-spin" size={24} /> : <><Zap size={20} fill="currentColor" /> 결제하기</>}
                        </button>
                        <p className="text-[10px] text-gray-400 text-center font-bold">결제 버튼 클릭 시 토스페이먼츠 안전 결제창으로 연결됩니다.</p>
                    </div>
                </div>
            )}

            {step === 'WAITING_EXIT' && (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-500">
                    <div className="relative">
                        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto relative z-10 border border-green-100">
                            <CheckCircle2 size={48} className="text-green-500 animate-bounce" />
                        </div>
                        <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-10"></div>
                    </div>
                    
                    <div className="space-y-3">
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">결제 승인 완료!</h3>
                        {!isConnectorDisconnected ? (
                            <div className="bg-orange-50 border border-orange-200 p-5 rounded-3xl animate-pulse">
                                <p className="text-orange-600 font-black flex items-center justify-center gap-2 text-sm uppercase">
                                    <Plug2 size={20} /> 차량에서 커넥터를 분리해 주세요
                                </p>
                            </div>
                        ) : (
                            <div className="bg-blue-50 border border-blue-200 p-5 rounded-3xl">
                                <p className="text-blue-600 font-black flex items-center justify-center gap-2 text-sm uppercase">
                                    <Car size={20} /> 안전하게 출차해 주세요
                                </p>
                            </div>
                        )}
                    </div>
                    
                    <div className="w-full bg-gray-50 p-4 rounded-2xl flex items-center justify-center gap-2 font-black text-gray-300 uppercase text-[10px] tracking-tighter border border-gray-100 italic">
                        <Loader2 className="animate-spin" size={12} /> H/W Sensor Live Monitoring
                    </div>
                </div>
            )}

            {step === 'SUCCESS' && (
                <div className="flex-1 flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in duration-500 py-4 overflow-y-auto no-scrollbar">
                    <div className="w-20 h-16 bg-blue-600 rounded-[28px] flex items-center justify-center mx-auto shadow-2xl shadow-blue-200 rotate-3 mt-4 shrink-0">
                        <Car size={40} className="text-white -rotate-3" />
                    </div>
                    <div className="space-y-1 shrink-0">
                        <h3 className="text-2xl font-black text-gray-900 tracking-tighter italic uppercase">안녕히 가세요!</h3>
                        <p className="text-xs text-gray-500 font-medium px-6 leading-relaxed">안전하게 출차가 확인되었습니다.<br/>오늘도 VIUM과 함께 쾌적한 드라이빙 되세요.</p>
                    </div>
                    
                    <div className="w-full pt-4 mt-auto border-t border-gray-100 flex flex-col gap-4">
                        <div className="bg-indigo-50/50 p-5 rounded-[28px] border border-indigo-100 text-left mx-2">
                            <p className="text-[11px] font-black text-indigo-600 mb-1">🎁 지금 회원가입 하시면</p>
                            <p className="text-[10px] text-indigo-400 font-bold leading-tight">첫 충전 1,000P 즉시 지급 및 실시간 알림 혜택을 드립니다.</p>
                        </div>
                        <div className="px-2 pb-6">
                          <a href="/" className="inline-block w-full py-5 bg-gray-900 text-white rounded-3xl font-black shadow-xl active:scale-95 transition-all hover:bg-black text-lg text-center">
                              메인 화면으로 돌아가기
                          </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
