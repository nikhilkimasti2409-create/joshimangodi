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
    <div className="min-h-screen bg-surface flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <img
            src="/assets/brand logo.png"
            alt="Joshi Mangodi"
            className="h-11 w-11 object-contain rounded-lg border border-border bg-card p-0.5"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <h1 className="font-bold text-lg text-ink">JOSHI MANGODI</h1>
            <p className="text-[11px] font-semibold text-ink-muted -mt-0.5">Operations Portal</p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-success-soft text-success">
          <ShieldCheck size={16} />
          <span className="hidden sm:inline">2FA OTP Protected</span>
        </div>
      </header>

      {/* Main Login Box */}
      <main className="w-full max-w-lg my-auto py-6">
        <div className="bg-card rounded-lg border border-border p-5 sm:p-6 space-y-6">

          {/* Top Banner if Lockout Active */}
          {isLockedOut && (
            <div className="p-4 rounded-md bg-warning-soft border border-warning/30 text-warning text-xs sm:text-sm space-y-2 animate-pulse">
              <div className="flex items-center gap-2 font-bold text-warning">
                <AlertTriangle size={20} className="shrink-0" />
                <span>Security Rate-Limit Active</span>
              </div>
              <p className="font-medium text-warning leading-snug">
                Too many failed attempts. Login is temporarily locked for safety.
              </p>
              <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-warning pt-1">
                <Clock size={14} /> Try again in: {lockoutTimeRemaining} seconds
              </div>
            </div>
          )}

          {/* STEP 1: Email Request & Auth Initiator */}
          {!pendingOtp && (
            <>
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-primary-soft border border-border flex items-center justify-center text-primary mb-3">
                  <Lock size={30} strokeWidth={2.2} />
                </div>

                <div className="inline-flex items-center gap-1.5 bg-success-soft text-success text-[11px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full">
                  <ShieldCheck size={13} /> Secure Login
                </div>

                <h2 className="text-xl font-bold text-ink">
                  Sign In
                </h2>
                <p className="text-sm text-ink-muted leading-relaxed max-w-sm mx-auto">
                  A verification OTP code will be sent directly to your registered Gmail address to complete sign in.
                </p>
              </div>

              {/* Error Alert */}
              {authError && (
                <div className="p-4 rounded-md bg-danger-soft border border-danger/30 text-danger text-xs sm:text-sm space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertOctagon size={18} className="shrink-0" />
                    <span>Access Denied</span>
                  </div>
                  <p className="font-medium leading-snug pl-6">{authError}</p>
                </div>
              )}

              {/* One-Click Send OTP Button */}
              <div className="space-y-3">
                <div ref={googleButtonRef} className="flex justify-center" />

                <button
                  type="button"
                  onClick={() => handleRequestOtp(PRIMARY_ADMIN_EMAIL)}
                  disabled={isSubmitting || isLockedOut}
                  className="jm-btn-primary w-full flex items-center justify-center gap-3"
                >
                  <Mail size={18} />
                  <span>Send OTP to Gmail</span>
                  <ArrowRight size={18} />
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-4 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  OR ENTER REGISTERED GMAIL
                </span>
                <div className="flex-grow border-t border-border"></div>
              </div>

              {/* Manual Email verification form */}
              <form onSubmit={handleEmailFormSubmit} className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="email-input" className="block text-sm font-semibold text-ink-muted">
                    Registered Gmail Address:
                  </label>
                  <input
                    id="email-input"
                    type="email"
                    required
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    placeholder="e.g. user@gmail.com"
                    className="jm-input w-full"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !inputEmail.trim() || isLockedOut}
                  className="jm-btn-primary w-full flex items-center justify-center gap-2"
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
                <div className="w-14 h-14 mx-auto rounded-full bg-success-soft border border-success/30 flex items-center justify-center text-success mb-2">
                  <Mail size={28} />
                </div>

                <div className="inline-flex items-center gap-1.5 bg-success-soft text-success text-[11px] font-semibold uppercase tracking-widest px-3 py-0.5 rounded-full">
                  <Clock size={12} /> OTP Dispatched
                </div>

                <h2 className="text-xl font-bold text-ink">
                  Enter 6-Digit OTP Code
                </h2>

                <p className="text-sm text-ink-muted leading-relaxed max-w-sm mx-auto">
                  A 6-digit passcode has been sent to your Gmail inbox (<strong className="font-bold text-ink">{pendingOtp.email}</strong>).
                </p>
              </div>

              {/* Confirmation Notification Banner */}
              {otpSentNotification && (
                <div className="p-3 rounded-md bg-success-soft border border-success/30 text-success text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span className="font-medium">OTP sent to your Gmail! Check your inbox or spam folder.</span>
                </div>
              )}

              {/* Error Banner */}
              {authError && (
                <div className="p-3.5 rounded-md bg-danger-soft border border-danger/30 text-danger text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertOctagon size={16} className="shrink-0" />
                    <span>Verification Error</span>
                  </div>
                  <p className="font-medium pl-6">{authError}</p>
                </div>
              )}

              {/* OTP Input Form */}
              <form onSubmit={handleVerifyOtpSubmit} className="space-y-6">
                <div>
                  <label className="block text-center text-sm font-semibold text-ink-muted mb-3">
                    Type 6-Digit Passcode:
                  </label>

                  <div className="flex items-center justify-center gap-2 sm:gap-3">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`otp-digit-${idx}`}
                        aria-label={`Digit ${idx + 1}`}
                        ref={(el) => {
                          otpInputsRef.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-mono font-bold rounded-md border border-border bg-surface text-ink focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary focus:outline-hidden transition"
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || otpDigits.join('').length < 6}
                  className="jm-btn-primary w-full flex items-center justify-center gap-2"
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
              <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                <button
                  type="button"
                  onClick={cancelOtpStep}
                  className="flex items-center gap-1 text-ink-muted font-medium hover:text-ink transition cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-muted">
                    Attempts left: <strong className="text-ink">{pendingOtp.attemptsLeft}</strong>
                  </span>
                  <span className="text-ink-faint">•</span>
                  <button
                    type="button"
                    onClick={handleResendClick}
                    disabled={resendCooldown > 0 || isSubmitting}
                    className="font-semibold text-primary hover:text-primary-hover disabled:text-ink-faint disabled:hover:text-ink-faint transition cursor-pointer"
                  >
                    {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Optional: Custom Google Client ID Config */}
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className="text-[11px] font-semibold text-ink-muted hover:text-ink flex items-center gap-1 mx-auto cursor-pointer"
            >
              <KeyRound size={12} />
              <span>{showConfig ? 'Hide' : 'Configure Custom Google Client ID (Optional)'}</span>
            </button>

            {showConfig && (
              <div className="mt-3 p-3 bg-surface rounded-md border border-border text-xs space-y-2">
                <p className="text-ink-muted text-[11px]">
                  Provide custom Google Cloud OAuth 2.0 Client ID for Google button sign-in:
                </p>
                <input
                  type="text"
                  value={customClientId}
                  onChange={(e) => setCustomClientId(e.target.value)}
                  placeholder="xxxx-yyyy.apps.googleusercontent.com"
                  className="jm-input font-mono w-full"
                />
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center py-3 text-xs text-ink-muted font-medium">
        Joshi Mangodi Operations v2 · Protected with 2FA OTP Authentication
      </footer>
    </div>
  );
}
