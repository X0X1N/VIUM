import { create } from 'zustand';
import type { UserProfile, ChargingStation } from '../types';
import { stationService } from '../services/stationService';

// 유저의 로그인 상태, 토큰, 프로필 정보 등을 전역으로 관리하는 스토어입니다.
// 로그인 여부에 따라 UI가 다르게 보여야 하는 곳이 많아서 Zustand로 한곳에서 관리하고 있어요!
interface UserState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingReviewStation: ChargingStation | null; // 충전 직후 리뷰 작성을 기다리는 충전소 정보
  
  fetchUser: () => Promise<void>;
  login: (credentials: FormData) => Promise<boolean>;
  sendVerificationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyEmailCode: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  checkNickname: (nickname: string) => Promise<{ success: boolean; error?: string }>;
  signup: (userData: any) => Promise<{ success: boolean; error?: string }>;
  withdrawAccount: () => Promise<{ success: boolean; error?: string }>;
  updateReview: (reviewId: number, rating: number, content: string) => Promise<{ success: boolean; error?: string }>;
  deleteReview: (reviewId: number) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (user: Partial<UserProfile>) => void;
  completeCharging: (stationId: string, points: number) => Promise<boolean>;
  setPendingReview: (station: ChargingStation | null) => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  // 앱이 처음 켜질 때 로컬 스토리지에 저장된 토큰이 있는지 확인해서 로그인 상태를 결정합니다.
  token: localStorage.getItem('vium_token'),
  isAuthenticated: !!localStorage.getItem('vium_token'),
  isLoading: false,
  pendingReviewStation: null,

  // 현재 내 정보를 서버에서 다시 가져옵니다. 
  // 마일리지가 바뀌었거나 프로필이 수정됐을 때 정보를 최신화하기 위해 사용해요.
  fetchUser: async () => {
    if (!get().token) return;
    set({ isLoading: true });
    try {
      const response = await stationService.getUserMe();
      if (response.success && response.data) {
        set({ user: response.data, isAuthenticated: true });
      } else {
        // 토큰이 만료됐거나 문제가 있다면 안전하게 로그아웃 시켜줍니다.
        get().logout();
      }
    } catch (error) {
      get().logout();
    } finally {
      set({ isLoading: false });
    }
  },

  // 로그인을 수행하고 발급받은 토큰을 로컬 스토리지에 안전하게 보관합니다.
  login: async (credentials: FormData) => {
    set({ isLoading: true });
    try {
      const response = await stationService.login(credentials);
      if (response.success && response.data) {
        const token = response.data.access_token;
        localStorage.setItem('vium_token', token);
        set({ token, isAuthenticated: true });
        await get().fetchUser(); // 로그인 성공 즉시 내 정보를 가져와서 화면에 뿌려줍니다.
        return true;
      }
      return false;
    } catch (error) {
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  // 가입 시 이메일 인증 코드를 서버에 요청합니다.
  sendVerificationEmail: async (email: string) => {
    set({ isLoading: true });
    try {
      const response = await stationService.sendVerificationEmail(email);
      return { success: response.success, error: response.error };
    } catch (error) {
      return { success: false, error: '인증 메일 발송에 실패했습니다.' };
    } finally {
      set({ isLoading: false });
    }
  },

  // 유저가 입력한 6자리 코드가 맞는지 서버에 확인을 요청해요.
  verifyEmailCode: async (email: string, code: string) => {
    set({ isLoading: true });
    try {
      const response = await stationService.verifyEmailCode(email, code);
      return { success: response.success, error: response.error };
    } catch (error) {
      return { success: false, error: '코드 검증에 실패했습니다.' };
    } finally {
      set({ isLoading: false });
    }
  },

  // 닉네임이 겹치지 않는지 실시간으로 체크할 때 호출합니다.
  checkNickname: async (nickname: string) => {
    set({ isLoading: true });
    try {
      const response = await stationService.checkNickname(nickname);
      return response.success ? { success: true } : { success: false, error: response.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      set({ isLoading: false });
    }
  },

  // 최종적으로 회원가입 정보를 서버에 전송합니다.
  signup: async (userData: any) => {
    set({ isLoading: true });
    try {
      const response = await stationService.signup(userData);
      return { success: response.success, error: response.error };
    } catch (error) {
      return { success: false, error: '서버 통신 오류' };
    } finally {
      set({ isLoading: false });
    }
  },

  // [회원 탈퇴] 정말 아쉽지만 떠나는 유저의 정보를 깔끔하게 지워줍니다.
  withdrawAccount: async () => {
    set({ isLoading: true });
    try {
      const response = await stationService.withdrawAccount();
      if (response.success) {
        get().logout(); // 탈퇴에 성공하면 로그인 정보도 즉시 비워줍니다.
        return { success: true };
      }
      return { success: false, error: response.error };
    } catch (error: any) {
      return { success: false, error: error.message };
    } finally {
      set({ isLoading: false });
    }
  },

  // 로그아웃 시에는 로컬 스토리지의 토큰을 지우고 상태를 초기화합니다.
  logout: () => {
    localStorage.removeItem('vium_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateUser: (partialUser) => set((state) => {
    if (!state.user) return state;
    return { user: { ...state.user, ...partialUser } };
  }),

  setPendingReview: (station) => set({ pendingReviewStation: station }),

  // 내가 쓴 리뷰를 수정하고 화면을 갱신합니다.
  updateReview: async (reviewId, rating, content) => {
    set({ isLoading: true });
    try {
      const response = await stationService.updateReview(reviewId, rating, content);
      if (response.success) await get().fetchUser(); // 수정된 내용을 다시 불러와야 마이페이지에 바로 반영되더라구요.
      return { success: response.success, error: response.error };
    } catch (error) {
      return { success: false, error: '리뷰 수정 오류' };
    } finally {
      set({ isLoading: false });
    }
  },

  // 리뷰 삭제 로직입니다.
  deleteReview: async (reviewId) => {
    set({ isLoading: true });
    try {
      const response = await stationService.deleteReview(reviewId);
      if (response.success) await get().fetchUser();
      return { success: response.success, error: response.error };
    } catch (error) {
      return { success: false, error: '리뷰 삭제 오류' };
    } finally {
      set({ isLoading: false });
    }
  },

  // 충전 완료 시 서버에 정산 결과를 알리고 마일리지를 업데이트합니다.
  completeCharging: async (stationId: string, points: number) => {
    try {
      const response = await stationService.completeCharging(stationId, points);
      if (response.success) {
        await get().fetchUser(); // 보상 포인트가 쌓였을 테니 정보를 새로고침해줍니다!
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to complete charging:', error);
      return false;
    }
  }
}));
