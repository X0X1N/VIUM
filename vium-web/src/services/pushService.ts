import { apiClient } from './apiClient';
import type { ApiResponse } from './apiClient';

export interface PushSubscriptionRequest {
  endpoint: string;
  p256dh: string;
  auth: string;
  session_id?: string;
  silent?: boolean;
}

export const pushService = {
  /**
   * 서버로부터 VAPID 공개키를 가져옵니다.
   */
  getPublicKey: async (): Promise<{ publicKey: string } | null> => {
    const res = await apiClient.get<{ publicKey: string }>('/push/public-key');
    if (res.success && res.data) {
      return res.data;
    }
    return null;
  },

  /**
   * 브라우저에서 생성된 구독 정보를 서버에 저장합니다.
   */
  subscribe: async (subscription: PushSubscriptionRequest): Promise<ApiResponse<any>> => {
    return await apiClient.post('/push/subscribe', subscription);
  }
};
