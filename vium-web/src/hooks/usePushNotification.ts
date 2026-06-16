import { useState, useCallback, useEffect } from 'react';
import { pushService } from '../services/pushService';
import { apiClient } from '../services/apiClient';

/**
 * VAPID 공개키(Base64)를 브라우저가 이해할 수 있는 Uint8Array로 변환하는 유틸리티
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotification = () => {
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  /**
   * 브라우저의 현재 푸시 구독 상태를 확인합니다.
   */
  const checkSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsPushEnabled(!!subscription);
        if (typeof Notification !== 'undefined') {
            setPermission(Notification.permission);
        }
        return subscription;
    } catch (e) {
        console.warn('Check subscription failed:', e);
        return null;
    }
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  /**
   * 푸시 알림 구독 프로세스 (강제 갱신 로직 포함)
   */
  const subscribe = useCallback(async (sessionId?: string, silent: boolean = false) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      if (!silent) alert('이 브라우저는 푸시 알림을 지원하지 않습니다.');
      return false;
    }

    setIsSubscribing(true);
    try {
      // 서비스 워커 등록
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      // 권한 요청
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm !== 'granted') {
        if (!silent) alert('알림 권한이 거부되었습니다. 설정에서 알림을 허용해 주세요.');
        return false;
      }

      // 서버에서 VAPID 공개키 로드
      const keyData = await pushService.getPublicKey();
      if (!keyData || !keyData.publicKey) {
          throw new Error('공개키를 서버에서 가져올 수 없습니다.');
      }

      // [핵심 수술]: 낡은 토큰(410 Gone의 주범)을 강제로 폐기하고 새 토큰을 발급받습니다.
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
          console.log('🔄 기존 푸시 구독 발견. 강제 갱신을 위해 해지합니다.');
          await existingSub.unsubscribe();
      }

      // 새 구독 생성
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
      });

      const subJson = subscription.toJSON();
      
      // 서버에 구독 정보 저장
      const res = await pushService.subscribe({
        endpoint: subJson.endpoint!,
        p256dh: subJson.keys!.p256dh,
        auth: subJson.keys!.auth,
        session_id: sessionId,
        silent: silent // [추가]: 백엔드에도 silent 모드 전달
      });

      if (res.success) {
        setIsPushEnabled(true);
        if (!silent) console.log('✅ 푸시 알림 구독 성공 (새 토큰 발급 및 서버 등록 완료)');
        return true;
      } else {
          throw new Error(res.error || '서버 구독 등록 실패');
      }
    } catch (error: any) {
      console.error('❌ Push Subscribe Error:', error);
      if (!silent) alert('알림 구독 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
      return false;
    } finally {
      setIsSubscribing(false);
    }
  }, []);

  /**
   * 푸시 알림 구독 해지 프로세스
   */
  const unsubscribe = useCallback(async () => {
    setIsSubscribing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // 1. 서버에 구독 해지 요청 (endpoint 전달)
        await apiClient.delete(`/push/unsubscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`);
        
        // 2. 브라우저 구독 취소
        await subscription.unsubscribe();
        setIsPushEnabled(false);
        console.log('✅ 푸시 알림 해지 완료');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Push Unsubscribe Error:', error);
      return false;
    } finally {
      setIsSubscribing(false);
    }
  }, []);

  return {
    subscribe,
    unsubscribe,
    isSubscribing,
    isPushEnabled,
    permission
  };
};
