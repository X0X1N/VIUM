import type { ChargingStation, Review } from '../types';
import { apiClient } from './apiClient';
import type { ApiResponse } from './apiClient';

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const BASE_URL = isLocalhost ? 'http://localhost:8000/api/v1' : 'https://vium-project.duckdns.org/api/v1';

export const stationService = {
  getStations: async (): Promise<ApiResponse<ChargingStation[]>> => {
    return await apiClient.get<ChargingStation[]>('/stations');
  },

  getUserMe: async (): Promise<ApiResponse<any>> => {
    return await apiClient.get<any>('/users/me');
  },

  submitReview: async (
    stationId: string, 
    review: Omit<Review, 'id' | 'created_at' | 'updated_at' | 'user_name' | 'status'>
  ): Promise<ApiResponse<any>> => {
    return await apiClient.post<any>('/stations/' + stationId + '/reviews', review);
  },

  updateReview: async (reviewId: number, rating: number, content: string): Promise<ApiResponse<any>> => {
    return await apiClient.patch<any>('/reviews/' + reviewId, { rating, content });
  },

  deleteReview: async (reviewId: number): Promise<ApiResponse<any>> => {
    return await apiClient.delete<any>(`/reviews/${reviewId}`);
  },

  getAllReviews: async (): Promise<ApiResponse<Review[]>> => {
    return await apiClient.get<Review[]>('/admin/reviews');
  },

  updateReviewStatus: async (reviewId: number, status: 'VISIBLE' | 'HIDDEN'): Promise<ApiResponse<any>> => {
    return await apiClient.patch<any>(`/admin/reviews/${reviewId}/status`, { status });
  },

  submitReport: async (reportData: {
    charger_id: string;
    keyword: string;
    content: string;
    image?: File;
  }): Promise<ApiResponse<any>> => {
    const formData = new FormData();
    formData.append('charger_id', reportData.charger_id);
    formData.append('keyword', reportData.keyword);
    formData.append('content', reportData.content);
    if (reportData.image) formData.append('image', reportData.image);
    return await apiClient.postMultipart<any>('/reports', formData);
  },

  getReports: async (): Promise<ApiResponse<any[]>> => {
    return await apiClient.get<any[]>('/reports');
  },

  updateReportStatus: async (reportId: number, status: 'APPROVED' | 'REJECTED'): Promise<ApiResponse<any>> => {
    return await apiClient.patch<any>(`/reports/${reportId}`, { status });
  },

  updateChargerStatus: async (chargerId: string, status: 'Available' | 'Faulty' | 'Charging'): Promise<ApiResponse<any>> => {
    return await apiClient.patch<any>(`/chargers/${chargerId}/status`, { status });
  },

  completeCharging: async (stationId: string, points: number): Promise<ApiResponse<any>> => {
    return await apiClient.post<any>(`/stations/${stationId}/complete-charging`, { points });
  },

  withdrawAccount: async (): Promise<ApiResponse<any>> => {
    return await apiClient.delete<any>('/users/me');
  },

  getDirections: async (origin: string, destination: string): Promise<ApiResponse<any>> => {
    return await apiClient.get<any>(`/directions?origin=${origin}&destination=${destination}`);
  },

  createPaymentSession: async (paymentData: {
    station_id: string;
    charger_id: string;
    total_price: number;
    used_mileage: number;
    final_amount: number; target_soc?: number;
  }): Promise<ApiResponse<any>> => {
    return await apiClient.post<any>('/payments/create-session', paymentData);
  },

  updatePaymentSession: async (orderId: string, paymentData: {
    station_id: string;
    charger_id: string;
    total_price: number;
    used_mileage: number;
    final_amount: number;
    target_soc?: number;
  }): Promise<ApiResponse<any>> => {
    return await apiClient.patch<any>(`/payments/sessions/${orderId}`, paymentData);
  },

  confirmPayment: async (confirmData: {
    paymentKey: string;
    orderId: string;
    amount: number;
  }): Promise<ApiResponse<any>> => {
    return await apiClient.post<any>('/payments/confirm', confirmData);
  },

  sendVerificationEmail: async (email: string): Promise<ApiResponse<any>> => {
    return await apiClient.post<any>('/auth/send-verification', { email });
  },

  verifyEmailCode: async (email: string, code: string): Promise<ApiResponse<any>> => {
    return await apiClient.post<any>('/auth/verify-code', { email, code });
  },

  checkNickname: async (nickname: string): Promise<ApiResponse<any>> => {
    return await apiClient.get<any>(`/auth/check-nickname?nickname=${encodeURIComponent(nickname)}`);
  },

  signup: async (userData: any): Promise<ApiResponse<any>> => {
    return await apiClient.post<any>('/auth/signup', userData);
  },

  login: async (credentials: FormData): Promise<ApiResponse<any>> => {
    try {
      const response = await fetch(BASE_URL + '/auth/login', {
        method: 'POST',
        body: credentials,
      });
      const data = await response.json();
      if (response.ok) return { success: true, data };
      return { success: false, error: data.detail || '로그인 실패' };
    } catch (error) {
      return { success: false, error: '서버 통신 오류' };
    }
  }
};
