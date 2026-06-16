import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Loader2, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Timer, Eye, EyeOff, Info } from 'lucide-react';
import { useUserStore } from '../../store/userStore';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { 
    login, signup, sendVerificationEmail, verifyEmailCode, checkNickname, isLoading 
  } = useUserStore();
  
  const [mode, setMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  // --- UI 가시성 상태 ---
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // --- 회원가입 고도화 상태 ---
  const [verificationCode, setVerificationCode] = useState('');
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [timer, setTimer] = useState(180);
  const [isNicknameChecked, setIsNicknameChecked] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  // 비밀번호 유효성 상태
  const [passRules, setPassRules] = useState({
    length: false,
    alpha: false,
    number: false,
    special: false
  });

  // --- 타이머 로직 ---
  useEffect(() => {
    let interval: any;
    if (isEmailSent && !isEmailVerified && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isEmailSent, isEmailVerified, timer]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- 비밀번호 실시간 검증 ---
  useEffect(() => {
    if (mode === 'SIGNUP') {
      setPassRules({
        length: password.length >= 8,
        alpha: /[A-Za-z]/.test(password),
        number: /\d/.test(password),
        special: /[@$!%*#?&]/.test(password)
      });
    }
  }, [password, mode]);

  const isPasswordValid = passRules.length && passRules.alpha && passRules.number && passRules.special;

  // --- 미충족 조건 확인 (가이드용) ---
  const getMissingRequirements = () => {
    if (mode !== 'SIGNUP') return [];
    const missing = [];
    if (!isEmailVerified) missing.push("이메일 인증");
    if (!isPasswordValid) missing.push("비밀번호 조건 충족");
    if (password !== passwordConfirm) missing.push("비밀번호 확인 일치");
    if (!isNicknameChecked) missing.push("닉네임 중복 확인");
    return missing;
  };

  const missingReqs = getMissingRequirements();

  // --- 닉네임 중복 확인 핸들러 ---
  const handleCheckNickname = async () => {
    if (nickname.length < 2) {
      setNicknameError('닉네임은 2자 이상이어야 합니다.');
      return;
    }
    setNicknameError(null);
    const result = await checkNickname(nickname);
    if (result.success) {
      setIsNicknameChecked(true);
      alert('사용 가능한 닉네임입니다.');
    } else {
      setIsNicknameChecked(false);
      setNicknameError(result.error || '사용할 수 없는 닉네임입니다.');
    }
  };

  // --- 이메일 인증 요청 핸들러 ---
  const handleSendCode = async () => {
    setError(null);
    
    // 이메일 형식 선제 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('올바른 이메일 형식이 아닙니다.');
      return;
    }

    const result = await sendVerificationEmail(email);
    if (result.success) {
      setIsEmailSent(true);
      setTimer(180);
      alert('인증 코드가 발송되었습니다. 메일함을 확인해 주세요.');
    } else {
      setError(result.error || '인증 코드 발송에 실패했습니다.');
    }
  };

  // --- 이메일 코드 검증 핸들러 ---
  const handleVerifyCode = async () => {
    setError(null);
    const result = await verifyEmailCode(email, verificationCode);
    if (result.success) {
      setIsEmailVerified(true);
      alert('이메일 인증이 완료되었습니다.');
    } else {
      setError(result.error || '인증 코드가 올바르지 않습니다.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'LOGIN') {
      const formData = new FormData();
      formData.append('username', email); 
      formData.append('password', password);
      
      const success = await login(formData);
      if (success) onClose();
      else setError('이메일 또는 비밀번호가 잘못되었습니다.');
    } else {
      // 회원가입 최종 검증
      if (!isEmailVerified) {
        setError('이메일 인증이 필요합니다.');
        return;
      }
      if (!isPasswordValid) {
        setError('비밀번호 조건을 충족해야 합니다.');
        return;
      }
      if (password !== passwordConfirm) {
        setError('비밀번호가 일치하지 않습니다.');
        return;
      }
      if (!isNicknameChecked) {
        setError('닉네임 중복 확인이 필요합니다.');
        return;
      }

      const result = await signup({ 
        email, 
        password, 
        nickname, 
        admin_code: adminCode || null 
      });
      if (result.success) {
        alert('회원가입이 완료되었습니다. 로그인해 주세요!');
        setMode('LOGIN');
        // 가입 성공 시 상태 초기화
        setIsEmailVerified(false);
        setIsEmailSent(false);
        setIsNicknameChecked(false);
      } else {
        setError(result.error || '회원가입에 실패했습니다.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-sm rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
        
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-full flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>

        <div className="flex justify-between items-start px-8 pt-4 pb-6">
          <div>
            <h3 className="text-2xl font-black text-gray-900 leading-tight">
              {mode === 'LOGIN' ? '환영합니다!' : 'VIUM 가입하기'}
            </h3>
            <p className="text-gray-400 text-xs mt-1 font-medium">
              {mode === 'LOGIN' ? '로그인하고 실명 리뷰를 남겨보세요.' : '스마트한 충전 생활의 시작.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-300 hover:text-gray-500 transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 space-y-4 no-scrollbar pb-6">
          {/* --- Email Section --- */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-3.5 text-gray-300" size={18} />
                <input 
                  type="email" 
                  required
                  disabled={isEmailVerified}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full bg-gray-50 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none ${isEmailVerified ? 'opacity-50' : ''}`}
                />
              </div>
              {mode === 'SIGNUP' && !isEmailVerified && (
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={isLoading || !email.includes('@')}
                  className="px-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black hover:bg-black disabled:bg-gray-200 transition-all"
                >
                  {isEmailSent ? '재발송' : '인증요청'}
                </button>
              )}
            </div>
          </div>

          {/* --- Verification Code Section (Signup Only) --- */}
          {mode === 'SIGNUP' && isEmailSent && !isEmailVerified && (
            <div className="space-y-1 animate-in slide-in-from-top duration-300">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Verification Code</label>
                <div className="flex items-center gap-1 text-[10px] font-bold text-red-500">
                  <Timer size={12} />
                  <span>{formatTime(timer)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="6자리 코드 입력"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="flex-1 bg-blue-50 border-2 border-blue-100 rounded-2xl py-3.5 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={isLoading || verificationCode.length !== 6}
                  className="px-6 bg-blue-600 text-white rounded-2xl text-[10px] font-black hover:bg-blue-700 disabled:bg-gray-200"
                >
                  확인
                </button>
              </div>
            </div>
          )}

          {isEmailVerified && mode === 'SIGNUP' && (
            <div className="flex items-center gap-2 ml-1 text-green-500 animate-in fade-in">
              <CheckCircle2 size={14} />
              <span className="text-[10px] font-bold">이메일 인증이 완료되었습니다.</span>
            </div>
          )}

          {/* --- Password Section --- */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-gray-300" size={18} />
              <input 
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl py-3.5 pl-12 pr-12 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-gray-300 hover:text-gray-500 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {mode === 'SIGNUP' && (
              <div className="grid grid-cols-2 gap-1 mt-2 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <div className={`flex items-center gap-1 text-[9px] font-bold ${passRules.length ? 'text-green-500' : 'text-gray-400'}`}>
                  <CheckCircle2 size={10} /> 8자 이상
                </div>
                <div className={`flex items-center gap-1 text-[9px] font-bold ${passRules.alpha ? 'text-green-500' : 'text-gray-400'}`}>
                  <CheckCircle2 size={10} /> 영문 포함
                </div>
                <div className={`flex items-center gap-1 text-[9px] font-bold ${passRules.number ? 'text-green-500' : 'text-gray-400'}`}>
                  <CheckCircle2 size={10} /> 숫자 포함
                </div>
                <div className={`flex items-center gap-1 text-[9px] font-bold ${passRules.special ? 'text-green-500' : 'text-gray-400'}`}>
                  <CheckCircle2 size={10} /> 특수문자 포함
                </div>
              </div>
            )}
          </div>

          {mode === 'SIGNUP' && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Confirm Password</label>
              <div className="relative">
                <ShieldCheck className={`absolute left-4 top-3.5 transition-colors ${passwordConfirm ? (password === passwordConfirm ? 'text-green-500' : 'text-red-400') : 'text-gray-300'}`} size={18} />
                <input 
                  type={showPasswordConfirm ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className={`w-full bg-gray-50 border-none rounded-2xl py-3.5 pl-12 pr-12 text-sm font-bold focus:ring-2 transition-all outline-none ${passwordConfirm ? (password === passwordConfirm ? 'focus:ring-green-500 bg-green-50/30' : 'focus:ring-red-500 bg-red-50/30') : 'focus:ring-blue-500'}`}
                />
                <button 
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-4 top-3.5 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  {showPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordConfirm && password !== passwordConfirm && (
                <p className="text-red-500 text-[9px] font-bold ml-1">비밀번호가 일치하지 않습니다.</p>
              )}
              {passwordConfirm && password === passwordConfirm && (
                <p className="text-green-500 text-[9px] font-bold ml-1">비밀번호가 일치합니다.</p>
              )}
            </div>
          )}

          {mode === 'SIGNUP' && (
            <>
              {/* --- Nickname Section --- */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nickname</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <User className="absolute left-4 top-3.5 text-gray-300" size={18} />
                    <input 
                      type="text" 
                      required
                      placeholder="멋진 닉네임"
                      value={nickname}
                      onChange={(e) => {
                        setNickname(e.target.value);
                        setIsNicknameChecked(false);
                      }}
                      className="w-full bg-gray-50 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckNickname}
                    disabled={isLoading || isNicknameChecked}
                    className={`px-4 rounded-2xl text-[10px] font-black transition-all ${isNicknameChecked ? 'bg-green-100 text-green-600' : 'bg-gray-900 text-white hover:bg-black'}`}
                  >
                    {isNicknameChecked ? '확인됨' : '중복확인'}
                  </button>
                </div>
                {nicknameError && <p className="text-red-500 text-[9px] font-bold ml-1">{nicknameError}</p>}
              </div>

              {/* --- Admin Code Section --- */}
              <div className="space-y-1">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Admin Code</label>
                  <span className="text-[8px] font-bold text-blue-400 opacity-60">(선택사항)</span>
                </div>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-3.5 text-gray-300" size={18} />
                  <input 
                    type="password" 
                    placeholder="관리자 초대 코드"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-1 text-red-500 text-[10px] font-bold ml-1 animate-bounce">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* --- 회원가입 안내 가이드 (Missing Requirements) --- */}
          {mode === 'SIGNUP' && missingReqs.length > 0 && (
            <div className="mx-1 mt-4 p-3 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-2 animate-in fade-in">
              <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-tight mb-1">가입을 위해 다음이 필요합니다:</p>
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  {missingReqs.map((req, idx) => (
                    <span key={idx} className="text-[9px] font-bold text-blue-400 flex items-center gap-1">
                      • {req}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </form>

        <div className="p-8 bg-gray-50/50 border-t border-gray-50 space-y-4">
          <button 
            onClick={handleSubmit} 
            disabled={isLoading || (mode === 'SIGNUP' && missingReqs.length > 0)}
            className="w-full bg-blue-600 text-white py-4 rounded-3xl text-sm font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:bg-gray-200 disabled:shadow-none flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : (mode === 'LOGIN' ? '로그인' : '회원가입')}
            {!isLoading && <ArrowRight size={16} />}
          </button>

          <div className="text-center">
            <button 
              onClick={() => {
                setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN');
                setError(null);
                setPasswordConfirm('');
              }}
              className="text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors"
            >
              {mode === 'LOGIN' ? '아직 계정이 없으신가요? 가입하기' : '이미 계정이 있으신가요? 로그인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
