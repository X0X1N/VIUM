import { create } from 'zustand';

export interface ViumNotification {
  id: string;
  role: 'USER' | 'ADMIN';
  type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

interface NotificationState {
  notifications: ViumNotification[];
  addNotification: (notification: Omit<ViumNotification, 'id' | 'timestamp' | 'isRead'> & { id?: string }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: (role: 'USER' | 'ADMIN') => void;
  deleteNotification: (id: string) => void;
  clearAll: (role: 'USER' | 'ADMIN') => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  addNotification: (newNoti) => {
    const notificationId = newNoti.id || "noti-" + Date.now() + Math.random().toString(36).substring(2, 9);
    
    // [중요]: 중복 알림 방지 (동일 ID인 경우 스킵)
    if (get().notifications.some(n => n.id === notificationId)) {
        console.log("🚫 [Notification Store] Duplicate Ignored:", notificationId);
        return;
    }

    const notification: ViumNotification = {
      role: newNoti.role,
      type: newNoti.type,
      title: newNoti.title,
      message: newNoti.message,
      id: notificationId,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
    };

    set((state) => ({ notifications: [notification, ...state.notifications] }));

    // [복구 및 개선]: 인앱 알림뿐만 아니라, 브라우저 Native 알림도 조건부로 활성화합니다.
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'visible') {
      new Notification(newNoti.title, {
        body: newNoti.message,
        icon: '/favicon.svg',
        tag: notificationId // 태그를 부여해 중복 노출 방지
      });
    }

    console.log("📢 [Notification Store] Added:", newNoti.title);
  },

  markAsRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
  })),

  markAllAsRead: (role) => set((state) => ({
    notifications: state.notifications.map(n => n.role === role ? { ...n, isRead: true } : n)
  })),

  deleteNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  clearAll: (role) => set((state) => ({
    notifications: state.notifications.filter(n => n.role !== role)
  })),
}));
