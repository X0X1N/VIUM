import { useState, useCallback } from 'react';
import { useUserStore } from '../store/userStore';

export const useMileage = () => {
  const { user } = useUserStore();
  const [rewardToast, setRewardToast] = useState<{ show: boolean; amount: number }>({ show: false, amount: 0 });
  const [isCounting, setIsCounting] = useState(false);

  const globalPoints = user?.mileage_balance || 0;

  /**
   * 보상 애니메이션을 트리거합니다.
   * @param rewardAmount 적립할 마일리지 금액
   * @param reason (선택) 활동 로그에 기록될 이유. (서버 동기화는 이미 완료된 상태)
   */
  const triggerRewardAnimation = useCallback((rewardAmount: number, ) => {
    setRewardToast({ show: true, amount: rewardAmount });
    setIsCounting(true);

    let current = globalPoints;
    const target = globalPoints + rewardAmount;
    const duration = 1000;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = rewardAmount / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        clearInterval(timer);
        setIsCounting(false);
      }
    }, stepTime);

    setTimeout(() => setRewardToast({ show: false, amount: 0 }), 4000);
  }, [globalPoints]);

  return {
    points: globalPoints,
    rewardToast,
    isCounting,
    triggerRewardAnimation
  };
};
