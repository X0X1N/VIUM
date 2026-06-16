import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';

interface NotificationOverlayProps {
  isAdminMode: boolean;
}

export const NotificationOverlay: React.FC<NotificationOverlayProps> = ({ isAdminMode }) => {
  const { notifications, markAsRead } = useNotificationStore();
  
  const currentRole = isAdminMode ? 'ADMIN' : 'USER';

  // --- 현재 역할(ADMIN/USER)과 일치하는 알림만 필터링하여 노출 ---
  const unreadNotis = notifications
    .filter(n => n.role === currentRole && !n.isRead)
    .slice(0, 3);

  // [신규]: 알림 자동 숨김 로직 (5초 후 읽음 처리)
  React.useEffect(() => {
    if (unreadNotis.length > 0) {
      const timers = unreadNotis.map(noti => 
        setTimeout(() => markAsRead(noti.id), 5000)
      );
      return () => timers.forEach(t => clearTimeout(t));
    }
  }, [unreadNotis, markAsRead]);

  if (unreadNotis.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-[200] flex flex-col gap-3 w-80 pointer-events-none">
      {unreadNotis.map((noti) => (
        <div 
          key={noti.id}
          className="pointer-events-auto bg-white rounded-3xl p-5 shadow-2xl border border-gray-100 animate-in slide-in-from-right duration-500 flex gap-4 relative overflow-hidden"
        >
          <div className={`shrink-0 p-3 rounded-full h-fit ${
            noti.type === 'SUCCESS' ? 'bg-green-100 text-green-600' :
            noti.type === 'ERROR' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
          }`}>
            {noti.type === 'SUCCESS' ? <CheckCircle2 size={20} /> :
             noti.type === 'ERROR' ? <AlertTriangle size={20} /> : <Info size={20} />}
          </div>
          
          <div className="flex-1">
            <h4 className="font-black text-gray-900 text-sm mb-1">{noti.title}</h4>
            <p className="text-xs text-gray-500 leading-relaxed">{noti.message}</p>
            <p className="text-[10px] text-gray-300 mt-2 font-bold uppercase">{noti.timestamp}</p>
          </div>

          <button 
            onClick={() => markAsRead(noti.id)}
            className="p-1 hover:bg-gray-100 rounded-lg h-fit text-gray-300 transition-colors"
          >
            <X size={16} />
          </button>

          <div className={`absolute bottom-0 left-0 h-1 bg-current opacity-20 animate-progress ${
            noti.type === 'SUCCESS' ? 'text-green-500' :
            noti.type === 'ERROR' ? 'text-red-500' : 'text-blue-500'
          }`}></div>
        </div>
      ))}
    </div>
  );
};
