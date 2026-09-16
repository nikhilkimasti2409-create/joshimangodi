import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  AlertOctagon,
  ArrowRight,
  KeyRound,
  Mail,
  RefreshCw,
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth, PRIMARY_ADMIN_EMAIL } from '../lib/auth';

// Extend window for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: string | number;
              locale?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function LoginPage() {
  const {
    isAuthenticated,
    authError,
    pendingOtp,
    isLockedOut,
    lockoutTimeRemaining,
    requestOtpForEmail,
    requestOtpForGoogleCredential,
    verifyOtp,
    resendOtp,
    cancelOtpStep,
    clearError,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [inputEmail, setInputEmail] = useState(PRIMARY_ADMIN_EMAIL);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [googleGsiLoaded, setGoogleGsiLoaded] = useState(false);
  const [customClientId, setCustomClientId] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpSentNotification, setOtpSentNotification] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Determine safe redirect destination
  const fromState = (location.state as { from?: { pathname?: string } })?.from?.pathname;
  const targetRoute = fromState && fromState !== '/' && fromState !== '/login' ? fromState : '/pos';

  // Redirect on successful authentication
  useEffect(() => {
    if (isAuthenticated) {
      navigate(targetRoute, { replace: true });
    }
  }, [isAuthenticated, navigate, targetRoute]);

  // Load Google Identity Services script
  useEffect(() => {
    try {
      const existingScript = document.getElementById('google-gsi-client');
      if (!existingScript) {
        const script = document.createElement('script');
        script.id = 'google-gsi-client';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => setGoogleGsiLoaded(true);
        script.onerror = () => console.warn('Google GSI script could not be loaded.');
        document.head.appendChild(script);
      } else {
        setGoogleGsiLoaded(true);
      }
    } catch (e) {
      console.warn('Script loading error:', e);
    }
  }, []);

  // Initialize official Google Sign-In button
  useEffect(() => {
    const clientId =
      customClientId.trim() || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '';

    if (googleGsiLoaded && window.google?.accounts?.id && googleButtonRef.current && clientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (response?.credential) {
              setIsSubmitting(true);
              const res = await requestOtpForGoogleCredential(response.credential);
              setIsSubmitting(false);
              if (res.success) {
                setOtpSentNotification(true);
                setResendCooldown(30);
              }
            }
          },
        });

        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          text: 'signin_with',
          shape: 'pill',
          width: 320,
        });
      } catch (err) {
        console.warn('Google Sign-In button render notice:', err);
      }
    }
  }, [googleGsiLoaded, customClientId, requestOtpForGoogleCredential]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Auto-focus first digit input when entering OTP step
  useEffect(() => {
    if (pendingOtp) {
      setOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => otpInputsRef.current[0]?.focus(), 100);
    }
  }, [pendingOtp]);

  // Handle Request OTP
  const handleRequestOtp = async (emailToRequest: string) => {
    if (isSubmitting || isLockedOut) return;
    setIsSubmitting(true);
    clearError();

    const res = await requestOtpForEmail(emailToRequest);
    setIsSubmitting(false);

    if (res.success) {
      setOtpSentNotification(true);
      setResendCooldown(30);
    }
  };

  // Handle Email Form submit
  const handleEmailFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputEmail.trim()) return;
    handleRequestOtp(inputEmail.trim());
  };

  // Handle OTP digit changes
  const handleDigitChange = (index: number, value: string) => {
    clearError();
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6);
      if (pasted) {
        const newDigits = [...otpDigits];
        for (let i = 0; i < 6; i++) {
          newDigits[i] = pasted[i] || '';
        }
        setOtpDigits(newDigits);
        const nextIndex = Math.min(5, pasted.length);
        otpInputsRef.current[nextIndex]?.focus();
      }
      return;
    }

    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  // Handle keypresses (Backspace navigation)
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // Verify full OTP code
  const handleVerifyOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otpDigits.join('');
    if (fullCode.length < 6) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const res = verifyOtp(fullCode);
      setIsSubmitting(false);
      if (res.success) {
        navigate(targetRoute, { replace: true });
      }
    }, 200);
  };

  // Resend OTP handler
  const handleResendClick = async () => {
    if (resendCooldown > 0 || isSubmitting) return;
    setIsSubmitting(true);
    clearError();
    const res = await resendOtp();
    setIsSubmitting(false);

    if (res.success) {
      setOtpSentNotification(true);
      setResendCooldown(30);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9FA] flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Background Decorator */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#FCE7F3]/40 to-transparent pointer-events-none rounded-full blur-3xl -z-10" />

      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <img
            src="/assets/brand logo.png"
            alt="Joshi Mangodi"
            className="h-11 w-11 object-contain rounded-2xl border border-[#FCE7F3] bg-white p-0.5 shadow-xs"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <h1 className="font-serif-brand font-black text-xl text-[#31102A]">JOSHI MANGODI</h1>
            <p className="text-[11px] font-semibold text-[#632055] -mt-0.5">Operations Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-[#FCE7F3] text-xs text-[#31102A] font-bold shadow-xs">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span className="hidden sm:inline">2FA OTP Protected</span>
        </div>
      </header>

      {/* Main Login Box */}
      <main className="w-full max-w-lg my-auto py-6">
        <div className="bg-white rounded-3xl border-2 border-[#FCE7F3] shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">

          {/* Top Banner if Lockout Active */}
          {isLockedOut && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 text-xs sm:text-sm space-y-2 animate-pulse">
              <div className="flex items-center gap-2 font-black text-amber-900">
                <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                <span>Security Rate-Limit Active</span>
              </div>
              <p className="font-semibold text-amber-800 leading-snug">
                Too many failed attempts. Login is temporarily locked for safety.
              </p>
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-900 pt-1">
                <Clock size={14} /> Try again in: {lockoutTimeRemaining} seconds
              </div>
            </div>
          )}

          {/* STEP 1: Email Request & Auth Initiator */}
          {!pendingOtp && (
            <>
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-[#FFF9FA] to-[#FEFCE8] border border-[#FCE7F3] flex items-center justify-center text-[#9F1239] shadow-inner mb-3">
                  <Lock size={30} strokeWidth={2.2} />
                </div>

                <div className="inline-flex items-center gap-1.5 bg-[#31102A] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                  <ShieldCheck size={13} className="text-emerald-400" /> Secure Login
                </div>

                <h2 className="text-2xl sm:text-3xl font-serif-brand font-black text-[#31102A]">
                  Sign In
                </h2>
                <p className="text-xs sm:text-sm text-[#632055] font-medium leading-relaxed max-w-sm mx-auto">
                  A verification OTP code will be sent directly to your registered Gmail address to complete sign in.
                </p>
              </div>

              {/* Error Alert */}
              {authError && (
                <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-200 text-red-900 text-xs sm:text-sm space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 font-black text-red-800">
                    <AlertOctagon size={18} className="shrink-0 text-red-600" />
                    <span>Access Denied</span>
                  </div>
                  <p className="font-semibold text-red-700 leading-snug pl-6">{authError}</p>
                </div>
              )}

              {/* One-Click Send OTP Button */}
              <div className="space-y-3">
                <div ref={googleButtonRef} className="flex justify-center" />

                <button
                  type="button"
                  onClick={() => handleRequestOtp(PRIMARY_ADMIN_EMAIL)}
                  disabled={isSubmitting || isLockedOut}
                  className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-[#31102A] text-white hover:bg-[#4A183F] font-black text-sm sm:text-base shadow-md hover:shadow-lg active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
                >
                  <Mail size={18} className="text-emerald-400" />
                  <span>Send OTP to Gmail</span>
                  <ArrowRight size={18} />
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink mx-4 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  OR ENTER REGISTERED GMAIL
                </span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              {/* Manual Email verification form */}
              <form onSubmit={handleEmailFormSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-extrabold text-[#31102A] mb-1">
                    Registered Gmail Address:
                  </label>
                  <input
                    type="email"
                    required
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    placeholder="e.g. user@gmail.com"
                    className="w-full px-4 py-2.5 rounded-2xl border border-[#FCE7F3] bg-[#FFF9FA] text-sm font-semibold text-[#31102A] focus:bg-white focus:outline-hidden focus:border-[#9F1239] transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !inputEmail.trim() || isLockedOut}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#9F1239] text-white font-extrabold text-sm shadow-md hover:bg-[#881337] active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
                >
                  <span>Get 6-Digit OTP</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            </>
          )}

          {/* STEP 2: 6-Digit OTP Entry Form */}
          {pendingOtp && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-inner mb-2">
                  <Mail size={28} />
                </div>

                <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full">
                  <Clock size={12} className="text-emerald-600" /> OTP Dispatched
                </div>

                <h2 className="text-2xl font-serif-brand font-black text-[#31102A]">
                  Enter 6-Digit OTP Code
                </h2>

                <p className="text-xs sm:text-sm text-[#632055] font-medium leading-relaxed max-w-sm mx-auto">
                  A 6-digit passcode has been sent to your Gmail inbox (<strong className="font-extrabold text-[#31102A]">{pendingOtp.email}</strong>).
                </p>
              </div>

              {/* Confirmation Notification Banner */}
              {otpSentNotification && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span className="font-semibold">OTP sent to your Gmail! Check your inbox or spam folder.</span>
                </div>
              )}

              {/* Error Banner */}
              {authError && (
                <div className="p-3.5 rounded-2xl bg-red-50 border-2 border-red-200 text-red-900 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-black text-red-800">
                    <AlertOctagon size={16} className="shrink-0 text-red-600" />
                    <span>Verification Error</span>
                  </div>
                  <p className="font-bold text-red-700 pl-6">{authError}</p>
                </div>
              )}

              {/* OTP Input Form */}
              <form onSubmit={handleVerifyOtpSubmit} className="space-y-6">
                <div>
                  <label className="block text-center text-xs font-extrabold text-[#31102A] mb-3">
                    Type 6-Digit Passcode:
                  </label>

                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputsRef.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-mono font-black rounded-2xl border-2 border-[#E5B6D3] bg-[#FFF9FA] text-[#31102A] focus:bg-white focus:border-[#9F1239] focus:ring-2 focus:ring-[#9F1239]/20 focus:outline-hidden transition shadow-sm"
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || otpDigits.join('').length < 6}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#9F1239] text-white font-extrabold text-base shadow-md hover:bg-[#881337] active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={20} />
                  )}
                  <span>Verify OTP & Sign In</span>
                </button>
              </form>

              {/* Resend & Session Footer Controls */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                <button
                  type="button"
                  onClick={cancelOtpStep}
                  className="flex items-center gap-1 text-gray-500 font-bold hover:text-[#31102A] transition cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">
                    Attempts left: <strong className="text-[#31102A]">{pendingOtp.attemptsLeft}</strong>
                  </span>
                  <span className="text-gray-300">•</span>
                  <button
                    type="button"
                    onClick={handleResendClick}
                    disabled={resendCooldown > 0 || isSubmitting}
                    className="font-extrabold text-[#9F1239] hover:underline disabled:text-gray-400 disabled:no-underline cursor-pointer"
                  >
                    {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Optional: Custom Google Client ID Config */}
          <div className="border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="text-[11px] font-bold text-gray-400 hover:text-[#632055] flex items-center gap-1 mx-auto cursor-pointer"
            >
              <KeyRound size={12} />
              <span>{showConfig ? 'Hide' : 'Configure Custom Google Client ID (Optional)'}</span>
            </button>

            {showConfig && (
              <div className="mt-3 p-3 bg-gray-50 rounded-2xl border border-gray-200 text-xs space-y-2">
                <p className="text-gray-600 text-[11px]">
                  Provide custom Google Cloud OAuth 2.0 Client ID for Google button sign-in:
                </p>
                <input
                  type="text"
                  value={customClientId}
                  onChange={(e) => setCustomClientId(e.target.value)}
                  placeholder="xxxx-yyyy.apps.googleusercontent.com"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-white font-mono text-[11px]"
                />
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center py-3 text-xs text-gray-400 font-medium">
        Joshi Mangodi Operations v2 · Protected with 2FA OTP Authentication
      </footer>
    </div>
  );
}
