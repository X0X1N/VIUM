import React from 'react';
import { Zap, UserCircle, ShieldCheck, FileText } from 'lucide-react';
import { useUserStore } from '../../store/userStore';

interface MobileNavProps {
  onOpenMyPage: () => void;
  onOpenPolicy: () => void;
  onStationClick?: () => void;
  isAdminMode?: boolean;
  onToggleAdmin?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ 
  onOpenMyPage, 
  onOpenPolicy,
  onStationClick,
  isAdminMode = false,
  onToggleAdmin
}) => {
  const { user, isAuthenticated } = useUserStore();

  return (
    <nav className="md:hidden bg-white/80 backdrop-blur-2xl border-t border-gray-100 fixed bottom-0 w-full flex justify-around items-center pt-3 pb-8 px-4 z-[60] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
      <button 
        onClick={() => { if(onStationClick) onStationClick(); }}
        className={`flex flex-col items-center gap-1.5 transition-all ${!isAdminMode ? 'text-blue-600 scale-110' : 'text-gray-400'}`}
      >
        <div className={`p-2 rounded-2xl transition-all ${!isAdminMode ? 'bg-blue-50' : 'bg-transparent'}`}>
          <Zap size={20} fill={!isAdminMode ? 'currentColor' : 'none'} />
        </div>
        <span className="text-[10px] font-black tracking-tight">충전소</span>
      </button>

      <button 
        onClick={() => isAuthenticated && onOpenMyPage()}
        className={`flex flex-col items-center gap-1.5 transition-all ${isAuthenticated ? 'text-gray-600' : 'text-gray-300'}`}
      >
        <div className="p-2 rounded-2xl">
          <UserCircle size={20} />
        </div>
        <span className="text-[10px] font-black tracking-tight">내 활동</span>
      </button>

      <button 
        onClick={onOpenPolicy}
        className="flex flex-col items-center gap-1.5 text-gray-600 active:scale-110 transition-all"
      >
        <div className="p-2 rounded-2xl">
          <FileText size={20} />
        </div>
        <span className="text-[10px] font-black tracking-tight">이용 정책</span>
      </button>

      {user?.is_admin && (
        <button 
          onClick={onToggleAdmin}
          className={`flex flex-col items-center gap-1.5 transition-all ${isAdminMode ? 'text-indigo-600 scale-110' : 'text-gray-400'}`}
        >
          <div className={`p-2 rounded-2xl transition-all ${isAdminMode ? 'bg-indigo-50' : 'bg-transparent'}`}>
            <ShieldCheck size={20} fill={isAdminMode ? 'currentColor' : 'none'} />
          </div>
          <span className="text-[10px] font-black tracking-tight">관리자</span>
        </button>
      )}
    </nav>
  );
};
