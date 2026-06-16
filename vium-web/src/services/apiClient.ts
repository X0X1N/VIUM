/**
 * VIUM API Client (Full Implementation)
 */

// 1. 현재 접속 환경 감지
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// 2. 환경에 따른 API 주소 자동 설정
// - 내 Mac에서 개발 중(isLocalhost): 내 Mac의 백엔드(localhost)를 사용
// - 서버에 배포된 상태(vium-project): 보안 도메인(HTTPS)을 사용
const BASE_URL = isLocalhost
  ? 'http://localhost:8000/api/v1' 
  : 'https://vium-project.duckdns.org/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  points_added?: number;
  total_balance?: number;
}

export const apiClient = {
  getHeaders: (isMultipart = false) => {
    const headers: any = {};
    if (!isMultipart) headers['Content-Type'] = 'application/json';
    const token = localStorage.getItem('vium_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  },

  get: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, { headers: apiClient.getHeaders() });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }
      return { success: true, data: await response.json() };
    } catch (error) {
      console.error(`API GET Error [${endpoint}]:`, error);
      return { success: false, error: (error as Error).message };
    }
  },

  post: async <T>(endpoint: string, body: any): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: apiClient.getHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return { success: true, data, points_added: data.points_added, total_balance: data.total_balance };
    } catch (error) {
      console.error(`API POST Error [${endpoint}]:`, error);
      return { success: false, error: (error as Error).message };
    }
  },

  postMultipart: async <T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: apiClient.getHeaders(true),
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }
      return { success: true, data: await response.json() };
    } catch (error) {
      console.error(`API Multipart Error [${endpoint}]:`, error);
      return { success: false, error: (error as Error).message };
    }
  },

  patch: async <T>(endpoint: string, body: any): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'PATCH',
        headers: apiClient.getHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }
      return { success: true, data: await response.json() };
    } catch (error) {
      console.error(`API PATCH Error [${endpoint}]:`, error);
      return { success: false, error: (error as Error).message };
    }
  },

  delete: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: apiClient.getHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`);
      }
      return { success: true, data: await response.json() };
    } catch (error) {
      console.error(`API DELETE Error [${endpoint}]:`, error);
      return { success: false, error: (error as Error).message };
    }
  }
};
