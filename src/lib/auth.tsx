import { useState, useEffect, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

// Strictly restricted owner and super admin email
export const PRIMARY_ADMIN_EMAIL = 'nikhilkimasti2409@gmail.com';
export const ALLOWED_EMAILS: string[] = [PRIMARY_ADMIN_EMAIL];

export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
  role: 'Super Admin' | 'Owner';
  loginTime: string;
}

export function isEmailAuthorized(email: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}

// Decode Google JWT ID Token (Base64url)
export function decodeGoogleJwt(token: string): { email?: string; name?: string; picture?: string } | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Failed to decode Google JWT token:', err);
    return null;
  }
}

const AUTH_STORAGE_KEY = 'joshi_mangodi_auth_session_v2';
const MAX_OTP_ATTEMPTS = 5;
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout

export interface PendingOtpState {
  email: string;
  name: string;
  picture?: string;
  otpCode: string;
  expiresAt: number;
  attemptsLeft: number;
  lastSentAt: number;
  deliveredVia: 'emailjs' | 'simulated';
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  pendingOtp: PendingOtpState | null;
  isLockedOut: boolean;
  lockoutTimeRemaining: number; // in seconds
  requestOtpForEmail: (
    email: string,
    profileInfo?: { name?: string; picture?: string }
  ) => Promise<{ success: boolean; error?: string; simulatedCode?: string }>;
  requestOtpForGoogleCredential: (
    credential: string
  ) => Promise<{ success: boolean; error?: string; simulatedCode?: string }>;
  verifyOtp: (enteredCode: string) => { success: boolean; error?: string };
  resendOtp: () => Promise<{ success: boolean; error?: string; simulatedCode?: string }>;
  cancelOtpStep: () => void;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingOtp, setPendingOtp] = useState<PendingOtpState | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState<number>(0);

  // Lockout countdown timer effect
  useEffect(() => {
    if (!lockoutUntil) {
      setLockoutTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((lockoutUntil - now) / 1000));
      setLockoutTimeRemaining(diff);
      if (diff <= 0) {
        setLockoutUntil(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed: AuthUser = JSON.parse(stored);
        if (isEmailAuthorized(parsed.email)) {
          setUser(parsed);
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setUser(null);
        }
      }
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Helper to send OTP via EmailJS API if environment variables exist, or return simulated
  const dispatchOtpEmail = async (
    targetEmail: string,
    code: string,
    recipientName: string
  ): Promise<'emailjs' | 'simulated'> => {
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

    if (serviceId && templateId && publicKey) {
      try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            template_params: {
              to_email: targetEmail,
              to_name: recipientName,
              otp_code: code,
              app_name: 'Joshi Mangodi Operations',
            },
          }),
        });
        if (response.ok) {
          return 'emailjs';
        }
      } catch (err) {
        console.warn('EmailJS delivery failed, falling back to secure simulated verification:', err);
      }
    }
    return 'simulated';
  };

  // Generate 6-digit cryptographically secure numerical OTP
  const generateOtp = (): string => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const num = (array[0] % 900000) + 100000;
    return num.toString();
  };

  const requestOtpForEmail = async (
    email: string,
    profileInfo?: { name?: string; picture?: string }
  ) => {
    setAuthError(null);

    // Check lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const err = `Security Lockout Active: Too many failed OTP attempts. Please wait ${lockoutTimeRemaining}s before trying again.`;
      setAuthError(err);
      return { success: false, error: err };
    }

    const cleanEmail = email.trim().toLowerCase();

    // STRICT Whitelist Check
    if (!isEmailAuthorized(cleanEmail)) {
      const errorMsg = `ACCESS DENIED: "${email}" is NOT authorized. Only the owner account (${PRIMARY_ADMIN_EMAIL}) has access to this system.`;
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    }

    const code = generateOtp();
    const now = Date.now();
    const expiresAt = now + OTP_EXPIRY_MS;
    const name = profileInfo?.name || 'Nikhil (Owner)';

    const deliveredVia = await dispatchOtpEmail(cleanEmail, code, name);

    const pendingState: PendingOtpState = {
      email: cleanEmail,
      name,
      picture: profileInfo?.picture,
      otpCode: code,
      expiresAt,
      attemptsLeft: MAX_OTP_ATTEMPTS,
      lastSentAt: now,
      deliveredVia,
    };

    setPendingOtp(pendingState);
    return {
      success: true,
      simulatedCode: code,
    };
  };

  const requestOtpForGoogleCredential = async (credential: string) => {
    setAuthError(null);
    const decoded = decodeGoogleJwt(credential);

    if (!decoded || !decoded.email) {
      const errorMsg = 'Invalid Google authentication token received.';
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    }

    return await requestOtpForEmail(decoded.email, {
      name: decoded.name,
      picture: decoded.picture,
    });
  };

  const verifyOtp = (enteredCode: string) => {
    setAuthError(null);

    if (!pendingOtp) {
      const err = 'No pending OTP verification. Please start sign-in again.';
      setAuthError(err);
      return { success: false, error: err };
    }

    // Check lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const err = `Account temporarily locked due to multiple failed attempts. Try again in ${lockoutTimeRemaining}s.`;
      setAuthError(err);
      return { success: false, error: err };
    }

    // Check expiry
    if (Date.now() > pendingOtp.expiresAt) {
      const err = 'OTP has expired (5 minute limit). Please click "Resend Code".';
      setAuthError(err);
      return { success: false, error: err };
    }

    const cleanEntered = enteredCode.trim();

    if (cleanEntered === pendingOtp.otpCode) {
      // SUCCESS!
      const authUser: AuthUser = {
        email: pendingOtp.email,
        name: pendingOtp.name,
        picture: pendingOtp.picture,
        role: 'Owner',
        loginTime: new Date().toISOString(),
      };

      setUser(authUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      setPendingOtp(null);
      setLockoutUntil(null);
      return { success: true };
    }

    // FAILED OTP
    const newAttemptsLeft = pendingOtp.attemptsLeft - 1;

    if (newAttemptsLeft <= 0) {
      const newLockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      setLockoutUntil(newLockoutUntil);
      setPendingOtp(null);
      const err = `Maximum OTP attempts exceeded. System locked for 5 minutes for security.`;
      setAuthError(err);
      return { success: false, error: err };
    }

    setPendingOtp({
      ...pendingOtp,
      attemptsLeft: newAttemptsLeft,
    });

    const err = `Invalid OTP code. ${newAttemptsLeft} ${newAttemptsLeft === 1 ? 'attempt' : 'attempts'} remaining.`;
    setAuthError(err);
    return { success: false, error: err };
  };

  const resendOtp = async () => {
    if (!pendingOtp) {
      return { success: false, error: 'No active session found.' };
    }

    // Cooldown check: 30 seconds minimum between resends
    const timeSinceLastSent = Date.now() - pendingOtp.lastSentAt;
    if (timeSinceLastSent < 30000) {
      const secondsToWait = Math.ceil((30000 - timeSinceLastSent) / 1000);
      const err = `Please wait ${secondsToWait} seconds before requesting a new OTP.`;
      setAuthError(err);
      return { success: false, error: err };
    }

    return await requestOtpForEmail(pendingOtp.email, {
      name: pendingOtp.name,
      picture: pendingOtp.picture,
    });
  };

  const cancelOtpStep = () => {
    setPendingOtp(null);
    setAuthError(null);
  };

  const logout = () => {
    setUser(null);
    setPendingOtp(null);
    setAuthError(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const clearError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        authError,
        pendingOtp,
        isLockedOut: !!lockoutUntil && Date.now() < lockoutUntil,
        lockoutTimeRemaining,
        requestOtpForEmail,
        requestOtpForGoogleCredential,
        verifyOtp,
        resendOtp,
        cancelOtpStep,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
