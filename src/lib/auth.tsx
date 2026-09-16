import { useState, useEffect, createContext, useContext } from 'react';
import type { ReactNode } from 'react';

// Whitelist of allowed emails authorized to access Joshi Mangodi Operations
export const ALLOWED_EMAILS: string[] = [
  'nikhilkimasti2409@gmail.com',
];

export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
  role: 'Super Admin' | 'Owner';
  loginTime: string;
}

export function isEmailAuthorized(email: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return ALLOWED_EMAILS.some((allowed) => allowed.trim().toLowerCase() === clean);
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

const AUTH_STORAGE_KEY = 'joshi_mangodi_auth_session_v1';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  loginWithGoogleCredential: (credential: string) => { success: boolean; error?: string };
  loginWithEmail: (email: string, name?: string) => { success: boolean; error?: string };
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const loginWithGoogleCredential = (credential: string) => {
    setAuthError(null);
    const decoded = decodeGoogleJwt(credential);

    if (!decoded || !decoded.email) {
      const errorMsg = 'Invalid Google authentication token received.';
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    }

    const email = decoded.email.trim().toLowerCase();

    if (!isEmailAuthorized(email)) {
      const errorMsg = `Access Denied: Google Account "${decoded.email}" is NOT authorized. Only whitelisted administrator emails can access this portal.`;
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    }

    const authUser: AuthUser = {
      email: decoded.email,
      name: decoded.name || decoded.email.split('@')[0],
      picture: decoded.picture,
      role: 'Super Admin',
      loginTime: new Date().toISOString(),
    };

    setUser(authUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    return { success: true };
  };

  const loginWithEmail = (email: string, name?: string) => {
    setAuthError(null);
    const cleanEmail = email.trim().toLowerCase();

    if (!isEmailAuthorized(cleanEmail)) {
      const errorMsg = `Access Denied: "${email}" is NOT authorized. Access is strictly restricted to administrator accounts.`;
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    }

    const authUser: AuthUser = {
      email: email.trim(),
      name: name || (email.toLowerCase().includes('nikhil') ? 'Nikhil (Admin)' : email.split('@')[0]),
      role: 'Super Admin',
      loginTime: new Date().toISOString(),
    };

    setUser(authUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
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
        loginWithGoogleCredential,
        loginWithEmail,
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
