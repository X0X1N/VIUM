import React, { useState } from 'react';
import { Zap, Bell, ShieldCheck, User, LogOut, LogIn, UserCircle, FileText } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { useNotificationStore } from '../../store/notificationStore';
import { NotificationPanel } from '../reward/NotificationPanel';

interface HeaderProps {
  isAdmin: boolean;
  onToggleAdmin: () => void;
  onOpenAuth: () => void;
  onOpenMyPage: () => void;
  onOpenPolicy: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isAdmin, onToggleAdmin, onOpenAuth, onOpenMyPage, onOpenPolicy }) => {
  const { user, isAuthenticated, logout } = useUserStore();
  const { notifications } = useNotificationStore();
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // --- 역할 기반 배지 카운트 필터링 ---
  const currentRole = isAdmin ? 'ADMIN' : 'USER';
  const unreadCount = notifications.filter(n => n.role === currentRole && !n.isRead).length;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
        <div className="flex items-center gap-2 font-black text-2xl tracking-tight text-blue-600">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white">
            <Zap size={20} fill="currentColor" />
          </div>
          VIUM {isAdmin && <span className="text-gray-400 text-sm ml-1 font-black">ADMIN</span>}
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={onOpenPolicy}
            className="hidden md:flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-blue-600 font-black text-xs transition-all"
          >
            <FileText size={16} /> 이용 정책
          </button>

          {isAuthenticated && user?.is_admin && (
            <button 
              onClick={onToggleAdmin}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all ${
                isAdmin ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {isAdmin ? <User size={14} /> : <ShieldCheck size={14} />}
              {isAdmin ? '사용자 모드' : '관리자 모드'}
            </button>
          )}

          <div className="relative">
            <button 
              onClick={() => setIsNotiOpen(!isNotiOpen)}
              className={`p-2 rounded-full transition-colors relative ${isNotiOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full border-2 border-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel isOpen={isNotiOpen} onClose={() => setIsNotiOpen(false)} isAdminMode={isAdmin} />
          </div>
          
          <div className="relative">
            {isAuthenticated ? (
              <div 
                className="flex items-center gap-2 p-1 pr-3 hover:bg-gray-100 rounded-full transition-all cursor-pointer group"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold overflow-hidden border-2 border-transparent group-hover:border-blue-200 transition-all">
                  {user?.nickname?.[0] || <User size={16} />}
                </div>
                <span className="text-sm font-black text-gray-700 hidden md:inline">{user?.nickname || '회원'}님</span>
                
                {isProfileOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-[24px] shadow-2xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button 
                      onClick={() => { onOpenMyPage(); setIsProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 rounded-2xl text-xs font-black transition-colors"
                    >
                      <UserCircle size={16} className="text-blue-500" /> 마이페이지
                    </button>
                    <button 
                      onClick={() => { logout(); setIsProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-2xl text-xs font-black transition-colors mt-1"
                    >
                      <LogOut size={16} /> 로그아웃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={onOpenAuth}
                className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-gray-200 active:scale-95 transition-all hover:bg-gray-800"
              >
                <LogIn size={14} /> 로그인
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
