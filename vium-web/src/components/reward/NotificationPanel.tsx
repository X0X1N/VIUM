import React from 'react';
import { X, CheckCircle2, AlertTriangle, Info, BellOff } from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isAdminMode: boolean; // 역할 정보 추가
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose, isAdminMode }) => {
  const { notifications, markAsRead, deleteNotification, clearAll, markAllAsRead } = useNotificationStore();
  
  const currentRole = isAdminMode ? 'ADMIN' : 'USER';
  
  // 현재 역할에 맞는 알림만 필터링
  const filteredNotis = notifications.filter(n => n.role === currentRole);
  const unreadCount = filteredNotis.filter(n => !n.isRead).length;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}></div>
      <div className="absolute top-16 right-0 w-80 sm:w-96 bg-white rounded-[32px] shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-4">
        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-gray-900 text-sm uppercase tracking-tight">{isAdminMode ? '시스템 관제 로그' : '나의 소식'}</h3>
            {unreadCount > 0 && <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">{unreadCount}</span>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => markAllAsRead(currentRole)} className="text-[10px] font-bold text-blue-600">전체 읽음</button>
            <button onClick={() => clearAll(currentRole)} className="text-[10px] font-bold text-red-400">삭제</button>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto no-scrollbar">
          {filteredNotis.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {filteredNotis.map((noti) => (
                <div key={noti.id} onClick={() => markAsRead(noti.id)} className={`p-5 flex gap-4 transition-colors cursor-pointer hover:bg-gray-50 group relative ${!noti.isRead ? 'bg-blue-50/30' : ''}`}>
                  <div className={`shrink-0 p-2 rounded-2xl h-fit ${noti.type === 'SUCCESS' ? 'bg-green-100 text-green-600' : noti.type === 'ERROR' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    {noti.type === 'SUCCESS' ? <CheckCircle2 size={16} /> : noti.type === 'ERROR' ? <AlertTriangle size={16} /> : <Info size={16} />}
                  </div>
                  <div className="flex-1 pr-4">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`font-bold text-xs ${!noti.isRead ? 'text-gray-900' : 'text-gray-500'}`}>{noti.title}</h4>
                      <span className="text-[8px] font-bold text-gray-300 uppercase">{noti.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{noti.message}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteNotification(noti.id); }} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-red-400"><X size={14} /></button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center text-center space-y-4 text-gray-300"><BellOff size={40} /><p className="text-xs font-bold">알림 내역이 없습니다.</p></div>
          )}
        </div>
      </div>
    </>
  );
};
