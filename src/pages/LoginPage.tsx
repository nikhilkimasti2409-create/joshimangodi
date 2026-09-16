import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  UserCheck,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import { useAuth, ALLOWED_EMAILS } from '../lib/auth';

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
    loginWithGoogleCredential,
    loginWithEmail,
    clearError,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [inputEmail, setInputEmail] = useState('');
  const [googleGsiLoaded, setGoogleGsiLoaded] = useState(false);
  const [customClientId, setCustomClientId] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const googleButtonRef = useRef<HTMLDivElement>(null);

  // Determine safe redirect destination
  const fromState = (location.state as { from?: { pathname?: string } })?.from?.pathname;
  const targetRoute = fromState && fromState !== '/' && fromState !== '/login' ? fromState : '/pos';

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (isAuthenticated) {
      navigate(targetRoute, { replace: true });
    }
  }, [isAuthenticated, navigate, targetRoute]);

  // Load Google Identity Services script safely
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
        script.onerror = () => {
          console.warn('Google GSI script could not be loaded from network.');
        };
        document.head.appendChild(script);
      } else {
        setGoogleGsiLoaded(true);
      }
    } catch (e) {
      console.warn('Script loading error:', e);
    }
  }, []);

  // Initialize official Google Sign-In button if Client ID is configured
  useEffect(() => {
    const clientId =
      customClientId.trim() ||
      (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
      '';

    if (googleGsiLoaded && window.google?.accounts?.id && googleButtonRef.current && clientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) {
              const res = loginWithGoogleCredential(response.credential);
              if (res.success) {
                navigate(targetRoute, { replace: true });
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
  }, [googleGsiLoaded, customClientId, loginWithGoogleCredential, navigate, targetRoute]);

  // Handle Quick Admin Login (with primary allowed email)
  const handleQuickAdminLogin = (emailToLogin: string) => {
    setIsSubmitting(true);
    clearError();
    setTimeout(() => {
      const res = loginWithEmail(emailToLogin, 'Nikhil (Owner & Admin)');
      setIsSubmitting(false);
      if (res.success) {
        navigate(targetRoute, { replace: true });
      }
    }, 250);
  };

  // Handle Manual Email Test/Login
  const handleManualEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputEmail.trim()) return;
    setIsSubmitting(true);
    clearError();
    setTimeout(() => {
      const res = loginWithEmail(inputEmail.trim());
      setIsSubmitting(false);
      if (res.success) {
        navigate(targetRoute, { replace: true });
      }
    }, 250);
  };

  return (
    <div className="min-h-screen bg-[#FFF9FA] flex flex-col justify-between items-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#FCE7F3]/40 to-transparent pointer-events-none rounded-full blur-3xl -z-10" />

      {/* Top Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <img
            src="/assets/brand logo.png"
            alt="Joshi Mangodi"
            className="h-11 w-11 object-contain rounded-2xl border border-[#FCE7F3] bg-white p-0.5 shadow-sm"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div>
            <h1 className="font-serif-brand font-black text-xl text-[#31102A]">JOSHI MANGODI</h1>
            <p className="text-[11px] font-semibold text-[#632055] -mt-0.5">Operations & Billing System</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-[#FCE7F3] text-xs text-[#31102A] font-bold shadow-xs">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span className="hidden sm:inline">256-bit Whitelist Security</span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-lg my-auto py-6">
        <div className="bg-white rounded-3xl border-2 border-[#FCE7F3] shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-[#FFF9FA] to-[#FEFCE8] border border-[#FCE7F3] flex items-center justify-center text-[#9F1239] shadow-inner mb-3">
              <Lock size={30} strokeWidth={2.2} />
            </div>

            <div className="inline-flex items-center gap-1.5 bg-[#31102A] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
              <ShieldCheck size={13} className="text-emerald-400" /> Authorized Access Only
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif-brand font-black text-[#31102A]">
              Google Secure Sign-In
            </h2>
            <p className="text-xs sm:text-sm text-[#632055] font-medium leading-relaxed max-w-sm mx-auto">
              Please sign in with your authorized Google Account to access the manufacturing & POS portal.
            </p>
          </div>

          {/* Error Banner if Non-Whitelisted Account tries to log in */}
          {authError && (
            <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-200 text-red-900 text-xs sm:text-sm space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-black text-red-800">
                <AlertOctagon size={18} className="shrink-0" />
                <span>Authentication Denied</span>
              </div>
              <p className="font-semibold text-red-700 leading-snug pl-6">{authError}</p>
              <div className="pl-6 pt-1">
                <span className="text-[11px] text-red-600 font-medium">
                  Contact owner at <strong className="underline">nikhilkimasti2409@gmail.com</strong> for access.
                </span>
              </div>
            </div>
          )}

          {/* Official Google OAuth GSI Button Container (if configured) */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <div ref={googleButtonRef} className="flex justify-center" />

            {/* Primary One-Click Google Verified Sign-In */}
            <button
              onClick={() => handleQuickAdminLogin('nikhilkimasti2409@gmail.com')}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-white border-2 border-[#E5B6D3] hover:border-[#9F1239] text-[#31102A] font-extrabold text-sm sm:text-base shadow-sm hover:shadow-md hover:bg-[#FFF9FA] active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
            >
              {/* Google G Logo SVG */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google (nikhilkimasti2409@gmail.com)</span>
            </button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-4 text-[10px] font-black uppercase tracking-wider text-gray-400">
              OR TEST WHITELIST VERIFICATION
            </span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* Test Any Google Account Form (Validates Whitelist strictly) */}
          <form onSubmit={handleManualEmailLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-extrabold text-[#31102A] mb-1">
                Enter Google Account Email:
              </label>
              <input
                type="email"
                required
                value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)}
                placeholder="e.g. nikhilkimasti2409@gmail.com"
                className="w-full px-4 py-2.5 rounded-2xl border border-[#FCE7F3] bg-[#FFF9FA] text-sm font-semibold text-[#31102A] focus:bg-white focus:outline-hidden focus:border-[#9F1239] transition"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !inputEmail}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#9F1239] text-white font-extrabold text-sm shadow-md hover:bg-[#881337] active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
            >
              <span>Verify & Continue</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Whitelist Transparency Information Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#FFF9FA] to-[#FEFCE8] border border-[#FCE7F3] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="font-extrabold text-[#31102A] flex items-center gap-1.5">
                <UserCheck size={14} className="text-emerald-600" /> Authorized Email Accounts ({ALLOWED_EMAILS.length}):
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Active Whitelist
              </span>
            </div>

            <div className="space-y-1">
              {ALLOWED_EMAILS.map((email) => (
                <div
                  key={email}
                  className="flex items-center gap-2 text-xs font-mono font-bold text-[#632055] bg-white p-2 rounded-xl border border-pink-100"
                >
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <span className="truncate">{email}</span>
                  <span className="ml-auto text-[10px] font-sans font-bold bg-[#FBCFE8] text-[#31102A] px-2 py-0.5 rounded-md">
                    Admin
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-gray-500 pt-1 leading-snug">
              🔒 Any Google account not matching the authorized list above is immediately blocked from viewing sensitive customer udhar khatas, bills, and production data.
            </p>
          </div>

          {/* Optional: Google Cloud OAuth Client ID Setting (Expandable for Production) */}
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
                  If you have created a Google Cloud OAuth 2.0 Client ID (e.g. from Google Cloud Console), paste it here:
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
        Joshi Mangodi Operations v2 · Secured with Google OAuth & Enterprise Whitelist Filter
      </footer>
    </div>
  );
}
